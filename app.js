(() => {
  const ADMIN = document.body.dataset.mode === 'admin';
  const PER = 20;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = {
    get: (k) => { try { return sessionStorage.getItem(k) || ''; } catch (e) { return ''; } },
    set: (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) {} },
  };
  const PHONE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.6a1 1 0 0 1-.25 1z"/></svg>';

  let ALL = [], page = 1, byId = {}, editing = null;

  /* ---------- เรียก API (Apps Script) ---------- */
  async function api(fn, ...args) {
    if (!window.API_URL || /PASTE_/.test(window.API_URL)) throw new Error('ยังไม่ได้ตั้งค่า API_URL ในไฟล์ config.js');
    let j;
    try {
      const res = await fetch(window.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ fn, args }) });
      j = await res.json();
    } catch (e) {
      throw new Error('เชื่อมต่อระบบไม่ได้ ตรวจอินเทอร์เน็ต หรือ URL ใน config.js / การ Deploy (Who has access: Anyone)');
    }
    if (!j.ok) throw new Error(j.error || 'เกิดข้อผิดพลาด');
    return j.data;
  }

  const msg = (t, kind) => { const m = ($('#app') && $('#app').hidden && $('#loginMsg')) || $('#msg'); m.hidden = !t; m.className = 'msg ' + (kind || 'err'); m.textContent = t || ''; };
  const code = () => $('#code') ? $('#code').value : '';
  const caller = () => { const c = ($('#caller') && $('#caller').value.trim()) || ''; if (!c) msg('กรุณาใส่ชื่อของคุณก่อน'); return c; };
  const updText = (a) => (a.updated ? 'อัปเดตล่าสุด ' + a.updated : 'ยังไม่เคยอัปเดต');

  /* ---------- ผู้ดูแล: เข้าสู่ระบบ ---------- */
  async function login(silent) {
    msg('');
    if (!caller()) return;
    if (!code()) { msg('กรุณาใส่รหัสผู้ดูแล'); return; }
    const btn = $('#loginBtn'); btn.disabled = true; btn.textContent = 'กำลังตรวจสอบ…';
    try {
      const s = await api('staffStats', code());
      store.set('adminCode', code()); store.set('adminName', $('#caller').value.trim());
      $('#login').hidden = true; $('#app').hidden = false; showStats(s); deepLink();
    } catch (e) {
      $('#login').hidden = false; $('#app').hidden = true;
      if (!silent) msg(e.message); else store.set('adminCode', '');
    } finally { btn.disabled = false; btn.textContent = 'เข้าสู่ระบบ'; }
  }
  let linked = false;
  async function deepLink() {
    const id = new URLSearchParams(location.search).get('id');
    if (!id || linked) return; linked = true;
    try { const r = await api('staffSearch', { id }, code()); if (r.items && r.items[0]) { byId[r.items[0].id] = r.items[0]; openForm(r.items[0]); } } catch (e) { msg(e.message); }
  }
  function showStats(s) {
    $('#stats').textContent = `${s.fresh} จาก ${s.total} คน`;
    $('#bar').style.width = (s.total ? Math.round(s.fresh / s.total * 100) : 0) + '%';
  }
  const loadStats = () => ADMIN && api('staffStats', code()).then(showStats).catch(() => {});

  /* ---------- ค้นหา ---------- */
  const FIELDS = ['gen', 'first', 'last', 'nick', 'dist'];
  function criteria() {
    const c = { q: $('#q').value.trim() };
    FIELDS.forEach((k) => { c[k] = $('#f_' + k).value.trim(); });
    if (ADMIN) c.fresh = $('#f_fresh').value;
    return c;
  }
  async function search(keepPage) {
    msg('');
    const c = criteria();
    if (!Object.values(c).some(Boolean)) { msg('พิมพ์ชื่อ หรือกรอกตัวกรองอย่างน้อยหนึ่งช่อง'); return; }
    $('#results').hidden = false;
    $('#sum').innerHTML = '<div class="empty">กำลังค้นหา…</div>'; $('#tbody').innerHTML = ''; $('#cards').innerHTML = ''; $('#pager').innerHTML = '';
    try {
      const r = ADMIN ? await api('staffSearch', c, code()) : await api('memberSearch', c);
      ALL = r.items; byId = {}; ALL.forEach((a) => { if (a.id) byId[a.id] = a; });
      if (!keepPage) page = 1;
      page = Math.min(page, Math.max(1, Math.ceil(ALL.length / PER)));
      render(r.total);
      loadStats();
    } catch (e) { $('#sum').innerHTML = ''; $('#results').hidden = true; msg(e.message); }
  }

  /* ---------- แสดงผล ---------- */
  function calls(a) {
    if (a.tag === 'เสียชีวิต') return '';
    return (a.phones || []).map((p) => `<a class="call" href="tel:${esc(p.tel)}">${PHONE}${esc(p.label)}</a>`).join('');
  }
  const histHtml = (a) => (a.history && a.history.length ? `<div class="hist">ก่อนหน้า: ${a.history.map((h) => esc(h.pos) + (h.date ? ' (' + esc(h.date) + ')' : '')).join(' → ')}</div>` : '');
  const nameHtml = (a) => `<div class="n"><span class="rk">${esc(a.rank)}</span>${esc(a.name)}${a.tag ? `<span class="tag">${esc(a.tag)}</span>` : ''}</div>${a.nick ? `<div class="s">“${esc(a.nick)}”</div>` : ''}`;
  const actions = (a) => ADMIN ? `<div class="upd" id="u_${esc(a.id)}">${esc(updText(a))}</div><div class="acts"><button class="btn ghost" data-act="ok" data-id="${esc(a.id)}">ข้อมูลถูกต้อง</button><button class="btn text" data-act="edit" data-id="${esc(a.id)}">แก้ไข</button></div>` : '';

  function render(total) {
    const n = ALL.length, from = n ? (page - 1) * PER + 1 : 0, to = Math.min(page * PER, n);
    if (!n) { $('#sum').innerHTML = '<div class="empty">ไม่พบข้อมูล ลองเปลี่ยนคำค้นหา</div>'; $('#tbody').innerHTML = ''; $('#cards').innerHTML = ''; $('#pager').innerHTML = ''; return; }
    $('#sum').innerHTML = `<b>พบข้อมูล ${total} รายการ</b><div>แสดงรายการที่ ${from}-${to} จาก ${n} รายการ${total > n ? ' (กรองให้แคบลงเพื่อดูส่วนที่เหลือ)' : ''}</div>`;
    const rows = ALL.slice(from - 1, to);
    $('#tbody').innerHTML = rows.map((a, i) => `<tr>
      <td class="c">${from + i}</td>
      <td class="c"><span class="pill">รุ่น ${esc(a.gen)}</span></td>
      <td>${nameHtml(a)}</td>
      <td>${esc(a.pos) || '-'}${histHtml(a)}</td>
      <td class="c">${esc(a.dist) || '-'}</td>
      <td><div class="calls">${calls(a) || '<span class="s">-</span>'}</div></td>
      ${ADMIN ? `<td>${actions(a)}</td>` : ''}</tr>`).join('');
    $('#cards').innerHTML = rows.map((a) => `<div class="card">
      <div class="top"><div>${nameHtml(a)}</div><span class="gen">รุ่น ${esc(a.gen)}</span></div>
      <div class="p">${esc(a.pos) || '-'}</div>${a.dist ? `<div class="s" style="margin-top:6px">ระยะ ${esc(a.dist)}</div>` : ''}${histHtml(a)}
      ${calls(a) ? `<div class="calls">${calls(a)}</div>` : ''}
      <div class="foot">${ADMIN ? actions(a) : `<div class="upd" style="margin:0">${esc(updText(a))}</div>`}</div></div>`).join('');
    pager();
  }
  function pager() {
    const pages = Math.ceil(ALL.length / PER);
    if (pages <= 1) { $('#pager').innerHTML = ''; return; }
    const set = new Set([1, pages, page - 1, page, page + 1]);
    const nums = [...set].filter((p) => p >= 1 && p <= pages).sort((a, b) => a - b);
    let h = `<button data-p="${page - 1}" ${page <= 1 ? 'disabled' : ''}>‹</button>`, last = 0;
    nums.forEach((p) => { if (p - last > 1) h += '<button disabled>…</button>'; h += `<button data-p="${p}" ${p === page ? 'aria-current="page"' : ''}>${p}</button>`; last = p; });
    h += `<button data-p="${page + 1}" ${page >= pages ? 'disabled' : ''}>›</button>`;
    $('#pager').innerHTML = h;
  }
  $('#pager').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-p]'); if (!b || b.disabled) return;
    page = Number(b.dataset.p); render(ALL.length); window.scrollTo({ top: $('#results').offsetTop - 70, behavior: 'smooth' });
  });

  /* ---------- ผู้ดูแล: ข้อมูลถูกต้อง / แก้ไข / เพิ่ม ---------- */
  if (ADMIN) {
    $('#results').addEventListener('click', async (e) => {
      const b = e.target.closest('button[data-act]'); if (!b) return;
      const a = byId[b.dataset.id];
      if (b.dataset.act === 'edit') return openForm(a);
      const c = caller(); if (!c) return;
      b.disabled = true;
      try {
        const r = await api('staffTouch', { id: a.id, caller: c }, code());
        a.updated = r.updated; document.querySelectorAll('[id="u_' + a.id + '"]').forEach((el) => { el.textContent = updText(a); });
        msg('บันทึกวันที่อัปเดตแล้ว', 'ok'); loadStats();
      } catch (err) { msg(err.message); }
      b.disabled = false;
    });
    $('#addBtn').addEventListener('click', () => openForm(null));
    $('#logout').addEventListener('click', () => { store.set('adminCode', ''); $('#code').value = ''; $('#app').hidden = true; $('#login').hidden = false; });
    $('#loginBtn').addEventListener('click', () => login(false));
    $('#code').addEventListener('keydown', (e) => { if (e.key === 'Enter') login(false); });
    $('#caller').value = store.get('adminName'); $('#code').value = store.get('adminCode');
    if ($('#caller').value && $('#code').value) login(true);
  }
  const dlg = $('#dlg');
  function openForm(a) {
    editing = a; const v = a || { rank: '', name: '', gen: '', nick: '', pos: '', phone: '', dist: '' };
    $('#dlgTitle').textContent = a ? 'แก้ไขข้อมูล' : 'เพิ่มรายชื่อ';
    ['rank', 'name', 'gen', 'nick', 'pos', 'phone', 'dist'].forEach((k) => { $('#e_' + k).value = v[k] || ''; });
    dlg.showModal();
  }
  if (dlg) {
    $('#dlgCancel').addEventListener('click', () => dlg.close());
    $('#dlgForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const c = caller(); if (!c) { dlg.close(); return; }
      const p = { caller: c };
      ['rank', 'name', 'gen', 'nick', 'pos', 'phone', 'dist'].forEach((k) => { p[k] = $('#e_' + k).value; });
      try {
        let r;
        if (editing) r = await api('staffUpdate', Object.assign({ id: editing.id }, p), code());
        else r = await api('staffAdd', p, code());
        dlg.close();
        msg(r && r.changed === 0 ? 'ไม่มีการเปลี่ยนแปลง (ถ้าข้อมูลถูกต้องอยู่แล้ว ให้กดปุ่ม "ข้อมูลถูกต้อง")' : 'บันทึกแล้ว', 'ok');
        if (Object.values(criteria()).some(Boolean)) search(true);
      } catch (err) { dlg.close(); msg(err.message); }
    });
  }

  /* ---------- ฟอร์มค้นหา ---------- */
  $('#filterBtn').addEventListener('click', () => { const f = $('#filters'); f.hidden = !f.hidden; $('#filterBtn').setAttribute('aria-expanded', String(!f.hidden)); });
  $('#searchForm').addEventListener('submit', (e) => { e.preventDefault(); search(false); });
  $('#clear').addEventListener('click', () => {
    $('#q').value = ''; FIELDS.forEach((k) => { $('#f_' + k).value = ''; }); if (ADMIN) $('#f_fresh').value = '';
    $('#results').hidden = true; msg('');
  });
})();

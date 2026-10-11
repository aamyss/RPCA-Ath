/**
 * ทำเนียบชมรมกรีฑา รร.นรต. — Google Apps Script (v4)
 *
 * ใช้ชีตเดิม: คอลัมน์ A-H (รุ่น ยศ ชื่อ-สกุล ชื่อเล่น ตำแหน่ง เบอร์ + ระยะ/หมายเหตุ ลำดับใดก็ได้ ดูจากหัวคอลัมน์)
 * setup() เพิ่มคอลัมน์ I-J: id, อัปเดตล่าสุด (วันที่)
 *
 * - หน้าเว็บอยู่บน GitHub Pages เรียก API ที่ไฟล์นี้ (doPost {"fn":...})
 * - เว็บ index.html (สมาชิก): ไม่ต้องใส่รหัส → ค้นหาอย่างเดียว (ไม่เห็นหมายเหตุภายใน)
 * - เว็บ admin.html (ผู้ดูแล): ใส่ ACCESS_CODE → ค้นหา กด "ข้อมูลถูกต้อง" แก้ไข เพิ่มรายชื่อ
 * - LINE bot: ผู้ใช้ที่ approved ค้นหาได้ และกด "อัปเดตข้อมูล" แก้ ตำแหน่ง/เบอร์/ระยะ/ชื่อเล่น ได้ (ต้องกดยืนยัน + บันทึก EditLog)
 *   ระงับผู้ใช้: เปลี่ยนสถานะในแท็บ Users เป็น blocked · OPEN_ACCESS=1 เปิดให้ทุกคนที่เพิ่มเพื่อนใช้ได้ทันที
 * "อัปเดตล่าสุด" = วันที่ข้อมูลถูกแก้ไข หรือถูกยืนยันว่าถูกต้องครั้งล่าสุด (ไม่มีสถานะการโทร)
 */

const MAIN = 'ชีต1';
const C = { GEN: 1, RANK: 2, NAME: 3, NICK: 4, POS: 5, PHONE: 6, NOTE: 7, DIST: 8, ID: 9, UPDATED: 10 };
const NCOL = 10;

// อ่านหัวคอลัมน์ในแถว 1: ชีตบางไฟล์สลับ "ระยะ" กับ "หมายเหตุ" (G/H) → หาตำแหน่งจริงจากชื่อหัวคอลัมน์
let colsDone_ = false;
function cols_() {
  if (colsDone_) return;
  const h = main_().getRange(1, 1, 1, 8).getValues()[0].map((x) => String(x).trim());
  const at = (re) => h.findIndex((x) => re.test(x)) + 1;
  const d = at(/^ระยะ/), n = at(/^หมายเหตุ/);
  if (d && n && d !== n) { C.DIST = d; C.NOTE = n; }
  colsDone_ = true;
}
const PAGE = 8; // จำนวนรายชื่อต่อหน้าในลิสต์ LINE
const LIMIT = 300; // จำนวนผลลัพธ์สูงสุดต่อการค้นหาบนเว็บ
const CALL_MAX = 2; // ปุ่มโทรสูงสุดต่อการ์ด

const prop_ = (k) => PropertiesService.getScriptProperties().getProperty(k);
const ss_ = () => SpreadsheetApp.getActive();
// กันค่าที่ขึ้นต้นด้วย = + @ ถูกตีเป็นสูตรในชีต (เช่นชื่อ LINE ที่ตั้งเป็นสูตร)
const safe_ = (v) => (typeof v === 'string' && /^[=+@]/.test(v) ? "'" + v : v);
const row_ = (arr) => arr.map(safe_);
const main_ = () => ss_().getSheetByName(MAIN) || ss_().getSheets()[0];
const sheet_ = (n) => ss_().getSheetByName(n);
const newId_ = () => 'p' + Utilities.getUuid().replace(/-/g, '').slice(0, 7);
const year_ = (d) => Number(Utilities.formatDate(new Date(d), 'Asia/Bangkok', 'yyyy'));

// แสดงวันที่เป็น พ.ศ. เช่น 11/10/2569
function fmtDate_(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  const p = Utilities.formatDate(dt, 'Asia/Bangkok', 'dd/MM/yyyy').split('/');
  return `${p[0]}/${p[1]}/${Number(p[2]) + 543}`;
}

function clean_(s, max, keepNewline) {
  const re = keepNewline ? /[\u0000-\u0009\u000b-\u001f\u007f]/g : /[\u0000-\u001f\u007f]/g;
  return String(s == null ? '' : s).replace(re, ' ').trim().slice(0, max);
}

/* ================= ติดตั้ง (รันซ้ำได้ ไม่ลบข้อมูล) ================= */
function setup() {
  cols_();
  const ss = ss_();
  const sh = main_();

  // ตั้งคอลัมน์เป็นข้อความก่อนเขียน: เบอร์ไม่ตกเลข 0, id/token ไม่ถูกตีเป็นตัวเลข, ไม่ถูกตีเป็นสูตร
  ['B:H', 'I:I'].forEach((a1) => sh.getRange(a1).setNumberFormat('@'));
  sh.getRange('J:J').setNumberFormat('dd/mm/yyyy');

  const heads = ['id', 'อัปเดตล่าสุด'];
  sh.getRange(1, C.ID, 1, heads.length).setValues([heads]).setFontWeight('bold');

  const last = sh.getLastRow();
  if (last >= 2) {
    const n = last - 1;
    const who = sh.getRange(2, C.NAME, n, 2).getValues(); // ชื่อ + ชื่อเล่น
    const ids = sh.getRange(2, C.ID, n, 1).getValues();
    for (let i = 0; i < n; i++) {
      if (!String(who[i][0]).trim() && !String(who[i][1]).trim()) continue;
      if (!ids[i][0]) ids[i][0] = newId_();
    }
    sh.getRange(2, C.ID, n, 1).setValues(ids);
  }
  sh.setFrozenRows(1);

  const defs = {
    PositionHistory: ['alumni_id', 'ชื่อ', 'ตำแหน่งเดิม', 'วันที่เปลี่ยน'],
    Users: ['line_user_id', 'ชื่อใน LINE', 'สถานะ (approved/pending/blocked)', 'เวลาที่ขอ'],
    EditLog: ['เวลา', 'ผู้แก้ไข', 'alumni_id', 'ชื่อ', 'การกระทำ', 'รายละเอียด'],
  };
  Object.keys(defs).forEach((name) => {
    const s = ss.getSheetByName(name) || ss.insertSheet(name);
    s.getRange(1, 1, 1, defs[name].length).setValues([defs[name]]).setFontWeight('bold');
    s.setFrozenRows(1);
  });

  // trigger สำหรับ admin ที่แก้ในชีตตรง ๆ (การแก้ผ่านเว็บบันทึกประวัติเอง)
  ScriptApp.getProjectTriggers().forEach((t) => {
    if (t.getHandlerFunction() === 'onEditInstalled') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('onEditInstalled').forSpreadsheet(ss).onEdit().create();
}

function onEditInstalled(e) {
  const sh = e.range.getSheet();
  if (sh.getName() !== main_().getName() || e.range.getRow() < 2) return;
  const r = e.range.getRow();
  const row = sh.getRange(r, 1, 1, NCOL).getValues()[0];
  const name = String(row[C.NAME - 1]).trim();
  let id = String(row[C.ID - 1]);
  if (!id && (name || String(row[C.NICK - 1]).trim())) {
    id = newId_();
    sh.getRange(r, C.ID).setValue(id);
  }
  // e.oldValue มีเฉพาะการแก้ทีละเซลล์
  if (e.range.getColumn() === C.POS && e.oldValue && e.oldValue !== e.value) {
    sheet_('PositionHistory').appendRow(row_([id, name, e.oldValue, new Date()]));
  }
  if (e.range.getColumn() < C.ID) sh.getRange(r, C.UPDATED).setValue(new Date());
}

/* ================= ข้อมูล ================= */
function getAll_() {
  cols_();
  const sh = main_();
  const last = sh.getLastRow();
  if (last < 2) return [];
  const v = sh.getRange(2, 1, last - 1, NCOL).getValues();
  const thisYear = year_(new Date());
  const out = [];
  v.forEach((r, i) => {
    const name = String(r[C.NAME - 1]).trim();
    const nick = String(r[C.NICK - 1]).trim();
    if (!name && !nick) return;
    const u = r[C.UPDATED - 1] ? new Date(r[C.UPDATED - 1]) : null;
    const okDate = u && !isNaN(u.getTime());
    out.push({
      row: i + 2,
      gen: String(r[C.GEN - 1]).replace(/\D/g, ''),
      rank: String(r[C.RANK - 1]).trim(),
      name,
      nick,
      pos: String(r[C.POS - 1]).trim(),
      phone: String(r[C.PHONE - 1]).trim(),
      note: String(r[C.NOTE - 1]).trim(),
      dist: String(r[C.DIST - 1]).trim(),
      id: String(r[C.ID - 1]),
      updated: okDate ? fmtDate_(u) : '',
      fresh: !!okDate && year_(u) === thisYear, // อัปเดตแล้วในปีนี้
    });
  });
  return out;
}

const dn_ = (a) => (a.name && a.name !== '-' ? a.name : a.nick || '(ไม่ระบุชื่อ)');
const title_ = (a) => `${a.rank ? a.rank + ' ' : ''}${dn_(a)}`;

// เบอร์ในชีตมีหลายรูปแบบ: "081-8621962 / 081-34761444", "089-7588845 ,083-6655691", "087- 4737777", "ไม่พบเบอร์", "-"
function phones_(s) {
  const out = [];
  String(s || '').split(/[\/,;\n]|\s{2,}/).forEach((part) => {
    const label = part.trim();
    const tel = label.replace(/\D/g, '');
    if (tel.length >= 8 && tel.length <= 11) out.push({ label, tel });
  });
  return out;
}

function tagOf_(a) {
  if (/เสี+ยชี+วิต/.test(a.pos + ' ' + a.note)) return 'เสียชีวิต'; // รวมกรณีพิมพ์สระซ้ำ เช่น "เสีียชีวิต"
  if (/^เกษียณ/.test(a.pos)) return 'เกษียณ';
  if (/ลาออก/.test(a.pos)) return 'ลาออก';
  return '';
}

function searchAlumni(q, list) {
  q = clean_(q, 80).toLowerCase();
  if (!q) return [];
  list = list || getAll_();
  const m = q.match(/^(?:รุ่น|นรต\.?)\s*(\d{1,3})$/) || q.match(/^(\d{1,3})$/);
  if (m) return list.filter((a) => a.gen === m[1]);
  if (/^[\d\-\s]+$/.test(q) && q.replace(/\D/g, '').length >= 6) {
    const d = q.replace(/\D/g, '');
    return list.filter((a) => phones_(a.phone).some((p) => p.tel.includes(d)));
  }
  const terms = q.split(/\s+/);
  return list.filter((a) => {
    const hay = [a.rank, a.name, a.nick, a.pos, a.dist].join(' ').toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}

function histMap_() {
  const v = sheet_('PositionHistory').getDataRange().getValues();
  v.shift();
  const m = {};
  v.forEach((r) => {
    const k = String(r[0]);
    (m[k] = m[k] || []).push({ pos: String(r[2]), date: fmtDate_(r[3]) });
  });
  return m;
}

function log_(editor, id, name, action, detail) {
  sheet_('EditLog').appendRow(row_([new Date(), editor, id, name, action, detail]));
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

const touch_ = (a) => main_().getRange(a.row, C.UPDATED).setValue(new Date());

/* ================= กันเดารหัส ================= */
function tooMany_(key) {
  return Number(CacheService.getScriptCache().get('f_' + key) || 0) >= 30;
}
function bump_(key) {
  const c = CacheService.getScriptCache();
  c.put('f_' + key, String(Number(c.get('f_' + key) || 0) + 1), 900);
}
function auth_(code) {
  if (tooMany_('staff')) throw new Error('ใส่รหัสผิดหลายครั้ง ระบบล็อกชั่วคราว ลองใหม่ใน 15 นาที');
  const real = prop_('ACCESS_CODE');
  if (!real || code !== real) {
    bump_('staff');
    throw new Error('รหัสผ่านไม่ถูกต้อง');
  }
}

/* ================= เว็บ (API สำหรับหน้าเว็บบน GitHub Pages) ================= */
// หน้าเว็บอยู่ที่ GitHub Pages เรียกมาที่ URL นี้ด้วย POST text/plain: {"fn":"memberSearch","args":[...]}
// ตอบกลับเป็น JSON {ok:true,data} หรือ {ok:false,error}
const API_ = {
  genIndex: genIndex,
  memberSearch: memberSearch,
  staffStats: staffStats,
  staffSearch: staffSearch,
  staffTouch: staffTouch,
  staffUpdate: staffUpdate,
  staffAdd: staffAdd,
};

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function api_(body) {
  try {
    const fn = API_[body.fn];
    if (!fn || !Array.isArray(body.args)) throw new Error('คำสั่งไม่ถูกต้อง');
    return json_({ ok: true, data: fn.apply(null, body.args) });
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) });
  }
}

function doGet() {
  return json_({ ok: true, service: 'rpca-athletes-alumni' });
}

function staffView_(a, hist) {
  return {
    id: a.id, rank: a.rank, name: a.name, nick: a.nick, gen: a.gen, pos: a.pos, phone: a.phone, phones: phones_(a.phone),
    note: a.note, dist: a.dist, tag: tagOf_(a), updated: a.updated, fresh: a.fresh,
    history: hist[a.id] || [],
  };
}

/* ---- ทีมงาน (ต้องมี ACCESS_CODE) ---- */
// p.fresh: '' = ทุกคน | 'stale' = ยังไม่อัปเดตปีนี้ | 'fresh' = อัปเดตปีนี้แล้ว

function filterBy_(p, list) {
  // แต่ละช่องใส่หลายค่าคั่นด้วย / ได้ = ตรงค่าใดค่าหนึ่ง เช่น ธนวัฒน์/ธนเดช
  const any = (v, max) => clean_(v, max).toLowerCase().split('/').map((x) => x.trim()).filter(Boolean);
  const gens = String(p.gen || '').split('/').map((x) => x.replace(/\D/g, '')).filter(Boolean);
  const first = any(p.first, 60);
  const last = any(p.last, 60);
  const nick = any(p.nick, 60);
  const dist = any(p.dist, 60);
  const fresh = clean_(p.fresh, 10);
  const q = clean_(p.q, 80);
  if (!q && !gens.length && !first.length && !last.length && !nick.length && !dist.length && !fresh) throw new Error('กรอกอย่างน้อยหนึ่งช่อง');
  const has = (v, ts) => ts.some((t) => v.toLowerCase().includes(t));
  let res = q ? searchAlumni(q, list) : list;
  if (gens.length) res = res.filter((a) => gens.includes(a.gen));
  if (first.length) res = res.filter((a) => has(a.name.split(/\s+/)[0], first));
  if (last.length) res = res.filter((a) => has(a.name.split(/\s+/).slice(1).join(' '), last));
  if (nick.length) res = res.filter((a) => has(a.nick, nick));
  if (dist.length) res = res.filter((a) => has(a.dist, dist));
  if (fresh === 'stale') res = res.filter((a) => !a.fresh && tagOf_(a) !== 'เสียชีวิต');
  if (fresh === 'fresh') res = res.filter((a) => a.fresh);
  return res;
}

// ผู้ดูแล: ค้นหา + ตัวกรองสถานะข้อมูล
function staffSearch(p, code) {
  auth_(code);
  const id = clean_(p.id, 20);
  const res = id ? getAll_().filter((a) => a.id === id) : filterBy_(p, getAll_());
  const hist = histMap_();
  return { total: res.length, items: res.slice(0, LIMIT).map((a) => staffView_(a, hist)) };
}

/* ---- สมาชิก (หน้าแรก): ค้นหาอย่างเดียว ไม่ต้องใส่รหัส (ไม่มีหมายเหตุภายใน ไม่มี id) ---- */
function memberSearch(p) {
  const res = filterBy_(Object.assign({}, p, { fresh: '' }), getAll_());
  const hist = histMap_();
  return {
    total: res.length,
    items: res.slice(0, LIMIT).map((a) => ({
      rank: a.rank, name: a.name, nick: a.nick, gen: a.gen, pos: a.pos, dist: a.dist, tag: tagOf_(a),
      phones: tagOf_(a) === 'เสียชีวิต' ? [] : phones_(a.phone), updated: a.updated, history: hist[a.id] || [],
    })),
  };
}

// สารบัญรุ่นสำหรับหน้าแรก: [{gen:'36', count:23}, ...] เรียงรุ่นน้อยไปมาก (ไม่มีชื่อ/เบอร์)
function genIndex() {
  const m = {};
  getAll_().forEach((a) => { if (a.gen) m[a.gen] = (m[a.gen] || 0) + 1; });
  return Object.keys(m).sort((x, y) => Number(x) - Number(y)).map((g) => ({ gen: g, count: m[g] }));
}

function staffStats(code) {
  auth_(code);
  const list = getAll_().filter((a) => tagOf_(a) !== 'เสียชีวิต');
  return { total: list.length, fresh: list.filter((a) => a.fresh).length };
}

function findById_(id) {
  const a = getAll_().find((x) => x.id === String(id));
  if (!a) throw new Error('ไม่พบรายชื่อนี้');
  return a;
}

// เขียนเฉพาะช่องที่เปลี่ยน, ตำแหน่งเดิมลง PositionHistory อัตโนมัติ, คืนรายการที่เปลี่ยน
function applyFields_(a, f, withGen) {
  const sh = main_();
  const map = { rank: C.RANK, name: C.NAME, nick: C.NICK, pos: C.POS, phone: C.PHONE, dist: C.DIST };
  const labels = { rank: 'ยศ', name: 'ชื่อ', nick: 'ฉายา', pos: 'ตำแหน่ง', phone: 'เบอร์', dist: 'ระยะ' };
  const changes = [];
  Object.keys(map).forEach((k) => {
    if (f[k] === undefined) return;
    const nv = clean_(f[k], k === 'pos' ? 300 : 120, k === 'pos');
    if (nv === a[k]) return;
    if (k === 'pos' && a.pos) sheet_('PositionHistory').appendRow(row_([a.id, dn_(a), a.pos, new Date()]));
    sh.getRange(a.row, map[k]).setValue(safe_(nv));
    changes.push(`${labels[k]}: ${a[k]} → ${nv}`);
  });
  if (withGen && f.gen !== undefined) {
    const g = String(f.gen).replace(/\D/g, '');
    if (g && g !== a.gen) {
      sh.getRange(a.row, C.GEN).setValue(Number(g));
      changes.push(`รุ่น: ${a.gen} → ${g}`);
    }
  }
  return changes;
}

// ทีมงานโทรแล้วเจ้าของข้อมูลยืนยันว่าถูกต้อง → บันทึกวันที่อัปเดตล่าสุดเป็นวันนี้
function staffTouch(p, code) {
  auth_(code);
  const caller = clean_(p.caller, 60);
  if (!caller) throw new Error('กรุณาระบุชื่อผู้โทร');
  return withLock_(() => {
    const a = findById_(p.id);
    touch_(a);
    log_(caller, a.id, dn_(a), 'ยืนยันข้อมูลถูกต้อง', 'ทางโทรศัพท์');
    return { updated: fmtDate_(new Date()) };
  });
}

function staffUpdate(p, code) {
  auth_(code);
  const caller = clean_(p.caller, 60);
  if (!caller) throw new Error('กรุณาระบุชื่อผู้แก้ไข');
  if (!clean_(p.name, 120)) throw new Error('กรุณากรอกชื่อ-สกุล');
  return withLock_(() => {
    const a = findById_(p.id);
    const changes = applyFields_(a, p, true);
    if (changes.length) {
      touch_(a);
      log_(caller, a.id, dn_(a), 'ทีมงานแก้ไข', changes.join(' | '));
    }
    return { changed: changes.length, updated: changes.length ? fmtDate_(new Date()) : a.updated };
  });
}

function staffAdd(p, code) {
  auth_(code);
  const caller = clean_(p.caller, 60);
  if (!caller) throw new Error('กรุณาระบุชื่อผู้แก้ไข');
  const name = clean_(p.name, 120);
  const gen = String(p.gen || '').replace(/\D/g, '');
  if (!name || !gen) throw new Error('กรุณากรอก ชื่อ-สกุล และรุ่น (ตัวเลข)');
  return withLock_(() => {
    if (getAll_().some((a) => a.name === name && a.gen === gen)) throw new Error('มีรายชื่อนี้ในรุ่นนี้แล้ว ค้นหาแล้วกดแก้ไขแทน');
    const id = newId_();
    const row = new Array(NCOL).fill('');
    row[C.GEN - 1] = Number(gen);
    row[C.RANK - 1] = clean_(p.rank, 40);
    row[C.NAME - 1] = name;
    row[C.NICK - 1] = clean_(p.nick, 120);
    row[C.POS - 1] = clean_(p.pos, 300, true);
    row[C.PHONE - 1] = clean_(p.phone, 120);
    row[C.DIST - 1] = clean_(p.dist, 60);
    row[C.ID - 1] = id;
    row[C.UPDATED - 1] = new Date();
    main_().appendRow(row_(row));
    log_(caller, id, name, 'เพิ่มรายชื่อ', `รุ่น ${gen}`);
    return { id };
  });
}

/* ================= LINE bot (ค้นหา + อัปเดตข้อมูล) ================= */
const txt_ = (t) => ({ type: 'text', text: t });
const flex_ = (alt, contents) => ({ type: 'flex', altText: String(alt).slice(0, 400), contents });

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  if (body.fn) return api_(body); // เรียกจากหน้าเว็บ
  // URL /exec อยู่ใน config.js ของหน้าเว็บ (ใครก็เห็น) → ตั้ง LINE_HOOK_KEY แล้วใส่ Webhook URL เป็น .../exec?k=<LINE_HOOK_KEY>
  // กันคนปลอมข้อความ LINE ยิงเข้ามาตรง ๆ
  const hook = prop_('LINE_HOOK_KEY');
  if (hook && (!e.parameter || e.parameter.k !== hook)) return ContentService.createTextOutput('OK');
  (body.events || []).forEach((ev) => {
    try {
      handle_(ev);
    } catch (err) {
      console.error(err);
    }
  });
  return ContentService.createTextOutput('OK');
}

function handle_(ev) {
  if (!ev.source || !ev.source.userId) return;
  if (ev.type === 'follow') return onFollow_(ev);
  if (ev.type !== 'message' && ev.type !== 'postback') return;
  if (ev.type === 'message' && ev.message.type !== 'text') return;
  const uid = ev.source.userId;
  let st = userStatus_(uid);
  if (st !== 'approved' && st !== 'admin' && open_() && st !== 'blocked') st = openApprove_(uid, st);
  if (st !== 'approved' && st !== 'admin') return gate_(ev, uid);
  const admin = true; // ผู้ใช้ที่ approved ทุกคนอัปเดตข้อมูลได้ (มีขั้นตอนยืนยัน + บันทึก EditLog)
  if (ev.type === 'postback') return onPostback_(ev, uid, admin);
  onText_(ev, uid, admin);
}

// OPEN_ACCESS = 1 → ใครเพิ่มเพื่อนก็ใช้ได้ทันที (ยกเว้นสถานะ blocked) และยังบันทึกชื่อลงแท็บ Users ไว้ดูว่าใครแก้อะไร
const open_ = () => /^(1|true|yes|on)$/i.test(String(prop_('OPEN_ACCESS') || '').trim());
function openApprove_(uid, st) {
  upsertUser_(uid, 'approved');
  return 'approved';
}

/* ---------- การ์ดต้อนรับ (ส่งตอนเพิ่มเพื่อน แทนข้อความทักทายของ LINE OA ซึ่งใช้ Flex ไม่ได้) ---------- */
function onFollow_(ev) {
  const uid = ev.source.userId;
  const st = userStatus_(uid);
  if (st === 'blocked') return;
  if (open_()) {
    if (st !== 'approved' && st !== 'admin') openApprove_(uid, st);
    return reply_(ev.replyToken, [welcome_('approved')]);
  }
  if (st === null) upsertUser_(uid, 'pending');
  reply_(ev.replyToken, [welcome_(st === 'approved' || st === 'admin' ? 'approved' : 'pending')]);
}

function welcome_(st) {
  const web = (prop_('WEB_BASE') || '').replace(/\/$/, '');
  const join = !!prop_('JOIN_CODE');
  const t = (text, o) => Object.assign({ type: 'text', text, wrap: true, size: 'md' }, o || {});
  const step = (n, text) => ({
    type: 'box', layout: 'horizontal', spacing: 'md', margin: 'md',
    contents: [
      { type: 'box', layout: 'vertical', width: '26px', height: '26px', cornerRadius: '13px', backgroundColor: RED, justifyContent: 'center',
        contents: [{ type: 'text', text: String(n), color: '#FFFFFF', size: 'sm', weight: 'bold', align: 'center' }] },
      t(text, { flex: 1, gravity: 'center' }),
    ],
  });
  const body = [t('สืบค้นทำเนียบรุ่นชมรมกรีฑา พร้อมเบอร์โทรและตำแหน่งปัจจุบัน', { color: '#555555' })];
  if (st === 'approved') {
    body.push(
      step(1, 'พิมพ์ชื่อ สกุล ตำแหน่ง หรือเบอร์โทร'),
      step(2, 'พิมพ์ "รุ่น 79" เพื่อดูทั้งรุ่น'),
      step(3, 'แตะการ์ดเพื่อโทร หรือกด "อัปเดตข้อมูล" ถ้าข้อมูลเปลี่ยน'),
      t('พิมพ์ "วิธีใช้" เพื่อดูข้อความนี้อีกครั้ง', { size: 'sm', color: '#888888', margin: 'lg' })
    );
  } else {
    body.push(t(join ? 'เปิดใช้งานโดยพิมพ์\nสมัคร <รหัสเข้าร่วม>\n(ขอรหัสได้ในกลุ่มชมรม)' : 'ส่งคำขอใช้งานแล้ว รอผู้ดูแลอนุมัติ จะใช้งานได้ทันทีหลังอนุมัติครับ', { margin: 'lg', weight: 'bold', color: RED }));
  }
  const footer = [];
  if (st === 'approved') {
    footer.push({ type: 'button', style: 'primary', color: RED, height: 'sm', action: { type: 'message', label: 'ลองค้นหา "รุ่น 79"', text: 'รุ่น 79' } });
  }
  if (web) footer.push({ type: 'button', style: 'secondary', height: 'sm', action: { type: 'uri', label: 'เปิดเว็บค้นหา', uri: web + '/' } });
  const b = {
    type: 'bubble', size: 'giga',
    header: {
      type: 'box', layout: 'horizontal', spacing: 'lg', backgroundColor: BLACK, paddingAll: '18px',
      contents: [
        ...(web ? [{ type: 'image', url: web + '/icon-192.png', size: '64px', aspectMode: 'fit', flex: 0 }] : []),
        { type: 'box', layout: 'vertical', justifyContent: 'center', contents: [
          { type: 'text', text: 'ยินดีต้อนรับ', color: '#E8A3AE', size: 'sm' },
          { type: 'text', text: 'ทำเนียบชมรมกรีฑา รร.นรต.', color: '#FFFFFF', weight: 'bold', size: 'xl', wrap: true },
        ] },
      ],
    },
    body: { type: 'box', layout: 'vertical', paddingAll: '18px', contents: body },
  };
  if (footer.length) b.footer = { type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '14px', contents: footer };
  return flex_('ยินดีต้อนรับสู่ทำเนียบชมรมกรีฑา รร.นรต.', b);
}

// ผู้ใช้ใหม่: ถ้าตั้ง JOIN_CODE ไว้ พิมพ์ "สมัคร <รหัส>" แล้วใช้งานได้ทันที ไม่งั้นรอ admin เปลี่ยน pending → approved ในแท็บ Users
function gate_(ev, uid) {
  if (userStatus_(uid) === 'blocked') return reply_(ev.replyToken, [txt_('บัญชีนี้ถูกระงับการใช้งาน ติดต่อผู้ดูแลชมรมครับ')]);
  const text = ev.type === 'message' ? ev.message.text.trim() : '';
  const join = prop_('JOIN_CODE');
  if (join && text.startsWith('สมัคร ')) {
    if (tooMany_('join')) return reply_(ev.replyToken, [txt_('ลองรหัสผิดหลายครั้ง กรุณาลองใหม่ภายหลังครับ')]);
    if (text.slice(6).trim() === join) {
      upsertUser_(uid, 'approved');
      return reply_(ev.replyToken, [txt_('เปิดใช้งานแล้วครับ ✓'), welcome_('approved')]);
    }
    bump_('join');
    return reply_(ev.replyToken, [txt_('รหัสไม่ถูกต้องครับ')]);
  }
  if (userStatus_(uid) === null) upsertUser_(uid, 'pending');
  reply_(ev.replyToken, [txt_(join ? 'พิมพ์ "สมัคร <รหัสเข้าร่วม>" เพื่อเปิดใช้งาน หรือรอ admin อนุมัติครับ' : 'ส่งคำขอใช้งานแล้ว รอ admin อนุมัติครับ')]);
}

function onText_(ev, uid, admin) {
  const text = ev.message.text.trim();
  if (/^(วิธีใช้|ช่วยเหลือ|เมนู|help)$/i.test(text)) return reply_(ev.replyToken, [welcome_('approved')]);
  if (admin && getEdit_(uid)) return onEditText_(ev, uid, text);
  const all = searchAlumni(text);
  if (!all.length) return reply_(ev.replyToken, [txt_('ไม่พบข้อมูลครับ ลองพิมพ์ชื่อ สกุล ตำแหน่ง เบอร์ หรือ "รุ่น 79"')]);
  CacheService.getScriptCache().put('q_' + uid, text, 21600);
  sendResults_(ev.replyToken, all, 1, admin);
}

function parseQS_(s) {
  const o = {};
  String(s || '').split('&').forEach((kv) => {
    const i = kv.indexOf('=');
    if (i > 0) o[kv.slice(0, i)] = kv.slice(i + 1);
  });
  return o;
}

function onPostback_(ev, uid, admin) {
  const d = parseQS_(ev.postback.data);
  const token = ev.replyToken;
  if (d.d) {
    const a = getAll_().find((x) => x.id === d.d);
    return reply_(token, [a ? flex_(title_(a), detailBubble_(a, histMap_(), admin, 'giga')) : txt_('ไม่พบรายชื่อนี้ครับ')]);
  }
  if (d.h) {
    const a = getAll_().find((x) => x.id === d.h);
    if (!a) return reply_(token, [txt_('ไม่พบรายชื่อนี้ครับ')]);
    const h = histMap_()[a.id] || [];
    const lines = [title_(a), `ปัจจุบัน: ${a.pos || '-'}`];
    if (h.length) lines.push('', 'ก่อนหน้า:', ...h.map((x) => `• ${x.pos}${x.date ? ' (ย้ายเมื่อ ' + x.date + ')' : ''}`));
    else lines.push('', 'ยังไม่มีประวัติตำแหน่งก่อนหน้า');
    return reply_(token, [txt_(lines.join('\n'))]);
  }
  if (d.p) {
    const q = CacheService.getScriptCache().get('q_' + uid);
    if (!q) return reply_(token, [txt_('ผลค้นหาหมดอายุแล้ว พิมพ์ค้นหาใหม่ได้เลยครับ')]);
    return sendResults_(token, searchAlumni(q), Number(d.p) || 1, admin);
  }
  if (d.u || d.ok || d.e || d.y || d.n) {
    return onEditPostback_(ev, uid, d);
  }
}

// 1 คน → การ์ดเดียว | 2-5 คน → carousel | มากกว่านั้น → ลิสต์แบ่งหน้า (แตะชื่อเพื่อดูการ์ด)
function sendResults_(token, all, page, admin) {
  const hist = histMap_();
  if (all.length === 1) return reply_(token, [flex_(title_(all[0]), detailBubble_(all[0], hist, admin, 'giga'))]);
  if (all.length <= 5) {
    return reply_(token, [flex_(`พบ ${all.length} รายการ`, { type: 'carousel', contents: all.map((a) => detailBubble_(a, hist, admin, 'mega')) })]);
  }
  const pages = Math.ceil(all.length / PAGE);
  page = Math.min(Math.max(page, 1), pages);
  const rows = all.slice((page - 1) * PAGE, page * PAGE);
  reply_(token, [flex_(`พบ ${all.length} รายการ`, listBubble_(rows, page, pages, all.length))]);
}

const RED = '#7A1424', BLACK = '#141414';

function detailBubble_(a, hist, admin, size) {
  const tag = tagOf_(a);
  const head = {
    type: 'box', layout: 'vertical', spacing: 'xs', backgroundColor: BLACK, paddingAll: '16px',
    contents: [
      { type: 'text', text: title_(a), weight: 'bold', size: 'xl', color: '#FFFFFF', wrap: true },
      { type: 'text', text: `${a.nick ? '"' + a.nick + '" · ' : ''}นรต.รุ่น ${a.gen || '-'}`, size: 'md', color: '#E8A3AE', wrap: true },
    ],
  };
  const body = [];
  if (tag) body.push({ type: 'text', text: tag, size: 'md', color: tag === 'เสียชีวิต' ? RED : '#888888', weight: 'bold' });
  body.push({ type: 'text', text: a.pos || '-', size: 'md', wrap: true });
  if (a.dist) body.push({ type: 'text', text: `ระยะ: ${a.dist}`, size: 'md', color: RED, margin: 'sm' });
  if (a.updated) body.push({ type: 'text', text: `อัปเดตล่าสุด ${a.updated}`, size: 'sm', color: '#888888', margin: 'lg' });

  const footer = [];
  if (tag !== 'เสียชีวิต') {
    phones_(a.phone).slice(0, CALL_MAX).forEach((p, i) =>
      footer.push({ type: 'button', style: i === 0 ? 'primary' : 'secondary', color: i === 0 ? RED : undefined, height: 'md', action: { type: 'uri', label: `โทร ${p.label}`.slice(0, 40), uri: 'tel:' + p.tel } })
    );
  }
  if (admin) footer.push({ type: 'button', style: 'secondary', height: 'md', action: { type: 'postback', label: 'อัปเดตข้อมูล', data: 'u=' + a.id } });
  if (hist[a.id]) footer.push({ type: 'button', style: 'link', color: RED, height: 'sm', action: { type: 'postback', label: 'ดูประวัติตำแหน่ง', data: 'h=' + a.id } });

  const b = { type: 'bubble', size: size || 'mega', header: head, body: { type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '16px', contents: body } };
  if (footer.length) b.footer = { type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '12px', contents: footer };
  return b;
}

/* ---------- แก้ไขข้อมูลผ่าน LINE (ผู้ใช้ที่อนุมัติแล้วทุกคน) ---------- */
const EDIT_FIELDS_ = { pos: 'ตำแหน่ง', phone: 'เบอร์โทร', dist: 'ระยะ', nick: 'ชื่อเล่น/ฉายา' };

const getEdit_ = (uid) => {
  const v = CacheService.getScriptCache().get('ed_' + uid);
  return v ? JSON.parse(v) : null;
};
const setEdit_ = (uid, o) => CacheService.getScriptCache().put('ed_' + uid, JSON.stringify(o), 600);
const clearEdit_ = (uid) => CacheService.getScriptCache().remove('ed_' + uid);

const qr_ = (label, data, displayText) => ({ type: 'action', action: { type: 'postback', label: label.slice(0, 20), data, displayText: displayText || label } });
const withQuick_ = (text, items) => ({ type: 'text', text, quickReply: { items } });

function editorName_(uid) {
  const v = sheet_('Users').getDataRange().getValues();
  for (let i = 1; i < v.length; i++) if (v[i][0] === uid && v[i][1]) return String(v[i][1]) + ' (LINE)';
  return 'LINE ' + String(uid).slice(-4);
}

function onEditPostback_(ev, uid, d) {
  const token = ev.replyToken;
  const find = (id) => getAll_().find((x) => x.id === id);
  if (d.u) { // เมนูอัปเดต
    const a = find(d.u);
    if (!a) return reply_(token, [txt_('ไม่พบรายชื่อนี้ครับ')]);
    clearEdit_(uid);
    const items = [qr_('ข้อมูลถูกต้อง', 'ok=' + a.id)];
    Object.keys(EDIT_FIELDS_).forEach((f) => items.push(qr_('แก้' + EDIT_FIELDS_[f], `e=${a.id}:${f}`)));
    const web = prop_('WEB_BASE');
    if (web) items.push({ type: 'action', action: { type: 'uri', label: 'หน้าเว็บผู้ดูแล', uri: `${web.replace(/\/$/, '')}/admin.html?id=${a.id}` } });
    return reply_(token, [withQuick_(`อัปเดตข้อมูล: ${title_(a)}\n${updText_(a)}\nเลือกรายการด้านล่างครับ`, items)]);
  }
  if (d.ok) { // กดยืนยันว่าข้อมูลถูกต้อง
    return withLock_(() => {
      const a = find(d.ok);
      if (!a) return reply_(token, [txt_('ไม่พบรายชื่อนี้ครับ')]);
      touch_(a);
      log_(editorName_(uid), a.id, dn_(a), 'ข้อมูลถูกต้อง', 'ผ่าน LINE');
      reply_(token, [txt_(`บันทึกแล้วครับ: ${title_(a)}\nอัปเดตล่าสุด ${fmtDate_(new Date())}`)]);
    });
  }
  if (d.e) { // เลือกช่องที่จะแก้ → รอพิมพ์ค่าใหม่
    const [id, f] = d.e.split(':');
    const a = find(id);
    if (!a || !EDIT_FIELDS_[f]) return reply_(token, [txt_('ไม่พบรายการครับ')]);
    setEdit_(uid, { id, f });
    return reply_(token, [withQuick_(`${title_(a)}\n${EDIT_FIELDS_[f]}ปัจจุบัน: ${a[f] || '-'}\n\nพิมพ์${EDIT_FIELDS_[f]}ใหม่ได้เลยครับ`, [qr_('ยกเลิก', 'n=1')])]);
  }
  if (d.n) {
    clearEdit_(uid);
    return reply_(token, [txt_('ยกเลิกแล้วครับ')]);
  }
  if (d.y) { // ยืนยันบันทึก
    const st = getEdit_(uid);
    if (!st || st.v === undefined) return reply_(token, [txt_('หมดเวลาแล้ว เริ่มใหม่ได้จากปุ่ม "อัปเดตข้อมูล" ครับ')]);
    return withLock_(() => {
      const a = find(st.id);
      if (!a) return reply_(token, [txt_('ไม่พบรายชื่อนี้ครับ')]);
      const changes = applyFields_(a, { [st.f]: st.v }, false);
      touch_(a);
      log_(editorName_(uid), a.id, dn_(a), 'แก้ไขผ่าน LINE', changes.join(' | ') || 'ไม่มีการเปลี่ยนแปลง');
      clearEdit_(uid);
      reply_(token, [txt_(changes.length ? `บันทึกแล้วครับ\n${changes.join('\n')}` : 'ค่าเท่าเดิม ไม่มีการเปลี่ยนแปลง (บันทึกวันที่อัปเดตให้แล้ว)')]);
    });
  }
}

// ผู้ใช้พิมพ์ค่าใหม่ → ขอยืนยันก่อนบันทึก
function onEditText_(ev, uid, text) {
  const st = getEdit_(uid);
  const a = getAll_().find((x) => x.id === st.id);
  if (text === 'ยกเลิก') { clearEdit_(uid); return reply_(ev.replyToken, [txt_('ยกเลิกแล้วครับ')]); }
  if (!a) { clearEdit_(uid); return reply_(ev.replyToken, [txt_('ไม่พบรายชื่อนี้ครับ')]); }
  const v = clean_(text, st.f === 'pos' ? 300 : 120, st.f === 'pos');
  if (!v) return reply_(ev.replyToken, [txt_('ค่าว่างครับ พิมพ์ใหม่อีกครั้ง')]);
  if (st.f === 'phone' && !phones_(v).length) return reply_(ev.replyToken, [txt_('เบอร์โทรไม่ถูกต้อง ต้องมีตัวเลขอย่างน้อย 8 หลัก (หลายเบอร์คั่นด้วย , หรือ /) พิมพ์ใหม่ได้เลยครับ')]);
  setEdit_(uid, { id: st.id, f: st.f, v });
  reply_(ev.replyToken, [withQuick_(`ยืนยันแก้${EDIT_FIELDS_[st.f]}?\n${title_(a)}\nเดิม: ${a[st.f] || '-'}\nใหม่: ${v}`, [qr_('ยืนยัน', 'y=1'), qr_('ยกเลิก', 'n=1')])]);
}

const updText_ = (a) => (a.updated ? 'อัปเดตล่าสุด ' + a.updated : 'ยังไม่เคยอัปเดตในระบบนี้');

function listBubble_(rows, page, pages, total) {
  const items = [];
  rows.forEach((a, i) => {
    if (i) items.push({ type: 'separator', margin: 'sm' });
    const tag = tagOf_(a);
    items.push({
      type: 'box', layout: 'vertical', margin: 'sm', spacing: 'xs',
      action: { type: 'postback', label: 'ดูรายละเอียด', data: 'd=' + a.id },
      contents: [
        { type: 'text', text: title_(a), size: 'sm', weight: 'bold', wrap: true },
        { type: 'text', text: `${a.nick ? '"' + a.nick + '" · ' : ''}รุ่น ${a.gen || '-'}${tag ? ' · ' + tag : ''}`, size: 'xs', color: '#888888', wrap: true },
      ],
    });
  });
  const nav = [];
  if (page > 1) nav.push({ type: 'button', style: 'link', color: RED, height: 'sm', action: { type: 'postback', label: '◀ ก่อนหน้า', data: 'p=' + (page - 1) } });
  if (page < pages) nav.push({ type: 'button', style: 'link', color: RED, height: 'sm', action: { type: 'postback', label: 'ถัดไป ▶', data: 'p=' + (page + 1) } });
  const b = {
    type: 'bubble', size: 'mega',
    header: {
      type: 'box', layout: 'vertical', spacing: 'xs', backgroundColor: BLACK, paddingAll: '14px',
      contents: [
        { type: 'text', text: `พบ ${total} รายการ`, weight: 'bold', size: 'md', color: '#FFFFFF' },
        { type: 'text', text: `หน้า ${page}/${pages} · แตะชื่อเพื่อดูรายละเอียด${total > 40 ? ' · พิมพ์เพิ่มเพื่อกรองให้แคบลงได้' : ''}`, size: 'xs', color: '#E8A3AE', wrap: true },
      ],
    },
    body: { type: 'box', layout: 'vertical', contents: items },
  };
  if (nav.length) b.footer = { type: 'box', layout: 'horizontal', spacing: 'sm', contents: nav };
  return b;
}

/* ---------- whitelist ผู้ใช้ LINE ---------- */
function userStatus_(uid) {
  const v = sheet_('Users').getDataRange().getValues();
  for (let i = 1; i < v.length; i++) if (v[i][0] === uid) return String(v[i][2]).trim().toLowerCase();
  return null;
}

function upsertUser_(uid, status) {
  const sh = sheet_('Users');
  const v = sh.getDataRange().getValues();
  for (let i = 1; i < v.length; i++) {
    if (v[i][0] === uid) return sh.getRange(i + 1, 3).setValue(status);
  }
  let name = '';
  try {
    const res = UrlFetchApp.fetch('https://api.line.me/v2/bot/profile/' + uid, { headers: { Authorization: 'Bearer ' + prop_('LINE_TOKEN') } });
    name = JSON.parse(res.getContentText()).displayName;
  } catch (e) {}
  sh.appendRow(row_([uid, clean_(name, 60), status, new Date()]));
}

function reply_(replyToken, messages) {
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + prop_('LINE_TOKEN') },
    payload: JSON.stringify({ replyToken, messages }),
    muteHttpExceptions: true,
  });
}

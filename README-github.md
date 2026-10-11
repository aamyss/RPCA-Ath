# ทำเนียบชมรมกรีฑา รร.นรต. — หน้าเว็บ (GitHub Pages)

หน้าเว็บเป็นไฟล์ static อยู่บน GitHub Pages ส่วนข้อมูลอยู่ในชีตส่วนตัวของคุณ และ Apps Script ทำหน้าที่เป็น API (ไม่มีหน้าเว็บของ Google อีกแล้ว)

```
GitHub Pages (index.html, admin.html)  ──fetch──▶  Apps Script /exec (API + LINE webhook)  ──▶  Google Sheet (ส่วนตัว)
```

## ไฟล์ในโฟลเดอร์นี้
- `index.html` หน้าค้นหา (สมาชิก) · `admin.html` หน้าผู้ดูแล
- `style.css`, `app.js` หน้าตาและการทำงาน · `config.js` ที่ใส่ URL ของ Apps Script
- `logo.png`, `favicon.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `manifest.webmanifest` โลโก้และไอคอนหน้าจอโฮม

## ขั้นตอน
1. **Apps Script** (ในสำเนาชีต → Extensions → Apps Script)
   - วาง `Code.gs` ใหม่ทับของเดิม (ลบไฟล์ `Index` ออกได้ ไม่ใช้แล้ว) → รัน `setup` (ถ้ายังไม่เคย)
   - Project Settings → Script properties: `ACCESS_CODE` (รหัสผู้ดูแลหน้าเว็บ), `LINE_TOKEN`, `WEB_BASE` (ไม่บังคับ เช่น `https://ชื่อ.github.io/repo` ทำให้ปุ่ม "เปิดหน้าเว็บ" ใน LINE ใช้ได้)
   - Deploy → New deployment → Web app → Execute as **Me** → Who has access **Anyone** → Deploy
   - คัดลอก URL ที่ลงท้าย `/exec` (ใช้เป็น Webhook ของ LINE ด้วย) · แก้โค้ดภายหลังต้อง Deploy → Manage deployments → New version
2. **ใส่ URL ในเว็บ** แก้ `config.js` ให้ `window.API_URL` เป็น URL `/exec` ข้างบน
3. **ขึ้น GitHub**
   - สร้าง repo ใหม่ (เช่น `rpca-athletes`) → อัปโหลดไฟล์ทั้งหมดในโฟลเดอร์นี้ (ไฟล์ตรงชั้นนอก ไม่ซ้อนโฟลเดอร์)
   - Settings → Pages → Source: *Deploy from a branch* → Branch `main` / `(root)` → Save
   - รอ 1-2 นาที จะได้ลิงก์ `https://<ชื่อผู้ใช้>.github.io/rpca-athletes/`
4. **ติดไอคอนบน iPhone/iPad** เปิดลิงก์ใน Safari → ปุ่มแชร์ → "เพิ่มไปยังหน้าจอโฮม" ได้ไอคอนโลโก้ชมรมเต็มรูป
5. **ทดสอบ** เปิด `index.html` พิมพ์ชื่อค้นหา · เปิด `admin.html` ใส่ชื่อ + รหัสผู้ดูแล

## ความปลอดภัย (สำคัญ)
- repo นี้มีแต่หน้าเว็บ ไม่มีข้อมูลรายชื่อ จึงตั้งเป็น public ได้ **ห้ามใส่ข้อมูลจากชีตลง repo**
- หน้าค้นหาไม่มีรหัสผ่าน ใครได้ลิงก์ก็ค้นหาได้ (ต้องกรอกอย่างน้อย 1 ช่อง และได้สูงสุด 300 รายการต่อครั้ง) แชร์ลิงก์ในกลุ่มชมรมเท่านั้น ไม่โพสต์สาธารณะ
- หน้าแก้ไขต้องใช้รหัสผู้ดูแล ตั้งให้เดายาก ใส่ผิดเกิน 30 ครั้งใน 15 นาทีระบบล็อกชั่วคราว
- เว็บใส่ `noindex` ไว้เพื่อไม่ให้ Google จัดทำดัชนี


## อัปเดตผ่าน LINE
สมาชิก LINE ที่สถานะ approved ทุกคนกด "อัปเดตข้อมูล" ได้ (ตำแหน่ง/เบอร์/ระยะ/ชื่อเล่น) ต้องกดยืนยันก่อนบันทึก และทุกครั้งบันทึกใน EditLog พร้อมชื่อผู้แก้ ถ้าไม่ไว้ใจใคร ให้เปลี่ยนสถานะในแท็บ Users

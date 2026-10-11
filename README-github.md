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
   - วาง `Code.gs` ใหม่ทับของเดิม (ลบไฟล์ `Index` ออกได้ ไม่ใช้แล้ว) → รัน `setup` 1 ครั้ง (รันซ้ำได้ ไม่ลบข้อมูล)
   - Project Settings → Script properties:
     - `ACCESS_CODE` รหัสผู้ดูแลหน้าเว็บ (ตั้งให้เดายาก)
     - `LINE_TOKEN` Channel access token (long-lived) จาก LINE Developers
     - `LINE_HOOK_KEY` คำลับยาว ๆ อะไรก็ได้ เช่น `k7Qx2mPz9` (แนะนำมาก เพราะ URL `/exec` จะเปิดเผยใน config.js)
     - `JOIN_CODE` (ไม่บังคับ) ใครพิมพ์ `สมัคร <JOIN_CODE>` ในบอทจะใช้งานได้ทันที ถ้าไม่ตั้ง ต้องเปลี่ยน pending → approved ในแท็บ Users เอง
     - `WEB_BASE` (ไม่บังคับ) ลิงก์ GitHub Pages เช่น `https://ชื่อ.github.io/rpca-athletes` → ใน LINE จะมีปุ่ม "หน้าเว็บผู้ดูแล"
   - Deploy → New deployment → Web app → Execute as **Me** → Who has access **Anyone** → Deploy → คัดลอก URL ที่ลงท้าย `/exec`
   - แก้โค้ดภายหลัง: Deploy → Manage deployments → ✏️ → Version: **New version** (URL เดิม)
2. **LINE** (LINE Developers → Messaging API)
   - Webhook URL = `<URL /exec>?k=<LINE_HOOK_KEY>` → เปิด **Use webhook**
   - LINE Official Account Manager → ปิด Auto-reply และ Greeting message
   - ปุ่ม Verify อาจขึ้น error 302 ซึ่งเป็นปกติของ Apps Script ให้ทดสอบโดยส่งข้อความหาบอทจริง
3. **ใส่ URL ในเว็บ** แก้ `config.js` ให้ `window.API_URL` เป็น URL `/exec` (ไม่ต้องใส่ `?k=`)
4. **ขึ้น GitHub**
   - สร้าง repo ใหม่ (เช่น `rpca-athletes`) → อัปโหลดไฟล์ทั้งหมดในโฟลเดอร์นี้ (ไฟล์ตรงชั้นนอก ไม่ซ้อนโฟลเดอร์)
   - Settings → Pages → Source: *Deploy from a branch* → Branch `main` / `(root)` → Save
   - รอ 1-2 นาที จะได้ลิงก์ `https://<ชื่อผู้ใช้>.github.io/rpca-athletes/`
5. **ติดไอคอนบน iPhone/iPad** เปิดลิงก์ใน Safari → ปุ่มแชร์ → "เพิ่มไปยังหน้าจอโฮม" ได้ไอคอนโลโก้ชมรมเต็มรูป
6. **ทดสอบ** เปิด `index.html` พิมพ์ชื่อค้นหา · เปิด `admin.html` ใส่ชื่อ + รหัสผู้ดูแล · ทักบอท LINE แล้วอนุมัติตัวเองในแท็บ Users (approved)

## ความปลอดภัย (สำคัญ)
- repo นี้มีแต่หน้าเว็บ ไม่มีข้อมูลรายชื่อ จึงตั้งเป็น public ได้ **ห้ามใส่ข้อมูลจากชีตลง repo**
- หน้าค้นหาไม่มีรหัสผ่าน ใครได้ลิงก์ก็ค้นหาได้ (ต้องกรอกอย่างน้อย 1 ช่อง และได้สูงสุด 300 รายการต่อครั้ง) แชร์ลิงก์ในกลุ่มชมรมเท่านั้น ไม่โพสต์สาธารณะ
- หน้าแก้ไขต้องใช้รหัสผู้ดูแล ตั้งให้เดายาก ใส่ผิดเกิน 30 ครั้งใน 15 นาทีระบบล็อกชั่วคราว
- เว็บใส่ `noindex` ไว้เพื่อไม่ให้ Google จัดทำดัชนี


## อัปเดตผ่าน LINE
- ผู้ใช้ที่สถานะ `approved` ในแท็บ Users ทุกคนกด "อัปเดตข้อมูล" บนการ์ดได้: ข้อมูลถูกต้อง / แก้ตำแหน่ง / แก้เบอร์โทร / แก้ระยะ / แก้ชื่อเล่น
- พิมพ์ค่าใหม่ → บอทถามยืนยันก่อนบันทึกทุกครั้ง (ค้างไว้เกิน 10 นาทีจะยกเลิกเอง) · ตำแหน่งเดิมเก็บในแท็บ PositionHistory
- ทุกการแก้บันทึกในแท็บ EditLog พร้อมชื่อ LINE ของผู้แก้ ถ้ามีคนแก้มั่ว เปลี่ยนสถานะเขาเป็น `blocked` ในแท็บ Users

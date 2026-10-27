# EdgeDesk Hotfix v3.47 — แก้ Build ไม่ผ่าน (ไม่พบ src/glossary.js)

## สาเหตุ

`build.mjs` กับ `package.json` ตัวใหม่ขึ้น GitHub แล้ว แต่**ไฟล์ใหม่ใน `src/` ยังไม่ได้ขึ้นไป**
การวางไฟล์ทับจะเปลี่ยนเฉพาะไฟล์ที่มีอยู่แล้ว ไม่สร้างไฟล์ใหม่ให้

**ข้อมูลใน D1 ไม่ได้รับผลกระทบ** ตอน Build ไม่ผ่าน Cloudflare ยังใช้เวอร์ชันเดิมต่อ

## ไฟล์ในชุดนี้

```
src/glossary.js       ← ไฟล์ใหม่
src/rte_list.js       ← ไฟล์ใหม่
src/riskmon.js        ← ไฟล์ใหม่
src/specfix.js        ← ไฟล์ใหม่
src/wstabs.js         ← ไฟล์ใหม่
src/fonts.css         ← ไฟล์ใหม่
src/fonts/            ← โฟลเดอร์ใหม่ (ฟอนต์ 4 ไฟล์ + สัญญาอนุญาต 2 ไฟล์)
build.mjs             ← ถ้าไฟล์ไม่ครบแต่ public/index.html เป็น v3.47 แล้ว จะ deploy ได้เลย ไม่ล้ม
package.json          ← Build เฉพาะเวอร์ชันคลาวด์
public/index.html     ← หน้าเว็บ v3.47 ที่ build ไว้แล้ว
```

## ขั้นตอน (ผ่านหน้าเว็บ GitHub)

1. แตกไฟล์ `edgedesk-hotfix-v3.47.zip`
2. เปิด repo `edgedesk` → **Add file → Upload files**
3. เปิดโฟลเดอร์ `edgedesk-hotfix-v3.47` แล้ว**เลือกทั้งหมดข้างใน** (`src`, `public`, `build.mjs`, `package.json`) ลากไปวางในหน้า Upload
   - ต้องลาก **โฟลเดอร์** `src` ทั้งโฟลเดอร์ ไม่ใช่เปิดเข้าไปลากทีละไฟล์ GitHub จะสร้าง `src/fonts/` ให้เอง
   - ใช้ Chrome หรือ Edge (Safari บางเวอร์ชันลากโฟลเดอร์ไม่ได้)
   - ก่อนกด Commit ให้ดูรายการไฟล์ในหน้า Upload ว่ามี `src/glossary.js` และ `src/fonts/...` อยู่
4. Commit message: `Hotfix v3.47 — add new files` → **Commit changes**
5. ตรวจใน repo ว่ามีไฟล์ `src/glossary.js` และโฟลเดอร์ `src/fonts` แล้ว

## รอ Deploy แล้วตรวจผล

1. Cloudflare → Workers & Pages → `edgedesk` → Deployments → **View build history** → รอ **Success**
2. เปิดแอป กด `Ctrl + Shift + R` → มุมซ้ายบนต้องขึ้น **v3.47.0**
3. ถ้ามีหน้าต่าง "เทรดที่บันทึกด้วยสเปกเดิม" ให้เลือก **แปลงจำนวนล็อต** (ถ้าเคยกรอก 10 แทน 0.1) แล้วกด **ใช้**

## ถ้าไม่สะดวกลากโฟลเดอร์

อัปโหลดแค่ `public/index.html`, `build.mjs` และ `package.json` ก็พอให้เว็บขึ้น v3.47 ได้ค่ะ
ใน Build log จะมีคำเตือนว่าไฟล์ใน `src/` ไม่ครบ แต่จะ deploy สำเร็จ ค่อยอัปโหลด `src/` ให้ครบทีหลังได้

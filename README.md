# TikTok → Discord Notifier Bot

Theo dõi 1 tài khoản TikTok, khi live thì gửi link live vào kênh Discord kèm ✅,
tự sửa thành ❌ khi hết live. Khi có video mới thì gửi link video mới.

## 1. Tạo bot Discord
1. Vào https://discord.com/developers/applications → New Application
2. Tab **Bot** → Reset Token → copy lại (đây là `DISCORD_TOKEN`)
3. Tab **OAuth2 > URL Generator**: chọn scope `bot`, quyền `Send Messages`, `Read Message History`
   → mở link tạo ra để mời bot vào server của bạn
4. Trong Discord: bật Developer Mode (Cài đặt > Nâng cao), chuột phải vào kênh muốn nhận
   thông báo → Copy Channel ID (đây là `CHANNEL_ID`)

## 2. Đưa code lên GitHub
Upload `index.js`, `package.json`, `README.md` vào 1 repo GitHub mới.
**Không cần upload file biến môi trường** — bước sau sẽ nhập trực tiếp trên Render.
(`env.example.txt` chỉ để bạn xem trước danh sách biến cần điền, không bắt buộc upload)

## 3. Deploy lên Render (miễn phí)
1. Vào https://render.com → New → Web Service → chọn repo vừa tạo
2. Build Command: `npm install`
   Start Command: `npm start`
   Instance Type: **Free**
3. Mục **Environment Variables**, thêm từng biến (Key / Value), không dùng file:
   - `DISCORD_TOKEN` = token bot ở bước 1
   - `CHANNEL_ID` = ID kênh ở bước 1
   - `TIKTOK_USERNAME` = username TikTok (không có @)
   - `CHECK_INTERVAL_MS` = `120000` (tuỳ chọn)
4. Bấm **Create Web Service**, đợi deploy xong, xem tab **Logs** thấy
   `Bot online: ...` là thành công.

## 4. Chống Render free tier ngủ
Copy URL Render cấp (dạng `https://ten-app.onrender.com`) → vào
https://uptimerobot.com tạo monitor HTTP(s) ping URL đó mỗi 5 phút.

## Lưu ý quan trọng
- `tiktok-live-connector` và phần lấy video mới nhất đều dựa vào cấu trúc trang
  TikTok hiện tại (không phải API chính thức). TikTok có thể đổi cấu trúc bất kỳ lúc
  nào khiến `fetchLatestVideo` trong `index.js` bị lỗi — khi đó cần cập nhật lại
  đoạn regex/parse JSON.
- Phần phát hiện LIVE thường ổn định hơn vì dùng kết nối signaling thật của TikTok.
- Nếu bị TikTok chặn IP tạm thời (rate limit), tăng `CHECK_INTERVAL_MS` lên (vd 5 phút).

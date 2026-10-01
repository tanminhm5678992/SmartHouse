# CẨM NANG HƯỚNG DẪN ĐI DÂY & KHỞI CHẠY DỰ ÁN SMART HOME IoT

---

## PHẦN 1: CÁCH NỐI DÂY PHẦN CỨNG (CHO 2 BOARD ESP32-C3)

### 1. Board 1: Trạm Phòng Khách (ESP32 #1)
- **Cảm biến DHT11**:
  - `VCC` (+) ──► Chân `3V3` của ESP32
  - `GND` (-) ──► Chân `GND` của ESP32
  - `DATA` (OUT/S) ──► Chân `GPIO 4` của ESP32
- **Cục Relay 1**:
  - `DC+` ──► Chân `5V` (hoặc `VIN`) của ESP32
  - `IN` ──► Chân `GPIO 5` của ESP32
  - `DC-` (có 2 sợi): Lấy 1 sợi cắm vào `GND` của ESP32, sợi thứ 2 để trống
- **Đèn LED 1 (Đèn bàn)**:
  - Chân dài (+) qua 1 điện trở 220Ω ──► Chân `GPIO 6` của ESP32
  - Chân ngắn (-) ──► Chân `GND` của ESP32

---

### 2. Board 2: Trạm Phòng Ngủ (ESP32 #2)
- **Cảm biến DHT11**:
  - `VCC` (+) ──► Chân `3V3` của ESP32
  - `GND` (-) ──► Chân `GND` của ESP32
  - `DATA` (OUT/S) ──► Chân `GPIO 4` của ESP32
- **Đèn LED 2 (Đèn ngủ)**:
  - Chân dài (+) qua 1 điện trở 220Ω ──► Chân `GPIO 6` của ESP32
  - Chân ngắn (-) ──► Chân `GND` của ESP32

---

## PHẦN 2: CÁC BƯỚC KHỞI CHẠY HỆ THỐNG

### Bước 1: Khởi động hệ thống Broker (Kiến trúc 5 tầng)
Mở Docker Desktop, sau đó mở Terminal chạy:
```powershell
docker compose up -d broker_local broker_server
```
- **Broker Local** (Mosquitto) lắng nghe cổng `1883` (cho ESP32).
- **Broker Server** (EMQX) lắng nghe cổng `1884` và Dashboard tại `http://localhost:18083`.
- Hai broker tự động nối với nhau bằng cầu Bridge.

---

### Bước 2: Khởi động Backend
Mở Terminal, di chuyển vào thư mục backend và chạy:
```powershell
cd d:\HocTap\IoT\BaoCao\smarthouse\backend
npm start
```
Server chạy tại cổng `4000`, tự động kết nối vào Broker Server.

---

### Bước 3: Khởi động Frontend React
Mở một tab Terminal mới:
```powershell
cd d:\HocTap\IoT\BaoCao\smarthouse\frontend
npm run dev
```
Mở trình duyệt truy cập: `http://localhost:3000`.

---

### Bước 4: Nạp Code cho 2 Board ESP32 (Arduino IDE)
1. Chạy lệnh `ipconfig` trên Terminal để lấy địa chỉ IPv4 máy tính (ví dụ: `192.168.1.15`).
2. Mở Arduino IDE:
   - **Board 1**: Mở `firmware/node1_living_room/node1_living_room.ino`
     - Điền WiFi SSID, Password và IP máy tính (`MQTT_BROKER = "192.168.1.15"`).
     - Cắm Board 1 và nhấn **Upload**.
   - **Board 2**: Mở `firmware/node2_bed_room/node2_bed_room.ino`
     - Điền WiFi SSID, Password và IP máy tính tương tự.
     - Cắm Board 2 và nhấn **Upload**.

---

## PHẦN 3: KIỂM TRA 3 TÍNH NĂNG BẮT BUỘC TRÊN WEB

1. **Xem Telemetry**: Trên trang chủ và tab "Đồ Thị Cảm Biến", kiểm tra nhiệt độ và độ ẩm nhảy realtime.
2. **Gửi lệnh**: Bấm nút bật/tắt Relay 1 hoặc LED trên màn hình để thấy tiếp điểm relay nhảy tạch và đèn LED sáng.
3. **Đăng ký thiết bị**: Bấm tab "Đăng Ký Thiết Bị" để thêm mới một thiết bị IoT vào cơ sở dữ liệu.

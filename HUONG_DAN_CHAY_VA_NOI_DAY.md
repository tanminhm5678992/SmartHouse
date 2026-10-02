# CẨM NANG HƯỚNG DẪN NỐI DÂY & KHỞI CHẠY DỰ ÁN SMART HOME IoT

---

## PHẦN 1: CÁCH NỐI DÂY PHẦN CỨNG (DÙNG 2 BOARD ESP32-C3)

> 💡 **Giải pháp thông minh**: 
> - Mỗi chân chỉ cắm đúng 1 lỗ, không cần bảng testboard, không cần xoắn dây.
> - Chân ngắn (-) của LED được cắm vào **GPIO 3** (đã được cấu hình trong code làm chân GND ảo xuất mức 0V).

---

### 🛋️ 1. BOARD 1: PHÒNG KHÁCH (ESP32 #1)
> **Linh kiện**: 1x ESP32-C3 + 1x Cục Relay + 1x Cảm biến DHT11 + 1x Đèn LED (+ điện trở 220Ω)

```
   CỤC RELAY 1                   ESP32-C3 BOARD 1
  ┌──────────────┐              ┌────────────────┐
  │          DC+ ├──────────────┤ 5V (hoặc VIN)  │
  │           IN ├──────────────┤ GPIO 5         │
  │  DC- (Sợi 1) ├──────────────┤ G              │
  │  DC- (Sợi 2) ├──┐           │                │
  └──────────────┘  │           │                │
   CẢM BIẾN DHT11   │           │                │
  ┌──────────────┐  │           │                │
  │  VCC (dấu +) ├──┼───────────┤ 3V3            │
  │ DATA (dấu S) ├──┼───────────┤ GPIO 4         │
  │  GND (dấu -) ├──┘           │                │
  └──────────────┘              │                │
   BÓNG ĐÈN LED 1               │                │
  ┌──────────────┐              │                │
  │ Chân dài (+) ├──[Trở 220Ω]──┤ GPIO 6         │
  │ Chân ngắn(-) ├──────────────┤ GPIO 3 (GND ảo)│
  └──────────────┘              └────────────────┘
```

#### Chi tiết cắm từng sợi dây:
1. **Nối Relay**:
   - `DC+` ──► Cắm vào chân **5V (hoặc VIN)** của ESP32.
   - `IN` ──► Cắm vào chân **GPIO 5** của ESP32.
   - Chân `DC-` (có 2 sợi dây nhô ra):
     - **Sợi 1**: Cắm vào chân **`G`** của ESP32.
     - **Sợi 2**: Cắm sang chân **`GND`** của cảm biến DHT11.
2. **Nối Cảm biến DHT11**:
   - `VCC` (hoặc `+`) ──► Cắm vào chân **3V3** của ESP32.
   - `DATA` (hoặc `OUT`/`S`) ──► Cắm vào chân **GPIO 4** của ESP32.
   - `GND` (hoặc `-`) ──► Nhận từ **Sợi 2 của Relay** ở trên.
3. **Nối Đèn LED 1**:
   - Chân dài `(+)` qua 1 điện trở 220Ω ──► Cắm vào chân **GPIO 6** của ESP32.
   - Chân ngắn `(-)` ──► Cắm vào chân **GPIO 3** của ESP32.

---

### 🛏️ 2. BOARD 2: PHÒNG NGỦ (ESP32 #2)
> **Linh kiện**: 1x ESP32-C3 + 1x Cảm biến DHT11 + 1x Đèn LED (+ điện trở 220Ω)

```
   CẢM BIẾN DHT11                ESP32-C3 BOARD 2
  ┌──────────────┐              ┌────────────────┐
  │  VCC (dấu +) ├──────────────┤ 3V3            │
  │  GND (dấu -) ├──────────────┤ G              │
  │ DATA (dấu S) ├──────────────┤ GPIO 4         │
  └──────────────┘              │                │
   BÓNG ĐÈN LED 2               │                │
  ┌──────────────┐              │                │
  │ Chân dài (+) ├──[Trở 220Ω]──┤ GPIO 6         │
  │ Chân ngắn(-) ├──────────────┤ GPIO 3 (GND ảo)│
  └──────────────┘              └────────────────┘
```

#### Chi tiết cắm từng sợi dây:
1. **Nối Cảm biến DHT11**:
   - `VCC` (hoặc `+`) ──► Cắm vào chân **3V3** của ESP32 Con 2.
   - `GND` (hoặc `-`) ──► Cắm vào chân **`G`** của ESP32 Con 2.
   - `DATA` (hoặc `OUT`/`S`) ──► Cắm vào chân **GPIO 4** của ESP32 Con 2.
2. **Nối Đèn LED 2 (Đèn ngủ)**:
   - Chân dài `(+)` qua 1 điện trở 220Ω ──► Cắm vào chân **GPIO 6** của ESP32 Con 2.
   - Chân ngắn `(-)` ──► Cắm vào chân **GPIO 3** của ESP32 Con 2.

---

## PHẦN 2: CÁC BƯỚC KHỞI CHẠY HỆ THỐNG

---

### BƯỚC 1: Khởi động hệ thống Docker (Broker Local, Broker Server & Database)
1. Mở ứng dụng **Docker Desktop** trên máy tính (chờ biểu tượng góc dưới chuyển sang màu xanh lá).
2. Mở một cửa sổ Terminal (PowerShell) tại thư mục dự án và chạy lệnh:
   ```powershell
   docker compose up -d broker_local broker_server postgres
   ```
- **Broker Local** (Mosquitto): Cổng `1883` (dành cho ESP32 mạng nội bộ).
- **Broker Server** (EMQX): Cổng `1884` (Dashboard tại `http://localhost:18083`).
- **PostgreSQL**: Cổng `5433` (lưu trữ dữ liệu).

---

### BƯỚC 2: Khởi động Backend API
Mở Terminal, di chuyển vào thư mục backend và chạy server:
```powershell
cd d:\HocTap\IoT\BaoCao\smarthouse\backend
npm start
```
Terminal hiện các dòng thông báo thành công:
```text
===============================================
[SmartHome Backend] Server chạy tại cổng : 4000
===============================================
[MQTT] Đã kết nối thành công tới EMQX Broker!
[MQTT] Đã subscribe: home/sensor/+/telemetry
[MQTT] Đã subscribe: home/sensor/+/status
[MQTT] Đã subscribe: home/device/+/state
```

---

### BƯỚC 3: Khởi động Giao diện Web React
Mở **thêm một cửa sổ Terminal mới**, chạy lệnh:
```powershell
cd d:\HocTap\IoT\BaoCao\smarthouse\frontend
npm run dev
```
Mở trình duyệt web truy cập địa chỉ: **[http://localhost:3000](http://localhost:3000)**.

---

### BƯỚC 4: Nạp Code cho 2 Board ESP32 (Arduino IDE)

#### 1. Lấy địa chỉ IP máy tính:
- Mở Terminal gõ lệnh: `ipconfig`
- Tìm dòng **IPv4 Address** của card mạng WiFi (Ví dụ: `192.168.1.15`).

#### 2. Nạp Board 1 (Phòng Khách):
- Mở **Arduino IDE**, mở file [node1_living_room.ino](firmware/node1_living_room/node1_living_room.ino).
- Sửa thông tin WiFi và IP máy tính:
  ```cpp
  const char* WIFI_SSID     = "TÊN_WIFI_NHÀ_BẠN";
  const char* WIFI_PASSWORD = "MẬT_KHẨU_WIFI";
  const char* MQTT_BROKER   = "192.168.1.15"; // Thay bằng IP máy tính của bạn
  ```
- Cắm cáp USB nối Board 1 vào máy tính. Chọn Board **ESP32C3 Dev Module**, chọn đúng cổng COM và nhấn nút **Upload**.

#### 3. Nạp Board 2 (Phòng Ngủ):
- Mở file [node2_bed_room.ino](firmware/node2_bed_room/node2_bed_room.ino).
- Sửa WiFi và IP máy tính tương tự như trên.
- Rút Board 1 ra, cắm Board 2 vào cáp USB và nhấn **Upload**.

---

## PHẦN 3: KIỂM THỬ 3 CHỨC NĂNG BẮT BUỘC TRÊN WEB (SLIDE 18)

Sau khi nạp code và chạy web `http://localhost:3000`, bạn kiểm tra 3 chức năng:

1. **Xem Telemetry (Nhiệt độ & Độ ẩm thời gian thực)**:
   - Trên Dashboard và tab **"Đồ Thị Cảm Biến"**, thông số nhiệt/ẩm của cả 2 phòng nhảy số liên tục theo chu kỳ 5 giây.
2. **Gửi lệnh (Điều khiển thiết bị)**:
   - Bấm nút công tắc **Relay 1** trên màn hình ──► Cục Relay thật trên mạch nhảy **"TẠCH"** và đèn đỏ sáng lên.
   - Bấm công tắc **LED 1** hoặc **LED 3** trên màn hình ──► Đèn LED thật trên mạch bật/tắt theo.
3. **Đăng ký thiết bị (Slide 18 yêu cầu)**:
   - Bấm sang tab **"ĐĂNG KÝ THIẾT BỊ"**, bấm nút **"Đăng ký thiết bị mới"** để điền form thêm một thiết bị vào hệ thống.

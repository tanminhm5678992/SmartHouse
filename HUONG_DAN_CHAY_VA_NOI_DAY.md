# CẨM NANG HƯỚNG DẪN NỐI DÂY & KHỞI CHẠY DỰ ÁN SMART HOME IoT

---

## PHẦN 1: CÁCH NỐI DÂY PHẦN CỨNG (DÙNG 2 BOARD ESP32-C3)

> 💡 **Giải pháp thông minh**:
> - Mỗi chân ESP32 chỉ cắm đúng **1 lỗ duy nhất**, không dùng bảng testboard, không xoắn dây.
> - Dùng GPIO xuất 3.3V (VCC ảo) và 0V (GND ảo) cho linh kiện nhỏ → mỗi chân phần cứng 1 dây.

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
> **Linh kiện**: 1x ESP32-C3 + 1x Module Relay 1 kênh + 1x Quạt mini 5V + 1x Đèn LED (2 chân) + 1x điện trở 220Ω *(Node 2 KHÔNG có cảm biến DHT11)*

```
   MODULE RELAY 1 KÊNH              ESP32-C3 BOARD 2 (PHÒNG NGỦ)
  ┌──────────────┐                 ┌──────────────────────┐
  │          VCC ├─────────────────┤ 5V   ← nguồn relay   │
  │          GND ├─────────────────┤ G    ← mass chung    │
  │           IN ├─────────────────┤ GPIO 4 ← điều khiển  │
  │          COM ├──(jumper VCC)   │                      │
  │           NO ├──┐              │                      │
  └──────────────┘  │              │                      │
   QUẠT MINI 5V     │              │                      │
  ┌──────────────┐  │              │                      │
  │  Dây (+)     ├──┘              │                      │
  │  Dây (-)     ├─────────────────┤ G (GND chung)        │
  └──────────────┘                 │                      │
   BÓNG ĐÈN LED                    │                      │
  ┌──────────────┐                 │                      │
  │ Chân dài (+) ├──[Trở 220Ω]─────┤ GPIO 5 (PWM)         │
  │ Chân ngắn(-) ├─────────────────┤ G (GND chung)        │
  └──────────────┘                 └──────────────────────┘
```

> ✅ **Dòng điện quạt**: `5V → VCC (relay) → COM → (relay đóng) → NO → Quạt (+) → Quạt (-) → GND`.
> - `GPIO 4` điều khiển relay (module relay Node 2 là loại Active HIGH: `HIGH` = relay đóng = quạt chạy, `RELAY_ACTIVE_LOW false` trong firmware; nếu dùng module khác mà web bật/tắt bị ngược thì đổi cờ này).
> - `GPIO 5` xuất PWM → điều chỉnh độ sáng LED 0-100% (qua điện trở 220Ω).
> - `GPIO 8` là LED mạng tích hợp sẵn trên board, không cần nối dây.

#### Chi tiết cắm từng sợi dây:
1. **Nối Module Relay → Quạt**:
   - `VCC` ──► Cắm vào chân **`5V`** của ESP32.
   - `VCC` ──► Nối jumper ngắn sang **`COM`** của relay *(đưa 5V sang COM)*.
   - `GND` ──► Cắm vào chân **`G`** của ESP32.
   - `IN`  ──► Cắm vào chân **`GPIO 4`** của ESP32.
   - `NO`  ──► Nối sang **Dây (+)** của quạt mini.
   - **Dây (-)** của quạt ──► Nối chung với `GND` của relay (chân **`G`**).
2. **Nối Đèn LED** *(có điện trở 220Ω nối tiếp)*:
   - `GPIO 5` ──► Điện trở 220Ω ──► Chân dài `(+)` của LED.
   - Chân ngắn `(-)` của LED ──► **`GND`** (chung với relay/quạt).

#### Tổng kết chân ESP32 Node 2:
| Chân ESP32 | Nối với | Ghi chú |
|---|---|---|
| `GPIO 4` | Relay IN | Điều khiển quạt (Active HIGH) |
| `GPIO 5` | Điện trở 220Ω → LED (+) | PWM điều chỉnh độ sáng |
| `GPIO 8` | LED mạng tích hợp | Nội bộ, tự động |
| `5V` | Relay VCC (và COM qua jumper) | Nguồn relay + nguồn quạt |
| `G` | Relay GND, Quạt (-), LED (-) | Mass chung |

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
   - Trên Dashboard và tab **"Đồ Thị Cảm Biến"**, thông số nhiệt/ẩm của **phòng khách (Node 1)** nhảy số liên tục theo chu kỳ 5 giây. *(Node 2 – Phòng Ngủ không có DHT11 nên không có số liệu nhiệt/ẩm.)*
2. **Gửi lệnh (Điều khiển thiết bị)**:
   - Bấm nút công tắc **Relay 1** trên màn hình ──► Cục Relay thật trên mạch nhảy **"TẠCH"** và đèn đỏ sáng lên.
   - Bấm công tắc **LED 1** hoặc **LED 3** trên màn hình ──► Đèn LED thật trên mạch bật/tắt theo (kéo thanh trượt để chỉnh độ sáng).
   - Bấm công tắc **Quạt mini (Relay 2)** ──► Relay Node 2 nhảy **"TẠCH"** và quạt chạy/dừng.
3. **Đăng ký thiết bị (Slide 18 yêu cầu)**:
   - Bấm sang tab **"ĐĂNG KÝ THIẾT BỊ"**, bấm nút **"Đăng ký thiết bị mới"** để điền form thêm một thiết bị vào hệ thống.

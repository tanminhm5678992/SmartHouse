# Hệ Thống Smart Home IoT - ESP32-C3 & MQTT EMQX

Dự án Nhà thông minh hoàn chỉnh với kiến trúc phân tán theo phòng, tích hợp **ESP32-C3**, **MQTT Broker (EMQX)**, **Backend Node.js/Express**, **PostgreSQL (Prisma ORM)** và **Giao diện ReactJS**.

---

## 1. Phân Bổ Phần Cứng & Sơ Đồ Chân (Pinout)

Hệ thống sử dụng **2 trạm ESP32-C3**:

### 🛋️ Trạm Node 1: Phòng Khách (`firmware/node1_living_room/`)
- **1x Cảm biến DHT11**: Chân Data kết nối **GPIO 4** (Nguồn 3.3V & GND, kèm trở kéo 4.7k - 10k nếu cần).
- **1x Module Relay 1 (Đèn trần/Quạt)**: Chân IN kết nối **GPIO 5** (Nguồn 5V/VIN & GND).
- **1x LED 1 (Đèn bàn làm việc)**: Cực dương qua trở 220Ω kết nối **GPIO 6**, cực âm nối GND.
- **1x LED 2 (Chỉ báo WiFi/MQTT)**: Cực dương qua trở 220Ω kết nối **GPIO 7**, cực âm nối GND.

### 🛏️ Trạm Node 2: Phòng Ngủ (`firmware/node2_bed_room/`)
- **Không có cảm biến DHT11** (Node 2 chỉ điều khiển thiết bị, không gửi telemetry nhiệt độ/độ ẩm).
- **1x Module Relay 2 (Quạt mini 5V)**: Chân IN kết nối **GPIO 4**; `5V` → VCC và COM (jumper), `GND` → G, `NO` → dây (+) quạt, dây (-) quạt → GND.
- **1x LED 3 (Đèn ngủ, chỉnh độ sáng PWM)**: Cực dương qua trở 220Ω kết nối **GPIO 5**, cực âm nối GND.
- **LED mạng tích hợp**: **GPIO 8** (LED có sẵn trên board, báo trạng thái WiFi/MQTT).

> ⚠️ **Lưu ý ESP32-C3**: Tuyệt đối không nối Relay vào **GPIO 2, 8, 9** vì đây là các chân Strapping Pin nạp bootloader. (Ở Node 2, GPIO 8 chỉ dùng cho LED tích hợp, không nối relay.)

---

## 2. Các Cổng Dịch Vụ (Ports)

| Dịch vụ | Cổng (Port) | Địa chỉ truy cập | Ghi chú |
| :--- | :---: | :--- | :--- |
| **ReactJS Frontend** | `3000` | [http://localhost:3000](http://localhost:3000) | Giao diện điều khiển chính (Dark Mode Glassmorphism) |
| **Backend REST & Socket.IO** | `4000` | [http://localhost:4000/api](http://localhost:4000/api) | API Server + WebSocket |
| **EMQX Dashboard** | `18083` | [http://localhost:18083](http://localhost:18083) | Tài khoản mặc định: `admin` / `public` |
| **Mosquitto Broker Local** | `1883` | `localhost:1883` | Cổng TCP cho ESP32 mạng nội bộ kết nối (Tầng 2 - Gateway) |
| **EMQX Broker Server** | `1884` | `localhost:1884` | Cổng TCP cho Backend kết nối Broker Server (Tầng 3) |
| **PostgreSQL (Docker)** | `5433` | `localhost:5433` | Database Docker (cổng 5433 tránh đụng Postgres 5432 máy thật) |

---

## 3. Hướng Dẫn Chạy Toàn Bộ Hệ Thống Với Docker

Đảm bảo **Docker Desktop** đã được mở trên máy tính của bạn. Mở Terminal (PowerShell) tại thư mục dự án và chạy:

```bash
docker compose up -d --build
```

Docker sẽ tự động:
1. Kéo image **EMQX 5.6**, **PostgreSQL 16**.
2. Build container **Backend** (tự động chạy Prisma migration đẩy schema vào database và khởi tạo dữ liệu mẫu).
3. Build container **Frontend** với Vite và phục vụ qua Nginx.

Để xem log của các dịch vụ:
```bash
docker compose logs -f backend
```

Để dừng hệ thống:
```bash
docker compose down
```

---

## 4. Nạp Code Cho 2 ESP32-C3 (Arduino IDE)

1. Mở **Arduino IDE** (đã có sẵn trên máy của bạn).
2. Vào **Tools -> Manage Libraries** và cài đặt các thư viện:
   - `PubSubClient` (Nick O'Leary) — dùng cho cả 2 node
   - `DHT sensor library` (Adafruit) — chỉ Node 1
   - `ArduinoJson` (Benoit Blanchon) — chỉ Node 1 (Node 2 chỉ cần `PubSubClient`)
3. Mở file [node1_living_room.ino](file:///d:/HocTap/IoT/BaoCao/smarthouse/firmware/node1_living_room/node1_living_room.ino) và sửa thông tin WiFi & IP Broker:
   ```cpp
   const char* WIFI_SSID     = "TÊN_WIFI_NHÀ_BẠN";
   const char* WIFI_PASSWORD = "MẬT_KHẨU_WIFI";
   const char* MQTT_BROKER   = "192.168.1.XXX"; // Thay bằng IP WiFi của máy tính chạy Docker
   ```
4. Chọn Board: **ESP32C3 Dev Module** (hoặc ESP32-C3 Super Mini), chọn đúng cổng COM và nhấn **Upload**.
5. Làm tương tự với [node2_bed_room.ino](file:///d:/HocTap/IoT/BaoCao/smarthouse/firmware/node2_bed_room/node2_bed_room.ino) cho board thứ 2.

---

## 5. Thử Nghiệm Mô Phỏng Bằng MQTTX (Khi chưa cắm mạch thật)

Nếu chưa cắm ESP32 thật, bạn có thể dùng công cụ **MQTTX** trên máy để giả lập dữ liệu:
1. Kết nối tới Broker Local (Mosquitto): `Host: localhost`, `Port: 1883`.
2. Giả lập gửi nhiệt độ & độ ẩm phòng khách:
   - Topic: `home/sensor/node1/telemetry`
   - Payload (JSON):
     ```json
     { "temp": 33.5, "hum": 70.2 }
     ```
3. Lập tức kiểm tra:
   - Web Frontend tại `http://localhost:3000` sẽ cập nhật số đo và vẽ đường đồ thị realtime.
   - Nếu nhiệt độ > 32°C, hệ thống sẽ tự động kích hoạt luật bật Relay 1 và ghi nhật ký hoạt động!

---

## 6. Tính Năng Mở Rộng (Mới Cập Nhật)

### 6.1. Bật/Tắt Thiết Bị Theo Lịch (Scheduler)
- Tab **"Lịch Hẹn"** trên giao diện cho phép tạo lịch hẹn gồm: **Giờ BẬT**, **Giờ TẮT**, chọn **ngày áp dụng** trong tuần (T2...CN) và thiết bị áp dụng.
- Có thể bật/tắt, chỉnh sửa hoặc xóa từng lịch hẹn.
- Backend chạy bộ lập lịch quét mỗi **20 giây** (xem `backend/src/services/scheduleService.js`), khi tới giờ sẽ tự gửi lệnh MQTT, cập nhật CSDL và ghi vào **Nhật Ký Hoạt Động** với nguồn `auto`.
- Lịch hẹn chạy theo giờ hệ thống (múi giờ Asia/Ho_Chi_Minh), đã chống kích hoạt trùng trong cùng một phút.

### 6.2. Thanh Tùy Chỉnh Độ Sáng Đèn LED (PWM)
- Thẻ thiết bị loại `led` hiển thị **thanh trượt độ sáng 0-100%** trên Dashboard.
- Backend gửi lệnh MQTT dạng `SET:<0-100>` tới topic `home/device/<slug>/command` (ví dụ `SET:50`).
- Firmware ESP32 dùng **PWM (LEDC)** để điều chế độ sáng; hỗ trợ cả Arduino-ESP32 core 2.x (`ledcSetup`/`ledcAttachPin`) và 3.x (`ledcAttach`).
- **Định dạng lệnh MQTT điều khiển thiết bị:**

  | Payload | Ý nghĩa |
  | :---: | :--- |
  | `ON` | Bật thiết bị (LED sáng 100%) |
  | `OFF` | Tắt thiết bị (LED duty 0%) |
  | `SET:0` ... `SET:100` | Chỉnh độ sáng LED theo phần trăm (PWM) |

### 6.3. Cập Nhật Cơ Sở Dữ Liệu
Schema có thêm cột `devices.brightness` và bảng `schedules`. Chạy 1 trong 2 cách sau để áp dụng:
```bash
# Cách 1: Chạy lại toàn bộ bằng Docker (tự động chạy prisma db push)
docker compose up -d --build

# Cách 2: Cập nhật schema trực tiếp khi chạy backend trên máy
cd backend
npx prisma db push
```

### 6.4. Đăng Nhập Hệ Thống (JWT) & Quản Lý Người Dùng
- Người dùng **bắt buộc đăng nhập** trước khi truy cập Dashboard; API và kênh Socket.IO đều yêu cầu JWT hợp lệ.
- **Tài khoản mặc định:** `admin` / `admin` (được tự động tạo khi khởi động backend, mật khẩu lưu dạng băm bcrypt trong bảng `users` của PostgreSQL; hệ thống tự migrate mật khẩu mặc định cũ `123` → `admin`).
- **Quyền truy cập (role):**

  | Role | Nhãn hiển thị | Quyền |
  | :--- | :--- | :--- |
  | `admin` | Quản trị viên | Xem **tất cả** các trang, bao gồm trang **Quản Lý Người Dùng** |
  | `manager` | Quản lý | Đăng nhập vào hệ thống bình thường, **không** thấy trang quản lý người dùng |
  | `user` | Người dùng | Đăng nhập vào hệ thống bình thường, **không** thấy trang quản lý người dùng |

- Luồng hoạt động:
  1. Frontend gọi `POST /api/auth/login` → backend đối chiếu mật khẩu với CSDL → trả về `token` JWT (hết hạn sau `JWT_EXPIRES_IN`, mặc định 1 ngày).
  2. Token được lưu trong `localStorage` và tự động gắn vào header `Authorization: Bearer <token>` cho mọi request (axios interceptor).
  3. Khi token hết hạn (HTTP 401), hệ thống tự đăng xuất và quay về trang đăng nhập.
  4. Socket.IO gửi token qua `socket.handshake.auth.token`; client không hợp lệ sẽ bị từ chối kết nối.
- **Quản lý người dùng (chỉ `admin`):** tab *Quản Lý Người Dùng* chỉ hiển thị cho admin; server bảo vệ bằng middleware `requireAdmin` (đọc role mới nhất từ DB, trả `403` nếu không phải admin). Admin có thể: thêm người dùng mới, đổi quyền giữa `user` ↔ `manager`, đặt lại mật khẩu, xóa tài khoản. Admin **không thể** tự hạ quyền/xóa chính mình (tránh mất quyền quản trị).
- Các biến cấu hình: `JWT_SECRET` và `JWT_EXPIRES_IN` (đã khai báo trong `backend/.env` và `docker-compose.yml` — **nên đổi `JWT_SECRET` khi triển khai thật**).
- API liên quan:

  | Method | Endpoint | Mô tả | Quyền |
  | :--- | :--- | :--- | :--- |
  | `POST` | `/api/auth/login` | Đăng nhập, nhận `{ token, user }` | Công khai |
  | `GET` | `/api/auth/me` | Kiểm tra token, lấy thông tin user hiện tại | Đã đăng nhập |
  | `GET` | `/api/users` | Danh sách người dùng | `admin` |
  | `POST` | `/api/users` | Thêm người dùng mới `{ username, password, role }` | `admin` |
  | `PUT` | `/api/users/:id` | Đổi quyền `{ role }` và/hoặc đặt lại mật khẩu `{ password }` | `admin` |
  | `DELETE` | `/api/users/:id` | Xóa người dùng (không xóa được chính mình) | `admin` |



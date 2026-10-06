require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const bcrypt = require('bcryptjs');

const prisma = require('./config/prisma');
const { authenticate, socketAuthenticate } = require('./middleware/auth');
const { initSocket } = require('./sockets/socketHandler');
const { connectMQTT } = require('./mqtt/mqttClient');
const { startScheduler } = require('./services/scheduleService');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const deviceRoutes = require('./routes/deviceRoutes');
const sensorRoutes = require('./routes/sensorRoutes');
const automationRoutes = require('./routes/automationRoutes');
const scheduleRoutes = require('./routes/scheduleRoutes');
const logRoutes = require('./routes/logRoutes');

const app = express();
const server = http.createServer(app);

// CORS & Middlewares
// Cho phép mọi origin: API đều được bảo vệ bằng JWT (trừ /api/auth/login và /api/health),
// đồng thời chấp nhận truy cập Web qua cả localhost lẫn IP LAN khi demo trên điện thoại.
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// Socket.IO
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});
// Chỉ cho phép client đã đăng nhập (có JWT hợp lệ) kết nối realtime
io.use(socketAuthenticate);
initSocket(io);

// API Routes
app.use('/api/auth', authRoutes); // Đăng nhập (công khai)
app.use('/api/users', authenticate, userRoutes); // Quản lý người dùng (chỉ admin, kiểm tra trong router)
app.use('/api/devices', authenticate, deviceRoutes);
app.use('/api/sensors', authenticate, sensorRoutes);
app.use('/api/automations', authenticate, automationRoutes);
app.use('/api/schedules', authenticate, scheduleRoutes);
app.use('/api/logs', authenticate, logRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Mô tả đấu dây Node 2 (khớp firmware/node2_bed_room/node2_bed_room.ino)
const NODE2_FAN_DESC = 'GPIO 4 → IN Relay | 5V → VCC & COM Relay | G → GND Relay | NO Relay → Quạt (+) | Quạt (-) → GND';
const NODE2_LED_DESC = 'GPIO 5 → điện trở 220Ω → chân dài (+) LED | Chân ngắn (-) LED → GND';

// Tạo tài khoản mặc định admin / admin nếu chưa tồn tại (mật khẩu được băm bcrypt)
async function seedDefaultAdmin() {
  try {
    const existing = await prisma.user.findUnique({ where: { username: 'admin' } });

    if (!existing) {
      const passwordHash = await bcrypt.hash('admin', 10);
      await prisma.user.create({
        data: { username: 'admin', passwordHash, role: 'admin' },
      });
      console.log('[Seed] Đã tạo tài khoản mặc định: admin / admin');
      return;
    }

    // Migrate mật khẩu mặc định cũ (admin/123) sang mật khẩu mới admin/admin.
    // Không đụng vào mật khẩu do người dùng tự đặt (khác cả 123 lẫn admin).
    const isOldDefault = await bcrypt.compare('123', existing.passwordHash);
    const isNewDefault = await bcrypt.compare('admin', existing.passwordHash);
    if (isOldDefault && !isNewDefault) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash: await bcrypt.hash('admin', 10) },
      });
      console.log('[Seed] Đã cập nhật mật khẩu mặc định của admin: "123" → "admin"');
    }

    // Đảm bảo tài khoản admin luôn có quyền admin
    if (existing.role !== 'admin') {
      await prisma.user.update({ where: { id: existing.id }, data: { role: 'admin' } });
      console.log('[Seed] Đã khôi phục quyền admin cho tài khoản admin');
    }
  } catch (err) {
    console.error('[Seed Error] Tạo tài khoản admin thất bại:', err.message);
  }
}

// Hàm khởi tạo dữ liệu mẫu nếu database trống
async function seedInitialData() {
  try {
    const count = await prisma.device.count();
    if (count === 0) {
      console.log('[Seed] Database chưa có thiết bị, đang khởi tạo dữ liệu mặc định...');

      const devices = [
        // Node 1 - Phòng Khách (ESP32 #1)
        { name: 'Relay 1: Đèn trần Phòng Khách', type: 'relay', mqttTopic: 'home/device/relay1', nodeId: 'node1', pin: 'GPIO 5', description: 'Chân IN cắm GPIO 5 (Nguồn 5V, DC- cắm G)', state: 'OFF' },
        { name: 'LED 1: Đèn bàn làm việc', type: 'led', mqttTopic: 'home/device/led1', nodeId: 'node1', pin: 'GPIO 6', description: 'Chân (+) cắm GPIO 6, chân (-) cắm GPIO 3 (0V)', state: 'OFF' },
        // Node 2 - Phòng Ngủ (ESP32 #2)
        { name: 'Quạt mini 5V Phòng Ngủ (Relay 2)', type: 'fan', mqttTopic: 'home/device/relay2', nodeId: 'node2', pin: 'GPIO 4', description: NODE2_FAN_DESC, state: 'OFF' },
        { name: 'LED 3: Đèn ngủ', type: 'led', mqttTopic: 'home/device/led3', nodeId: 'node2', pin: 'GPIO 5', description: NODE2_LED_DESC, state: 'OFF' },
      ];

      for (const d of devices) {
        await prisma.device.create({ data: d });
      }

      // Tạo 1 rule mẫu
      const relay1 = await prisma.device.findFirst({ where: { mqttTopic: 'home/device/relay1' } });
      if (relay1) {
        await prisma.automation.create({
          data: {
            name: 'Bật đèn khi nhiệt độ phòng khách > 32°C',
            sensorNode: 'node1',
            metric: 'temperature',
            operator: '>',
            threshold: 32.0,
            targetDeviceId: relay1.id,
            action: 'ON',
            enabled: true,
          },
        });
      }

      console.log('[Seed] Đã khởi tạo thành công 4 thiết bị (Relay 1, LED 1, Quạt Node 2, LED 3) và 1 luật tự động!');
    } else {
      // Cập nhật thông tin chân cắm cho các thiết bị cũ nếu chưa có
      const defaultPins = [
        { topic: 'home/device/relay1', pin: 'GPIO 5', desc: 'Chân IN cắm GPIO 5 (Nguồn 5V, DC- cắm G)' },
        { topic: 'home/device/led1', pin: 'GPIO 6', desc: 'Chân (+) cắm GPIO 6, chân (-) cắm GPIO 3 (0V)' },
        { topic: 'home/device/relay2', pin: 'GPIO 4', desc: NODE2_FAN_DESC },
        { topic: 'home/device/led3', pin: 'GPIO 5', desc: NODE2_LED_DESC },
      ];
      for (const p of defaultPins) {
        await prisma.device.updateMany({
          where: { mqttTopic: p.topic, pin: null },
          data: { pin: p.pin, description: p.desc },
        });
      }

      // Đồng bộ chân cắm Node 2 theo firmware mới (relay quạt GPIO 4, LED PWM GPIO 5)
      // Chỉ cập nhật các bản ghi còn mang chân cắm mặc định cũ, không ghi đè chân do người dùng tự sửa
      await prisma.device.updateMany({
        where: { mqttTopic: 'home/device/relay2', nodeId: 'node2', pin: { in: ['GPIO 5', 'GPIO 5 & 5V'] } },
        data: { pin: 'GPIO 4', description: NODE2_FAN_DESC },
      });
      await prisma.device.updateMany({
        where: { mqttTopic: 'home/device/led3', nodeId: 'node2', pin: { in: ['GPIO 6', 'GPIO 6 & GPIO 7'] } },
        data: { pin: 'GPIO 5', description: NODE2_LED_DESC },
      });
    }

    // Khởi tạo 1 lịch hẹn bật/tắt mẫu nếu chưa có lịch nào
    const scheduleCount = await prisma.schedule.count();
    if (scheduleCount === 0) {
      const led1 = await prisma.device.findFirst({ where: { mqttTopic: 'home/device/led1' } });
      if (led1) {
        await prisma.schedule.create({
          data: {
            name: 'Đèn bàn làm việc: 18:00 - 23:00 hằng ngày',
            targetDeviceId: led1.id,
            onTime: '18:00',
            offTime: '23:00',
            days: '1,2,3,4,5,6,7',
            enabled: true,
          },
        });
        console.log('[Seed] Đã tạo 1 lịch hẹn bật/tắt mẫu cho LED 1.');
      }
    }
  } catch (err) {
    console.error('[Seed Error] Khởi tạo dữ liệu thất bại:', err.message);
  }
}

const PORT = process.env.PORT || 4000;

server.listen(PORT, async () => {
  console.log(`===============================================`);
  console.log(`[SmartHome Backend] Server chạy tại cổng : ${PORT}`);
  console.log(`===============================================`);

  await seedDefaultAdmin();
  await seedInitialData();
  connectMQTT();
  startScheduler();
});

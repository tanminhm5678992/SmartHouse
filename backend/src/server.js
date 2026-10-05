require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const prisma = require('./config/prisma');
const { initSocket } = require('./sockets/socketHandler');
const { connectMQTT } = require('./mqtt/mqttClient');
const { startScheduler } = require('./services/scheduleService');

const deviceRoutes = require('./routes/deviceRoutes');
const sensorRoutes = require('./routes/sensorRoutes');
const automationRoutes = require('./routes/automationRoutes');
const scheduleRoutes = require('./routes/scheduleRoutes');
const logRoutes = require('./routes/logRoutes');

const app = express();
const server = http.createServer(app);

// CORS & Middlewares
const allowedOrigins = [process.env.CLIENT_URL || 'http://localhost:3000', 'http://127.0.0.1:3000'];
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));
app.use(express.json());

// Socket.IO
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});
initSocket(io);

// API Routes
app.use('/api/devices', deviceRoutes);
app.use('/api/sensors', sensorRoutes);
app.use('/api/automations', automationRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/logs', logRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Mô tả đấu dây Node 2 (khớp firmware/node2_bed_room/node2_bed_room.ino)
const NODE2_FAN_DESC = 'GPIO 4 → IN Relay | 5V → VCC & COM Relay | G → GND Relay | NO Relay → Quạt (+) | Quạt (-) → GND';
const NODE2_LED_DESC = 'GPIO 5 → điện trở 220Ω → chân dài (+) LED | Chân ngắn (-) LED → GND';

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
        { name: 'LED 2: Đèn trang trí tủ kính', type: 'led', mqttTopic: 'home/device/led2', nodeId: 'node1', pin: 'GPIO 7', description: 'Đèn LED chỉ báo mạng cắm GPIO 7', state: 'OFF' },
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

      console.log('[Seed] Đã khởi tạo thành công 5 thiết bị (Relay 1, LED 1, LED 2, Quạt Node 2, LED 3) và 1 luật tự động!');
    } else {
      // Cập nhật thông tin chân cắm cho các thiết bị cũ nếu chưa có
      const defaultPins = [
        { topic: 'home/device/relay1', pin: 'GPIO 5', desc: 'Chân IN cắm GPIO 5 (Nguồn 5V, DC- cắm G)' },
        { topic: 'home/device/led1', pin: 'GPIO 6', desc: 'Chân (+) cắm GPIO 6, chân (-) cắm GPIO 3 (0V)' },
        { topic: 'home/device/led2', pin: 'GPIO 7', desc: 'Đèn LED chỉ báo mạng cắm GPIO 7' },
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

  await seedInitialData();
  connectMQTT();
  startScheduler();
});

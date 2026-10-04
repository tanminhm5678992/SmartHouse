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
        { name: 'Quạt mini 5V Phòng Ngủ (Relay 2)', type: 'fan', mqttTopic: 'home/device/relay2', nodeId: 'node2', pin: 'GPIO 5', description: 'Dây (+) cắm 5V, Dây (-) cắm GPIO 5 (điều khiển mass)', state: 'OFF' },
        { name: 'LED 3: Đèn ngủ 2 chân', type: 'led', mqttTopic: 'home/device/led3', nodeId: 'node2', pin: 'GPIO 6', description: 'Chân (+) cắm GPIO 6, chân (-) cắm GPIO 7 (0V)', state: 'OFF' },
        { name: 'LED 4: Đèn ban công', type: 'led', mqttTopic: 'home/device/led4', nodeId: 'node2', pin: 'GPIO 7', description: 'Đèn trang trí phụ', state: 'OFF' },
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

      console.log('[Seed] Đã khởi tạo thành công 6 thiết bị (2 relay, 4 LED) và 1 luật tự động!');
    } else {
      // Cập nhật thông tin chân cắm cho các thiết bị cũ nếu chưa có
      const defaultPins = [
        { topic: 'home/device/relay1', pin: 'GPIO 5', desc: 'Chân IN cắm GPIO 5 (Nguồn 5V, DC- cắm G)' },
        { topic: 'home/device/led1', pin: 'GPIO 6', desc: 'Chân (+) cắm GPIO 6, chân (-) cắm GPIO 3 (0V)' },
        { topic: 'home/device/led2', pin: 'GPIO 7', desc: 'Đèn LED chỉ báo mạng cắm GPIO 7' },
        { topic: 'home/device/relay2', pin: 'GPIO 5', desc: 'Dây (+) cắm 5V, Dây (-) cắm GPIO 5 (điều khiển mass)' },
        { topic: 'home/device/led3', pin: 'GPIO 6', desc: 'Chân (+) cắm GPIO 6, chân (-) cắm GPIO 7 (0V)' },
        { topic: 'home/device/led4', pin: 'GPIO 7', desc: 'Đèn trang trí phụ' },
      ];
      for (const p of defaultPins) {
        await prisma.device.updateMany({
          where: { mqttTopic: p.topic, pin: null },
          data: { pin: p.pin, description: p.desc },
        });
      }
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

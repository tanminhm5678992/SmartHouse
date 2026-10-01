const mqtt = require('mqtt');
const prisma = require('../config/prisma');
const { emitSensorData, emitDeviceState, emitNodeStatus } = require('../sockets/socketHandler');
const { evaluateAutomations } = require('../services/automationService');

let client = null;

function connectMQTT() {
  const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
  console.log(`[MQTT] Đang kết nối tới Broker: ${brokerUrl}`);

  client = mqtt.connect(brokerUrl, {
    clientId: `backend_server_${Math.random().toString(16).substring(2, 8)}`,
    clean: true,
    reconnectPeriod: 3000,
  });

  client.on('connect', () => {
    console.log('[MQTT] Đã kết nối thành công tới EMQX Broker!');

    // Đăng ký nhận toàn bộ telemetry cảm biến, trạng thái node và thiết bị
    client.subscribe('home/sensor/+/telemetry', (err) => {
      if (!err) console.log('[MQTT] Đã subscribe: home/sensor/+/telemetry');
    });

    client.subscribe('home/sensor/+/status', (err) => {
      if (!err) console.log('[MQTT] Đã subscribe: home/sensor/+/status');
    });

    client.subscribe('home/device/+/state', (err) => {
      if (!err) console.log('[MQTT] Đã subscribe: home/device/+/state');
    });
  });

  client.on('message', async (topic, payload) => {
    const messageStr = payload.toString();
    // console.log(`[MQTT RX] [${topic}]: ${messageStr}`);

    try {
      // 1. Dữ liệu cảm biến DHT11: home/sensor/{nodeId}/telemetry
      if (topic.startsWith('home/sensor/') && topic.endsWith('/telemetry')) {
        const parts = topic.split('/');
        const nodeId = parts[2]; // node1 hoặc node2
        const data = JSON.parse(messageStr);

        const temp = parseFloat(data.temp);
        const hum = parseFloat(data.hum);

        if (!isNaN(temp) && !isNaN(hum)) {
          // Lưu vào CSDL PostgreSQL
          const reading = await prisma.sensorReading.create({
            data: {
              nodeId,
              temperature: temp,
              humidity: hum,
            },
          });

          // Phát realtime tới Web Client qua Socket.IO
          emitSensorData({
            nodeId,
            temperature: temp,
            humidity: hum,
            createdAt: reading.createdAt,
          });

          // Kiểm tra và kích hoạt các luật tự động hóa
          await evaluateAutomations(nodeId, { temp, hum }, (t, m) => publishCommand(t, m));
        }
      }

      // 2. Trạng thái Node Online/Offline (LWT): home/sensor/{nodeId}/status
      else if (topic.startsWith('home/sensor/') && topic.endsWith('/status')) {
        const parts = topic.split('/');
        const nodeId = parts[2];
        const status = messageStr.trim().toLowerCase(); // 'online' hoặc 'offline'

        emitNodeStatus({ nodeId, status });
        console.log(`[Node Status] ${nodeId} hiện đang: ${status}`);
      }

      // 3. Phản hồi trạng thái thiết bị: home/device/{deviceId}/state
      else if (topic.startsWith('home/device/') && topic.endsWith('/state')) {
        const parts = topic.split('/');
        const deviceSlug = parts[2]; // relay1, relay2, led1, led2...
        const state = messageStr.trim().toUpperCase();

        const baseTopic = `home/device/${deviceSlug}`;
        const device = await prisma.device.findFirst({
          where: { mqttTopic: baseTopic },
        });

        if (device) {
          await prisma.device.update({
            where: { id: device.id },
            data: { state, lastSeen: new Date() },
          });

          emitDeviceState({
            id: device.id,
            name: device.name,
            nodeId: device.nodeId,
            state,
            mqttTopic: device.mqttTopic,
          });
        }
      }
    } catch (err) {
      console.error(`[MQTT Error] Xử lý topic ${topic} thất bại:`, err.message);
    }
  });

  client.on('error', (err) => {
    console.error('[MQTT] Lỗi kết nối:', err.message);
  });

  client.on('offline', () => {
    console.warn('[MQTT] Mất kết nối tới broker!');
  });
}

function publishCommand(topic, message, options = { qos: 1, retain: false }) {
  if (client && client.connected) {
    client.publish(topic, message, options, (err) => {
      if (err) console.error(`[MQTT TX Error] Gửi lệnh tới ${topic} thất bại:`, err.message);
      else console.log(`[MQTT TX] Đã gửi [${topic}]: ${message}`);
    });
  } else {
    console.warn('[MQTT] Không thể gửi lệnh, MQTT client chưa kết nối!');
  }
}

module.exports = {
  connectMQTT,
  publishCommand,
};

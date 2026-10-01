const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const { publishCommand } = require('../mqtt/mqttClient');
const { emitActivityLog, emitDeviceState } = require('../sockets/socketHandler');

// Lấy danh sách toàn bộ thiết bị
router.get('/', async (req, res) => {
  try {
    const devices = await prisma.device.findMany({
      orderBy: { id: 'asc' },
    });
    res.json(devices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Gửi lệnh điều khiển thiết bị (ON/OFF)
router.post('/:id/command', async (req, res) => {
  try {
    const deviceId = parseInt(req.params.id);
    const { action } = req.body; // 'ON' | 'OFF'

    if (!['ON', 'OFF'].includes(action)) {
      return res.status(400).json({ error: 'Action phải là ON hoặc OFF' });
    }

    const device = await prisma.device.findUnique({
      where: { id: deviceId },
    });

    if (!device) {
      return res.status(404).json({ error: 'Thiết bị không tồn tại' });
    }

    // Publish lệnh điều khiển qua MQTT Topic: {topic}/command
    const commandTopic = `${device.mqttTopic}/command`;
    publishCommand(commandTopic, action);

    // Cập nhật trạng thái tạm thời trong DB
    const updatedDevice = await prisma.device.update({
      where: { id: deviceId },
      data: { state: action, lastSeen: new Date() },
    });

    // Tạo Activity Log
    const log = await prisma.activityLog.create({
      data: {
        deviceId: device.id,
        action: `Người dùng chuyển ${device.name} sang ${action}`,
        source: 'manual',
      },
      include: { device: true },
    });

    emitDeviceState(updatedDevice);
    emitActivityLog(log);

    res.json({ success: true, device: updatedDevice });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

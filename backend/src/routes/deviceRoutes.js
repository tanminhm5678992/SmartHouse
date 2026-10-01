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

// Đăng ký thiết bị mới (Slide 18 yêu cầu bắt buộc: Đăng ký thiết bị)
router.post('/', async (req, res) => {
  try {
    const { name, type, mqttTopic, nodeId } = req.body;

    if (!name || !type || !mqttTopic || !nodeId) {
      return res.status(400).json({ error: 'Vui lòng điền đầy đủ tên, loại thiết bị, MQTT topic và Node ID' });
    }

    const newDevice = await prisma.device.create({
      data: {
        name,
        type,
        mqttTopic,
        nodeId,
        state: 'OFF',
      },
    });

    // Tạo Activity Log ghi nhận đăng ký
    const log = await prisma.activityLog.create({
      data: {
        deviceId: newDevice.id,
        action: `Đăng ký thiết bị mới: ${newDevice.name} (${newDevice.mqttTopic})`,
        source: 'manual',
      },
      include: { device: true },
    });
    emitActivityLog(log);

    res.status(201).json(newDevice);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Hủy đăng ký / Xóa thiết bị
router.delete('/:id', async (req, res) => {
  try {
    const deviceId = parseInt(req.params.id);
    const existing = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!existing) {
      return res.status(404).json({ error: 'Thiết bị không tồn tại' });
    }

    await prisma.device.delete({ where: { id: deviceId } });

    const log = await prisma.activityLog.create({
      data: {
        action: `Hủy đăng ký thiết bị: ${existing.name}`,
        source: 'manual',
      },
    });
    emitActivityLog(log);

    res.json({ success: true, message: 'Đã xóa thiết bị thành công' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

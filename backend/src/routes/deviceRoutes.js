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

// Gửi lệnh điều khiển thiết bị (ON/OFF hoặc chỉnh độ sáng LED)
router.post('/:id/command', async (req, res) => {
  try {
    const deviceId = parseInt(req.params.id);
    const { action, brightness } = req.body; // action: 'ON' | 'OFF' | brightness: 0-100

    const device = await prisma.device.findUnique({
      where: { id: deviceId },
    });

    if (!device) {
      return res.status(404).json({ error: 'Thiết bị không tồn tại' });
    }

    const hasBrightness = brightness !== undefined && brightness !== null && brightness !== '';
    const normalizedBrightness = hasBrightness
      ? Math.max(0, Math.min(100, Math.round(Number(brightness))))
      : null;

    // Validate: phải có action hợp lệ hoặc giá trị độ sáng
    if (!hasBrightness && !['ON', 'OFF'].includes(action)) {
      return res.status(400).json({ error: 'Cần truyền action (ON/OFF) hoặc brightness (0-100)' });
    }
    if (hasBrightness && (isNaN(normalizedBrightness))) {
      return res.status(400).json({ error: 'brightness phải là số từ 0 đến 100' });
    }

    const commandTopic = `${device.mqttTopic}/command`;

    let payload;
    let nextState;
    let nextBrightness;
    let logAction;

    if (hasBrightness) {
      // Điều khiển độ sáng LED qua PWM: gửi lệnh dạng "SET:<0-100>"
      payload = `SET:${normalizedBrightness}`;
      nextBrightness = normalizedBrightness;
      nextState = normalizedBrightness > 0 ? 'ON' : 'OFF';
      logAction = `Người dùng chỉnh độ sáng ${device.name} = ${normalizedBrightness}% (${nextState})`;
    } else {
      payload = action;
      nextState = action;
      // Khi BẬT: giữ nguyên mức sáng cũ, nếu đang tắt (0%) thì mặc định 100%
      nextBrightness = action === 'ON' ? (device.brightness > 0 ? device.brightness : 100) : 0;
      logAction = `Người dùng chuyển ${device.name} sang ${action}`;
    }

    // Publish lệnh điều khiển qua MQTT Topic: {topic}/command
    publishCommand(commandTopic, payload);

    // Cập nhật trạng thái + độ sáng trong DB
    const updatedDevice = await prisma.device.update({
      where: { id: deviceId },
      data: { state: nextState, brightness: nextBrightness, lastSeen: new Date() },
    });

    // Tạo Activity Log
    const log = await prisma.activityLog.create({
      data: {
        deviceId: device.id,
        action: logAction,
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
    const { name, type, mqttTopic, nodeId, pin, description } = req.body;

    if (!name || !type || !mqttTopic || !nodeId) {
      return res.status(400).json({ error: 'Vui lòng điền đầy đủ tên, loại thiết bị, MQTT topic và Node ID' });
    }

    const newDevice = await prisma.device.create({
      data: {
        name,
        type,
        mqttTopic,
        nodeId,
        pin: pin || null,
        description: description || null,
        state: 'OFF',
      },
    });

    // Tạo Activity Log ghi nhận đăng ký
    const log = await prisma.activityLog.create({
      data: {
        deviceId: newDevice.id,
        action: `Đăng ký thiết bị mới: ${newDevice.name} (Chân: ${newDevice.pin || 'Mặc định'}, Node: ${newDevice.nodeId})`,
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

// Chỉnh sửa thông tin thiết bị và chân cắm GPIO
router.put('/:id', async (req, res) => {
  try {
    const deviceId = parseInt(req.params.id);
    const { name, type, mqttTopic, nodeId, pin, description } = req.body;

    const existing = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!existing) {
      return res.status(404).json({ error: 'Thiết bị không tồn tại' });
    }

    const updated = await prisma.device.update({
      where: { id: deviceId },
      data: {
        ...(name && { name }),
        ...(type && { type }),
        ...(mqttTopic && { mqttTopic }),
        ...(nodeId && { nodeId }),
        ...(pin !== undefined && { pin }),
        ...(description !== undefined && { description }),
      },
    });

    const log = await prisma.activityLog.create({
      data: {
        deviceId: updated.id,
        action: `Chỉnh sửa chân cắm/thông tin: ${updated.name} (Chân mới: ${updated.pin || 'N/A'}, Node: ${updated.nodeId})`,
        source: 'manual',
      },
      include: { device: true },
    });
    emitActivityLog(log);
    emitDeviceState(updated);

    res.json(updated);
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

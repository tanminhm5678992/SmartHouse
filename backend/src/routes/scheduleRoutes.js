const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');

// Định dạng giờ hợp lệ: "HH:MM" (00:00 - 23:59)
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const DEFAULT_DAYS = '1,2,3,4,5,6,7';

// Chuẩn hóa chuỗi ngày áp dụng (CSV 1..7). Mặc định = cả tuần
function normalizeDays(days) {
  if (!days) return DEFAULT_DAYS;
  const list = String(days)
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => n >= 1 && n <= 7);
  const unique = [...new Set(list)].sort((a, b) => a - b);
  return unique.length ? unique.join(',') : DEFAULT_DAYS;
}

// Lấy danh sách lịch hẹn bật/tắt
router.get('/', async (req, res) => {
  try {
    const schedules = await prisma.schedule.findMany({
      include: { targetDevice: true },
      orderBy: { id: 'desc' },
    });
    res.json(schedules);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Tạo lịch hẹn mới
router.post('/', async (req, res) => {
  try {
    const { name, targetDeviceId, onTime, offTime, days } = req.body;

    if (!name || !targetDeviceId || !onTime || !offTime) {
      return res.status(400).json({ error: 'Thiếu thông tin: tên, thiết bị, giờ bật và giờ tắt' });
    }
    if (!TIME_REGEX.test(onTime) || !TIME_REGEX.test(offTime)) {
      return res.status(400).json({ error: 'Giờ phải theo định dạng HH:MM (ví dụ 07:30, 22:00)' });
    }

    const device = await prisma.device.findUnique({ where: { id: parseInt(targetDeviceId) } });
    if (!device) {
      return res.status(404).json({ error: 'Thiết bị không tồn tại' });
    }

    const newSchedule = await prisma.schedule.create({
      data: {
        name,
        targetDeviceId: parseInt(targetDeviceId),
        onTime,
        offTime,
        days: normalizeDays(days),
        enabled: true,
      },
      include: { targetDevice: true },
    });

    res.status(201).json(newSchedule);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cập nhật lịch hẹn
router.put('/:id', async (req, res) => {
  try {
    const scheduleId = parseInt(req.params.id);
    const { name, targetDeviceId, onTime, offTime, days } = req.body;

    const existing = await prisma.schedule.findUnique({ where: { id: scheduleId } });
    if (!existing) {
      return res.status(404).json({ error: 'Lịch hẹn không tồn tại' });
    }
    if (onTime && !TIME_REGEX.test(onTime)) {
      return res.status(400).json({ error: 'Giờ bật phải theo định dạng HH:MM' });
    }
    if (offTime && !TIME_REGEX.test(offTime)) {
      return res.status(400).json({ error: 'Giờ tắt phải theo định dạng HH:MM' });
    }

    const updated = await prisma.schedule.update({
      where: { id: scheduleId },
      data: {
        ...(name && { name }),
        ...(targetDeviceId && { targetDeviceId: parseInt(targetDeviceId) }),
        ...(onTime && { onTime }),
        ...(offTime && { offTime }),
        ...(days !== undefined && { days: normalizeDays(days) }),
      },
      include: { targetDevice: true },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bật/tắt lịch hẹn
router.put('/:id/toggle', async (req, res) => {
  try {
    const scheduleId = parseInt(req.params.id);
    const existing = await prisma.schedule.findUnique({ where: { id: scheduleId } });

    if (!existing) {
      return res.status(404).json({ error: 'Lịch hẹn không tồn tại' });
    }

    const updated = await prisma.schedule.update({
      where: { id: scheduleId },
      data: { enabled: !existing.enabled },
      include: { targetDevice: true },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Xóa lịch hẹn
router.delete('/:id', async (req, res) => {
  try {
    const scheduleId = parseInt(req.params.id);
    const existing = await prisma.schedule.findUnique({ where: { id: scheduleId } });
    if (!existing) {
      return res.status(404).json({ error: 'Lịch hẹn không tồn tại' });
    }
    await prisma.schedule.delete({ where: { id: scheduleId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');

// Lấy danh sách luật tự động hóa
router.get('/', async (req, res) => {
  try {
    const automations = await prisma.automation.findMany({
      include: { targetDevice: true },
      orderBy: { id: 'desc' },
    });
    res.json(automations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Tạo luật tự động hóa mới
router.post('/', async (req, res) => {
  try {
    const { name, sensorNode, metric, operator, threshold, targetDeviceId, action } = req.body;

    if (!name || !sensorNode || !metric || !operator || threshold === undefined || !targetDeviceId || !action) {
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });
    }

    const newRule = await prisma.automation.create({
      data: {
        name,
        sensorNode,
        metric,
        operator,
        threshold: parseFloat(threshold),
        targetDeviceId: parseInt(targetDeviceId),
        action,
        enabled: true,
      },
      include: { targetDevice: true },
    });

    res.status(201).json(newRule);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bật/tắt luật tự động hóa
router.put('/:id/toggle', async (req, res) => {
  try {
    const ruleId = parseInt(req.params.id);
    const existing = await prisma.automation.findUnique({ where: { id: ruleId } });

    if (!existing) {
      return res.status(404).json({ error: 'Luật không tồn tại' });
    }

    const updated = await prisma.automation.update({
      where: { id: ruleId },
      data: { enabled: !existing.enabled },
      include: { targetDevice: true },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Xóa luật tự động hóa
router.delete('/:id', async (req, res) => {
  try {
    const ruleId = parseInt(req.params.id);
    await prisma.automation.delete({ where: { id: ruleId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

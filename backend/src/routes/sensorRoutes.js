const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');

// Lấy dữ liệu cảm biến mới nhất của từng node
router.get('/latest', async (req, res) => {
  try {
    const nodes = ['node1', 'node2'];
    const results = {};

    for (const nodeId of nodes) {
      const latestReading = await prisma.sensorReading.findFirst({
        where: { nodeId },
        orderBy: { createdAt: 'desc' },
      });
      results[nodeId] = latestReading || null;
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Lấy lịch sử cảm biến theo node để vẽ đồ thị
router.get('/history', async (req, res) => {
  try {
    const { nodeId = 'node1', limit = 50 } = req.query;

    const history = await prisma.sensorReading.findMany({
      where: { nodeId: String(nodeId) },
      orderBy: { createdAt: 'desc' },
      take: Math.min(parseInt(limit, 10), 200),
    });

    // Trả về thứ tự thời gian tăng dần để frontend vẽ Recharts chuẩn
    res.json(history.reverse());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');

// Lấy 50 lịch sử hoạt động mới nhất
router.get('/', async (req, res) => {
  try {
    const logs = await prisma.activityLog.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: { device: true },
    });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

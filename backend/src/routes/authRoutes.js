const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const prisma = require('../config/prisma');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/auth');
const { authenticate } = require('../middleware/auth');

// Đăng nhập: kiểm tra tài khoản trong database, trả về JWT nếu hợp lệ
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({ error: 'Vui lòng nhập tên đăng nhập và mật khẩu' });
    }

    const user = await prisma.user.findUnique({ where: { username: String(username).trim() } });
    const isValid = user ? await bcrypt.compare(String(password), user.passwordHash) : false;

    if (!user || !isValid) {
      return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng' });
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Lấy thông tin người dùng hiện tại (dùng để kiểm tra token còn hiệu lực khi mở lại trang)
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return res.status(401).json({ error: 'Tài khoản không còn tồn tại' });
    }
    res.json({ user: { id: user.id, username: user.username, role: user.role } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

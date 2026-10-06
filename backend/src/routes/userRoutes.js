const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const prisma = require('../config/prisma');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { emitActivityLog } = require('../sockets/socketHandler');

// Quản trị viên có thể gán cho người dùng 2 quyền này (quyền admin chỉ dành cho tài khoản admin mặc định)
const ASSIGNABLE_ROLES = ['user', 'manager'];
const MIN_PASSWORD_LENGTH = 3;

// Ghi nhật ký hoạt động cho các thao tác quản lý tài khoản (không gắn với thiết bị)
async function logUserAction(action) {
  try {
    const log = await prisma.activityLog.create({ data: { action, source: 'manual' } });
    emitActivityLog(log);
  } catch (err) {
    console.error('[UserLog Error]', err.message);
  }
}

// Lấy danh sách toàn bộ người dùng
router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { id: 'asc' },
      select: { id: true, username: true, role: true, createdAt: true, lastLogin: true },
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Thêm người dùng mới
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { username, password, role } = req.body || {};
    const trimmed = String(username || '').trim();

    if (!trimmed || !password) {
      return res.status(400).json({ error: 'Vui lòng nhập tên đăng nhập và mật khẩu' });
    }
    if (trimmed.length > 50) {
      return res.status(400).json({ error: 'Tên đăng nhập tối đa 50 ký tự' });
    }
    if (String(password).length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự` });
    }
    const finalRole = role || 'user';
    if (!ASSIGNABLE_ROLES.includes(finalRole)) {
      return res.status(400).json({ error: 'Quyền hợp lệ là "user" (người dùng) hoặc "manager" (quản lý)' });
    }

    const exists = await prisma.user.findUnique({ where: { username: trimmed } });
    if (exists) {
      return res.status(400).json({ error: 'Tên đăng nhập đã tồn tại' });
    }

    const newUser = await prisma.user.create({
      data: { username: trimmed, passwordHash: await bcrypt.hash(String(password), 10), role: finalRole },
      select: { id: true, username: true, role: true, createdAt: true, lastLogin: true },
    });

    await logUserAction(`Quản trị: thêm người dùng "${newUser.username}" (quyền: ${newUser.role})`);
    res.status(201).json(newUser);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Chỉnh sửa quyền người dùng và/hoặc đặt lại mật khẩu
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { role, password } = req.body || {};

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }
    if (target.id === req.user.id && role !== undefined && role !== target.role) {
      return res.status(400).json({ error: 'Không thể thay đổi quyền của chính tài khoản đang đăng nhập' });
    }

    const data = {};

    if (role !== undefined) {
      if (!ASSIGNABLE_ROLES.includes(role)) {
        return res.status(400).json({ error: 'Quyền hợp lệ là "user" (người dùng) hoặc "manager" (quản lý)' });
      }
      data.role = role;
    }

    if (password !== undefined && password !== null && password !== '') {
      if (String(password).length < MIN_PASSWORD_LENGTH) {
        return res.status(400).json({ error: `Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự` });
      }
      data.passwordHash = await bcrypt.hash(String(password), 10);
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'Không có thay đổi nào được gửi lên' });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, username: true, role: true, createdAt: true, lastLogin: true },
    });

    const parts = [];
    if (data.role) parts.push(`đổi quyền thành "${data.role}"`);
    if (data.passwordHash) parts.push('đặt lại mật khẩu');
    await logUserAction(`Quản trị: cập nhật tài khoản "${updated.username}" (${parts.join(', ')})`);

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Xóa người dùng
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }
    if (target.id === req.user.id) {
      return res.status(400).json({ error: 'Không thể xóa tài khoản của chính mình' });
    }

    await prisma.user.delete({ where: { id: userId } });
    await logUserAction(`Quản trị: xóa tài khoản "${target.username}"`);

    res.json({ success: true, message: `Đã xóa tài khoản "${target.username}"` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
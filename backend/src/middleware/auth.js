const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const { JWT_SECRET } = require('../config/auth');

// Middleware bảo vệ API: yêu cầu header "Authorization: Bearer <token>"
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Bạn chưa đăng nhập' });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError'
      ? 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại'
      : 'Token không hợp lệ';
    return res.status(401).json({ error: message });
  }
}

// Middleware xác thực cho Socket.IO: client gửi token qua socket.handshake.auth.token
function socketAuthenticate(socket, next) {
  const token = socket.handshake.auth && socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Chưa đăng nhập'));
  }
  try {
    socket.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    next(new Error('Token không hợp lệ hoặc đã hết hạn'));
  }
}

// Middleware phân quyền: chỉ cho phép tài khoản admin truy cập
// Luôn đọc role MỚI NHẤT trong DB để áp dụng ngay khi admin bị hạ quyền (token cũ vẫn còn hạn)
async function requireAdmin(req, res, next) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Chỉ quản trị viên (admin) mới được thực hiện chức năng này' });
    }
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { authenticate, socketAuthenticate, requireAdmin };

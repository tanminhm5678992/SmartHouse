// Cấu hình JWT cho chức năng đăng nhập
// Nên đặt JWT_SECRET riêng trong file .env / docker-compose khi triển khai thật
const JWT_SECRET = process.env.JWT_SECRET || 'smarthome_dev_secret_change_me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';

if (!process.env.JWT_SECRET) {
  console.warn('[Auth] Chưa cấu hình JWT_SECRET, đang dùng khóa mặc định (chỉ phù hợp khi phát triển).');
}

module.exports = { JWT_SECRET, JWT_EXPIRES_IN };

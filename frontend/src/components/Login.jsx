import React, { useState } from 'react';
import { Home, LogIn, Loader2, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { authApi } from '../api/axiosClient';
import { saveSession } from '../api/authStorage';

// Trang đăng nhập: xác thực qua POST /api/auth/login, nhận JWT và lưu vào localStorage
export default function Login({ onSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    setError('');
    setLoading(true);
    try {
      const { data } = await authApi.login(username.trim(), password);
      saveSession(data.token, data.user);
      onSuccess(data.user);
    } catch (err) {
      const message =
        err.response && err.response.data && err.response.data.error
          ? err.response.data.error
          : 'Không thể kết nối máy chủ, vui lòng thử lại';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-brand">
          <div className="brand-icon-box">
            <Home size={26} color="#ffffff" />
          </div>
          <div>
            <h1 className="brand-title">Smart Home IoT</h1>
            <p className="brand-subtitle">Đăng nhập để truy cập hệ thống</p>
          </div>
        </div>

        <div className="form-group">
          <label>Tên đăng nhập</label>
          <input
            type="text"
            className="form-input"
            placeholder="Ví dụ: admin"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            autoComplete="username"
            required
          />
        </div>

        <div className="form-group">
          <label>Mật khẩu</label>
          <div className="login-password-field">
            <input
              type={showPassword ? 'text' : 'password'}
              className="form-input"
              placeholder="••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="login-password-toggle"
              onClick={() => setShowPassword((v) => !v)}
              title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {error && <div className="login-error">{error}</div>}

        <button type="submit" className="btn-primary login-submit" disabled={loading}>
          {loading ? <Loader2 size={18} className="spin" /> : <LogIn size={18} />}
          {loading ? 'Đang đăng nhập...' : 'Đăng Nhập'}
        </button>

        <p className="login-hint">
          <ShieldCheck size={13} /> Phiên đăng nhập được bảo vệ bằng JWT
        </p>
      </form>
    </div>
  );
}

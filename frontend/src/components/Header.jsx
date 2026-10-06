import React from 'react';
import { Home, Activity, Cpu, Bell, Sliders, CalendarClock, PlugZap, LogOut, User, Users } from 'lucide-react';

// Nhãn hiển thị cho từng quyền (role)
const ROLE_LABELS = {
  admin: 'Quản trị viên',
  manager: 'Quản lý',
  user: 'Người dùng',
};

export default function Header({ activeTab, setActiveTab, isSocketConnected, user, onLogout }) {
  return (
    <header className="app-header">
      <div className="brand-section">
        <div className="brand-icon-box">
          <Home size={26} color="#ffffff" />
        </div>
        <div>
          <h1 className="brand-title">Smart Home IoT</h1>
          <p className="brand-subtitle">ESP32-C3 • MQTT EMQX • Home Assistant</p>
        </div>
      </div>

      <nav className="nav-tabs">
        <button
          className={`nav-tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <Cpu size={16} /> Bảng Điều Khiển
        </button>
        <button
          className={`nav-tab-btn ${activeTab === 'charts' ? 'active' : ''}`}
          onClick={() => setActiveTab('charts')}
        >
          <Activity size={16} /> Đồ Thị Cảm Biến
        </button>
        <button
          className={`nav-tab-btn ${activeTab === 'devices' ? 'active' : ''}`}
          onClick={() => setActiveTab('devices')}
        >
          <PlugZap size={16} /> Đăng Ký Thiết Bị
        </button>
        <button
          className={`nav-tab-btn ${activeTab === 'automations' ? 'active' : ''}`}
          onClick={() => setActiveTab('automations')}
        >
          <Sliders size={16} /> Tự Động Hóa
        </button>
        <button
          className={`nav-tab-btn ${activeTab === 'schedules' ? 'active' : ''}`}
          onClick={() => setActiveTab('schedules')}
        >
          <CalendarClock size={16} /> Lịch Hẹn
        </button>
        <button
          className={`nav-tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          <Bell size={16} /> Nhật Ký
        </button>
        {/* Chỉ admin mới thấy tab Quản Lý Người Dùng */}
        {user?.role === 'admin' && (
          <button
            className={`nav-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <Users size={16} /> Quản Lý Người Dùng
          </button>
        )}
      </nav>

      <div className="header-status-group">
        <div className="status-badge">
          <span className={`status-dot ${isSocketConnected ? 'online' : 'offline'}`} />
          <span>{isSocketConnected ? 'Realtime Live' : 'Mất Kết Nối'}</span>
        </div>

        {user && (
          <div className="header-user-group">
            <div className="header-user-chip" title={`Đã đăng nhập: ${ROLE_LABELS[user.role] || user.role}`}>
              <User size={14} />
              <span>{user.username}</span>
              <span className="header-user-role">{ROLE_LABELS[user.role] || user.role}</span>
            </div>
            <button type="button" className="header-logout-btn" onClick={onLogout} title="Đăng xuất">
              <LogOut size={14} /> Đăng xuất
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

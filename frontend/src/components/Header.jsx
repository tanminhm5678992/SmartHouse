import React from 'react';
import { Home, Activity, Cpu, Bell, Sliders } from 'lucide-react';

export default function Header({ activeTab, setActiveTab, isSocketConnected }) {
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
          <Cpu size={16} /> Đăng Ký Thiết Bị
        </button>
        <button
          className={`nav-tab-btn ${activeTab === 'automations' ? 'active' : ''}`}
          onClick={() => setActiveTab('automations')}
        >
          <Sliders size={16} /> Tự Động Hóa
        </button>
        <button
          className={`nav-tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          <Bell size={16} /> Nhật Ký
        </button>
      </nav>

      <div className="header-status-group">
        <div className="status-badge">
          <span className={`status-dot ${isSocketConnected ? 'online' : 'offline'}`} />
          <span>{isSocketConnected ? 'Realtime Live' : 'Mất Kết Nối'}</span>
        </div>
      </div>
    </header>
  );
}

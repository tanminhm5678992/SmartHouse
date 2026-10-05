import React from 'react';
import { Thermometer, Droplets, Zap, Wifi, Sliders, CalendarClock, AlertTriangle } from 'lucide-react';

export default function StatsOverview({ sensorData, devices, nodeStatuses, automations = [], schedules = [] }) {
  // ESP32 gửi telemetry mỗi 5 giây → quá 60 giây không có bản tin mới = dữ liệu cũ
  const STALE_MS = 60000;
  const isStale = (d) => !d?.createdAt || Date.now() - new Date(d.createdAt).getTime() > STALE_MS;

  // Nhiệt độ / độ ẩm trung bình — chỉ tính trên node THỰC SỰ có dữ liệu
  const temps = [];
  const hums = [];
  let staleCount = 0;
  Object.values(sensorData).forEach((d) => {
    if (d && d.temperature !== undefined) {
      temps.push(d.temperature);
      hums.push(d.humidity);
      if (isStale(d)) staleCount += 1;
    }
  });
  const avgTemp = temps.length ? (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1) : '--';
  const avgHum = hums.length ? (hums.reduce((a, b) => a + b, 0) / hums.length).toFixed(1) : '--';

  // Chỉ đếm thiết bị CHẤP HÀNH được (bỏ cảm biến) — đúng với thực tế điều khiển được
  const actuators = devices.filter((d) => d.type !== 'sensor');
  const activeDevices = actuators.filter((d) => d.state === 'ON').length;

  // Đếm số Node online
  const onlineNodes = Object.values(nodeStatuses).filter((s) => s === 'online').length;

  // Số luật tự động hóa / lịch hẹn đang BẬT (đúng theo DB)
  const enabledRules = automations.filter((a) => a.enabled).length;
  const enabledSchedules = schedules.filter((s) => s.enabled).length;

  return (
    <div className="stats-grid">
      <div className="stat-card">
        <div className="stat-icon" style={{ background: 'rgba(244, 63, 94, 0.15)', color: '#f43f5e' }}>
          <Thermometer size={24} />
        </div>
        <div className="stat-info">
          <h4>Nhiệt độ trung bình · 2 phòng</h4>
          <p>{avgTemp} <span style={{ fontSize: '1rem', color: 'var(--text-dim)' }}>°C</span></p>
          <span className={`stat-sub ${staleCount > 0 ? 'warn' : ''}`}>
            {temps.length === 0
              ? 'Chưa nhận được dữ liệu DHT11'
              : staleCount > 0
                ? <><AlertTriangle size={11} /> {staleCount} node đang trả dữ liệu cũ</>
                : 'Cả 2 trạm đang cập nhật realtime'}
          </span>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon" style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4' }}>
          <Droplets size={24} />
        </div>
        <div className="stat-info">
          <h4>Độ ẩm trung bình · 2 phòng</h4>
          <p>{avgHum} <span style={{ fontSize: '1rem', color: 'var(--text-dim)' }}>%</span></p>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
          <Zap size={24} />
        </div>
        <div className="stat-info">
          <h4>Thiết bị chấp hành đang bật</h4>
          <p>{activeDevices} <span style={{ fontSize: '1rem', color: 'var(--text-dim)' }}>/ {actuators.length}</span></p>
          <span className="stat-sub">Relay · LED · Quạt (không tính cảm biến)</span>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
          <Wifi size={24} />
        </div>
        <div className="stat-info">
          <h4>Node Trạm Online</h4>
          <p>{onlineNodes} <span style={{ fontSize: '1rem', color: 'var(--text-dim)' }}>/ 2</span></p>
          <span className="stat-sub">Trạng thái LWT qua MQTT</span>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc' }}>
          <Sliders size={24} />
        </div>
        <div className="stat-info">
          <h4>Luật tự động hóa đang bật</h4>
          <p>{enabledRules} <span style={{ fontSize: '1rem', color: 'var(--text-dim)' }}>/ {automations.length}</span></p>
          <span className="stat-sub">Kích hoạt theo cảm biến DHT11</span>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon" style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#c4b5fd' }}>
          <CalendarClock size={24} />
        </div>
        <div className="stat-info">
          <h4>Lịch hẹn đang bật</h4>
          <p>{enabledSchedules} <span style={{ fontSize: '1rem', color: 'var(--text-dim)' }}>/ {schedules.length}</span></p>
          <span className="stat-sub">Bật/tắt thiết bị theo giờ</span>
        </div>
      </div>
    </div>
  );
}

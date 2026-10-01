import React from 'react';
import { Thermometer, Droplets, Zap, Wifi } from 'lucide-react';

export default function StatsOverview({ sensorData, devices, nodeStatuses }) {
  // Tính nhiệt độ trung bình
  const temps = Object.values(sensorData)
    .filter((d) => d && d.temperature !== undefined)
    .map((d) => d.temperature);
  const avgTemp = temps.length ? (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1) : '--';

  // Tính độ ẩm trung bình
  const hums = Object.values(sensorData)
    .filter((d) => d && d.humidity !== undefined)
    .map((d) => d.humidity);
  const avgHum = hums.length ? (hums.reduce((a, b) => a + b, 0) / hums.length).toFixed(1) : '--';

  // Đếm thiết bị đang ON
  const activeDevices = devices.filter((d) => d.state === 'ON').length;

  // Đếm số Node online
  const onlineNodes = Object.values(nodeStatuses).filter((s) => s === 'online').length;

  return (
    <div className="stats-grid">
      <div className="stat-card">
        <div className="stat-icon" style={{ background: 'rgba(244, 63, 94, 0.15)', color: '#f43f5e' }}>
          <Thermometer size={24} />
        </div>
        <div className="stat-info">
          <h4>Nhiệt độ trung bình</h4>
          <p>{avgTemp} <span style={{ fontSize: '1rem', color: 'var(--text-dim)' }}>°C</span></p>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon" style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4' }}>
          <Droplets size={24} />
        </div>
        <div className="stat-info">
          <h4>Độ ẩm không khí</h4>
          <p>{avgHum} <span style={{ fontSize: '1rem', color: 'var(--text-dim)' }}>%</span></p>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
          <Zap size={24} />
        </div>
        <div className="stat-info">
          <h4>Thiết bị đang bật</h4>
          <p>{activeDevices} <span style={{ fontSize: '1rem', color: 'var(--text-dim)' }}>/ {devices.length}</span></p>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
          <Wifi size={24} />
        </div>
        <div className="stat-info">
          <h4>Node Trạm Online</h4>
          <p>{onlineNodes} <span style={{ fontSize: '1rem', color: 'var(--text-dim)' }}>/ 2</span></p>
        </div>
      </div>
    </div>
  );
}

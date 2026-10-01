import React from 'react';
import { Thermometer, Droplets, Radio, Clock } from 'lucide-react';

export default function SensorCard({ nodeId, title, room, data, status }) {
  const isOnline = status === 'online';
  const temp = data?.temperature !== undefined ? Number(data.temperature).toFixed(1) : '--';
  const hum = data?.humidity !== undefined ? Number(data.humidity).toFixed(1) : '--';
  
  const lastUpdated = data?.createdAt
    ? new Date(data.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : 'Chưa có dữ liệu';

  // Chọn màu theo mức nhiệt độ
  const getTempColor = (t) => {
    if (t === '--') return 'var(--text-main)';
    const val = parseFloat(t);
    if (val >= 32) return 'var(--accent-rose)';
    if (val >= 28) return 'var(--accent-amber)';
    return 'var(--accent-cyan)';
  };

  return (
    <div className="sensor-card">
      <div className="sensor-card-top">
        <div className="node-title-group">
          <h3>{title}</h3>
          <span className="node-badge">
            <Radio size={12} color="var(--primary)" /> {room} • DHT11 (GPIO 4)
          </span>
        </div>
        <div className="status-badge">
          <span className={`status-dot ${isOnline ? 'online' : 'offline'}`} />
          <span style={{ fontSize: '0.75rem' }}>{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
        </div>
      </div>

      <div className="sensor-metrics-row">
        {/* Nhiệt độ */}
        <div className="metric-box">
          <div className="metric-label">
            <Thermometer size={16} color="var(--accent-rose)" />
            <span>Nhiệt độ</span>
          </div>
          <div className="metric-value-container">
            <span className="metric-value" style={{ color: getTempColor(temp) }}>
              {temp}
            </span>
            <span className="metric-unit">°C</span>
          </div>
        </div>

        {/* Độ ẩm */}
        <div className="metric-box">
          <div className="metric-label">
            <Droplets size={16} color="var(--accent-cyan)" />
            <span>Độ ẩm</span>
          </div>
          <div className="metric-value-container">
            <span className="metric-value" style={{ color: 'var(--accent-cyan)' }}>
              {hum}
            </span>
            <span className="metric-unit">%</span>
          </div>
        </div>
      </div>

      <div className="sensor-card-footer">
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Clock size={13} /> Cập nhật: {lastUpdated}
        </span>
        <span style={{ color: 'var(--text-dim)' }}>Topic: home/sensor/{nodeId}</span>
      </div>
    </div>
  );
}

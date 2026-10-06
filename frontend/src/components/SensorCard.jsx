import React from 'react';
import { Thermometer, Droplets, Radio, Clock, AlertTriangle } from 'lucide-react';

// Ngưỡng "Nóng" trùng với luật tự động hóa mẫu của dự án (nhiệt độ > 32°C)
const HOT_THRESHOLD = 32;

// ESP32 gửi telemetry mỗi 5 giây → quá 60 giây = dữ liệu đã cũ
const STALE_MS = 60000;

// Đổi mốc thời gian thành chuỗi tương đối
function timeAgo(ts) {
  if (!ts) return null;
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (Number.isNaN(diff)) return null;
  if (diff < 60) return `${Math.max(diff, 0)} giây trước`;
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  return `${Math.floor(diff / 3600)} giờ trước`;
}

export default function SensorCard({ nodeId, title, room, data, status }) {
  const isOnline = status === 'online';
  const temp = data?.temperature !== undefined ? Number(data.temperature).toFixed(1) : '--';
  const hum = data?.humidity !== undefined ? Number(data.humidity).toFixed(1) : '--';

  // Dữ liệu cũ = trạm offline HOẶC bản tin cuối đã quá STALE_MS
  const ageMs = data?.createdAt ? Date.now() - new Date(data.createdAt).getTime() : Infinity;
  const isStale = ageMs > STALE_MS;

  // Mức nhiệt theo ngưỡng thật của hệ thống
  const comfort = temp === '--' ? null : Number(temp) >= HOT_THRESHOLD ? 'Nóng' : Number(temp) >= 28 ? 'Ấm' : 'Mát';

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
            <Radio size={12} color="var(--primary)" /> {room}
            {nodeId === 'node1' ? ' • DHT11 (GPIO 4)' : ' • Không DHT11 • Chỉ điều khiển'}
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

      {isStale && (
        <div className="sensor-stale-banner">
          <AlertTriangle size={13} />
          <span>
            {isOnline
              ? 'Dữ liệu cũ — trạm chưa gửi bản tin mới trong hơn 60 giây'
              : 'Trạm đang OFFLINE — số liệu bên trên là dữ liệu cũ, KHÔNG phải realtime'}
          </span>
        </div>
      )}

      <div className="sensor-card-footer">
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Clock size={13} /> {data?.createdAt ? `Cập nhật ${timeAgo(data.createdAt)}` : 'Chưa có dữ liệu'}
        </span>
        {comfort && (
          <span className={`comfort-chip ${comfort === 'Nóng' ? 'hot' : comfort === 'Ấm' ? 'warm' : 'cool'}`}>
            {comfort} · {comfort === 'Nóng' ? `≥ ${HOT_THRESHOLD}°C` : comfort === 'Ấm' ? '28–31.9°C' : '< 28°C'}
          </span>
        )}
      </div>

      <div className="sensor-topic-line">
        {nodeId === 'node1' ? (
          <>
            <code>home/sensor/{nodeId}/telemetry</code> · LWT <code>home/sensor/{nodeId}/status</code> · DHT11 chân GPIO 4
          </>
        ) : (
          <>
            LWT <code>home/sensor/{nodeId}/status</code> · Node này không có DHT11 (không gửi telemetry)
          </>
        )}
      </div>
    </div>
  );
}

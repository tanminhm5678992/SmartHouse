import React, { useState, useEffect, useRef } from 'react';
import { Lightbulb, Zap, Fan, Sun, Gauge, MapPin, Clock, WifiOff } from 'lucide-react';

// Nhãn phòng theo đúng 2 trạm của dự án
const ROOM = { node1: 'Phòng Khách', node2: 'Phòng Ngủ' };

// Đổi mốc thời gian thành chuỗi tương đối (thời điểm thiết bị phản hồi lần cuối)
function timeAgo(ts) {
  if (!ts) return null;
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (Number.isNaN(diff)) return null;
  if (diff < 60) return `${Math.max(diff, 0)} giây trước`;
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  return `${Math.floor(diff / 86400)} ngày trước`;
}

export default function DeviceCard({ device, onToggle, onBrightness, nodeStatus }) {
  const [loading, setLoading] = useState(false);
  const isOn = device.state === 'ON';
  const isLed = device.type === 'led';
  const isSensor = device.type === 'sensor';
  // Trạng thái trạm ESP32 chứa thiết bị này (lấy từ node_status qua MQTT LWT)
  const nodeOnline = nodeStatus !== 'offline';

  // Độ sáng cục bộ (0-100). Khởi tạo từ server hoặc theo trạng thái bật/tắt
  const [brightness, setBrightness] = useState(
    device.brightness ?? (device.state === 'ON' ? 100 : 0)
  );
  const debounceRef = useRef(null);

  // Đồng bộ lại độ sáng khi server/realtime cập nhật thiết bị
  useEffect(() => {
    setBrightness(device.brightness ?? (device.state === 'ON' ? 100 : 0));
  }, [device.brightness, device.state]);

  // Dọn dẹp timer debounce khi unmount
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const handleToggle = async () => {
    if (loading) return;
    setLoading(true);
    const nextState = isOn ? 'OFF' : 'ON';
    try {
      await onToggle(device.id, nextState);
    } finally {
      setLoading(false);
    }
  };

  // Kéo thanh trượt: cập nhật hiển thị ngay, gửi lên server sau 250ms (debounce)
  const handleBrightnessChange = (value) => {
    setBrightness(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (onBrightness) onBrightness(device.id, value);
    }, 250);
  };

  // Icon theo ĐÚNG loại thiết bị khai báo trong DB.
  // (Bản cũ: type 'fan' bị rơi vào nhánh mặc định nên hiện nhầm icon bóng đèn)
  const renderIcon = () => {
    switch (device.type) {
      case 'relay':  return <Zap size={22} />;
      case 'fan':    return <Fan size={22} className={isOn ? 'spin-icon' : ''} />;
      case 'sensor': return <Gauge size={22} />;
      case 'led':
      default:       return <Lightbulb size={22} />;
    }
  };

  // Độ sáng hiệu dụng để tạo hiệu ứng phát sáng cho icon LED
  const glowOpacity = isLed ? Math.max(0.15, brightness / 100) : 0;


  return (
    <div className={`device-card ${isOn ? 'on' : 'off'}`}>
      <div className="device-card-header">
        <div
          className="device-icon-box"
          style={isLed ? { boxShadow: `0 0 ${18 * glowOpacity}px rgba(251, 191, 36, ${glowOpacity})` } : undefined}
        >
          {renderIcon()}
        </div>
        {isSensor ? (
          <span className="sensor-readonly-badge">Chỉ đọc</span>
        ) : (
          <label className="switch-control">
            <input
              type="checkbox"
              checked={isOn}
              disabled={loading}
              onChange={handleToggle}
            />
            <span className="switch-slider"></span>
          </label>
        )}
      </div>

      <div className="device-details">
        <h4>{device.name}</h4>
        <div className="device-meta">
          <span className={`mini-dot ${nodeOnline ? 'online' : 'offline'}`} />
          <span>{device.nodeId === 'node1' ? 'ESP32 #1' : device.nodeId === 'node2' ? 'ESP32 #2' : device.nodeId.toUpperCase()}</span>
          <span>•</span>
          <span>{ROOM[device.nodeId] || device.nodeId}</span>
          <span>•</span>
          <span>{(device.type || '').toUpperCase()}</span>
        </div>
        {device.pin && (
          <div className="device-pin-chip" title={device.description || ''}>
            <MapPin size={12} /> {device.pin}
          </div>
        )}
      </div>

      {/* Thanh chỉnh độ sáng: chỉ hiển thị cho đèn LED */}
      {isLed && (
        <div className="brightness-control">
          <div className="brightness-header">
            <span className="brightness-label">
              <Sun size={13} /> Độ sáng
            </span>
            <span className="brightness-value">{brightness}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={brightness}
            disabled={loading}
            onChange={(e) => handleBrightnessChange(Number(e.target.value))}
            className="brightness-slider"
            style={{ '--fill': `${brightness}%` }}
            aria-label={`Độ sáng ${device.name}`}
          />
        </div>
      )}

      {!nodeOnline && !isSensor && (
        <div className="device-offline-warn">
          <WifiOff size={13} />
          <span>
            Trạm <b>{device.nodeId.toUpperCase()}</b> đang OFFLINE — lệnh được ghi vào CSDL
            nhưng chưa chắc tới mạch.
          </span>
        </div>
      )}

      <div className="device-card-footer">
        <span className="device-status-text">
          {isSensor ? 'CẢM BIẾN' : isOn ? 'ĐANG BẬT' : 'ĐANG TẮT'}
        </span>
        <span className="device-lastseen">
          <Clock size={11} />
          {device.lastSeen ? timeAgo(device.lastSeen) : 'chưa có phản hồi'}
        </span>
      </div>

      <div className="device-topic-line">
        Lệnh MQTT: <code>{device.mqttTopic}/command</code>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { Lightbulb, Zap, Fan, Sun } from 'lucide-react';

export default function DeviceCard({ device, onToggle, onBrightness }) {
  const [loading, setLoading] = useState(false);
  const isOn = device.state === 'ON';
  const isLed = device.type === 'led';

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

  // Chọn icon dựa theo loại thiết bị
  const renderIcon = () => {
    if (device.type === 'relay') {
      if (device.name.toLowerCase().includes('quạt')) {
        return <Fan size={22} className={isOn ? 'spin-icon' : ''} />;
      }
      return <Zap size={22} />;
    }
    return <Lightbulb size={22} />;
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
        <label className="switch-control">
          <input
            type="checkbox"
            checked={isOn}
            disabled={loading}
            onChange={handleToggle}
          />
          <span className="switch-slider"></span>
        </label>
      </div>

      <div className="device-details">
        <h4>{device.name}</h4>
        <div className="device-meta">
          <span>{device.nodeId.toUpperCase()}</span>
          <span>•</span>
          <span>{device.type.toUpperCase()}</span>
        </div>
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

      <div className="device-card-footer">
        <span className="device-status-text">
          {isOn ? 'ĐANG BẬT' : 'ĐANG TẮT'}
        </span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
          {device.mqttTopic}
        </span>
      </div>
    </div>
  );
}

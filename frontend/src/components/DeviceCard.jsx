import React, { useState } from 'react';
import { Lightbulb, Zap, Fan, Tv } from 'lucide-react';

export default function DeviceCard({ device, onToggle }) {
  const [loading, setLoading] = useState(false);
  const isOn = device.state === 'ON';

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

  return (
    <div className={`device-card ${isOn ? 'on' : 'off'}`}>
      <div className="device-card-header">
        <div className="device-icon-box">
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

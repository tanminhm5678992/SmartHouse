import React, { useState } from 'react';
import { Plus, Trash2, Cpu, CheckCircle2, X, AlertCircle } from 'lucide-react';
import { deviceApi } from '../api/axiosClient';

export default function DeviceManager({ devices, onReload }) {
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'relay',
    nodeId: 'node1',
    mqttTopic: 'home/device/',
  });
  const [error, setError] = useState('');

  const handleNameChange = (name) => {
    // Tự động tạo slug topic gợi ý khi người dùng gõ tên
    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_');
    setFormData((prev) => ({
      ...prev,
      name,
      mqttTopic: `home/device/${slug || 'device'}`,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await deviceApi.create(formData);
      setShowModal(false);
      setFormData({
        name: '',
        type: 'relay',
        nodeId: 'node1',
        mqttTopic: 'home/device/',
      });
      onReload();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Bạn có chắc muốn hủy đăng ký thiết bị "${name}"?`)) return;
    try {
      await deviceApi.delete(id);
      onReload();
    } catch (err) {
      alert('Lỗi hủy thiết bị: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div style={{ marginTop: '20px' }}>
      <div className="section-header">
        <div className="section-title">
          <Cpu size={20} color="var(--primary)" />
          <span>Quản Lý & Đăng Ký Thiết Bị (Device Registration)</span>
          <span className="tag">Slide 18 Bắt Buộc</span>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} /> Đăng Ký Thiết Bị Mới
        </button>
      </div>

      <div className="chart-panel" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="logs-table">
            <thead>
              <tr>
                <th style={{ width: '80px' }}>ID</th>
                <th>Tên Thiết Bị</th>
                <th style={{ width: '120px' }}>Loại</th>
                <th style={{ width: '120px' }}>Node Quản Lý</th>
                <th>MQTT Topic (Giao tiếp)</th>
                <th style={{ width: '120px' }}>Trạng Thái</th>
                <th style={{ width: '100px', textAlign: 'center' }}>Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((device) => (
                <tr key={device.id}>
                  <td style={{ color: 'var(--text-dim)' }}>#{device.id}</td>
                  <td style={{ fontWeight: '600' }}>{device.name}</td>
                  <td>
                    <span className="badge-source manual">{device.type.toUpperCase()}</span>
                  </td>
                  <td>
                    <span className="badge-source auto">{device.nodeId.toUpperCase()}</span>
                  </td>
                  <td style={{ fontFamily: 'monospace', color: 'var(--accent-cyan)' }}>
                    {device.mqttTopic}
                  </td>
                  <td>
                    <span
                      style={{
                        fontWeight: '700',
                        color: device.state === 'ON' ? 'var(--accent-emerald)' : 'var(--text-dim)',
                      }}
                    >
                      {device.state}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      className="btn-icon"
                      title="Hủy đăng ký thiết bị"
                      onClick={() => handleDelete(device.id, device.name)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Đăng Ký Thiết Bị Mới */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem' }}>
                Đăng Ký Thiết Bị IoT Mới
              </h3>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {error && (
              <div
                style={{
                  background: 'rgba(244, 63, 94, 0.15)',
                  border: '1px solid rgba(244, 63, 94, 0.3)',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  color: '#f43f5e',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.85rem',
                }}
              >
                <AlertCircle size={16} /> {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Tên thiết bị</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Quạt treo tường phòng khách"
                  className="form-input"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Loại thiết bị</label>
                  <select
                    className="form-select"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  >
                    <option value="relay">Relay (Công tắc công suất)</option>
                    <option value="led">Đèn LED (Chiếu sáng)</option>
                    <option value="sensor">Cảm biến</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Trạm điều khiển (Node ID)</label>
                  <select
                    className="form-select"
                    value={formData.nodeId}
                    onChange={(e) => setFormData({ ...formData, nodeId: e.target.value })}
                  >
                    <option value="node1">Node 1 (Phòng Khách)</option>
                    <option value="node2">Node 2 (Phòng Ngủ)</option>
                    <option value="node3">Node 3 (Khu vực khác)</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>MQTT Topic gốc</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={formData.mqttTopic}
                  onChange={(e) => setFormData({ ...formData, mqttTopic: e.target.value })}
                />
                <small style={{ color: 'var(--text-dim)', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                  Lệnh sẽ gửi qua: <code>{formData.mqttTopic}/command</code>
                </small>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                <button
                  type="button"
                  className="nav-tab-btn"
                  onClick={() => setShowModal(false)}
                >
                  Hủy
                </button>
                <button type="submit" className="btn-primary">
                  <CheckCircle2 size={18} /> Đăng Ký Ngay
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

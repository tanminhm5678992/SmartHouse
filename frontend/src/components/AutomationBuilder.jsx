import React, { useState } from 'react';
import { Plus, Trash2, Sliders, CheckCircle2, X } from 'lucide-react';
import { automationApi } from '../api/axiosClient';

export default function AutomationBuilder({ automations, devices, onReload }) {
  const [showModal, setShowModal] = useState(false);

  // Chỉ thiết bị CHẤP HÀNH mới nhận được lệnh ON/OFF — cảm biến DHT11 không điều khiển được.
  // (Trước đây danh sách trộn cả cảm biến nên có thể tạo ra luật bất khả thi.)
  const actuators = devices.filter((d) => d.type !== 'sensor');

  const [formData, setFormData] = useState({
    name: '',
    sensorNode: 'node1',
    metric: 'temperature',
    operator: '>',
    threshold: 30,
    targetDeviceId: actuators[0]?.id || '',
    action: 'ON',
  });

  const handleToggle = async (id) => {
    try {
      await automationApi.toggle(id);
      onReload();
    } catch (err) {
      console.error('Lỗi toggle rule:', err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc muốn xóa kịch bản tự động này?')) return;
    try {
      await automationApi.delete(id);
      onReload();
    } catch (err) {
      console.error('Lỗi xóa rule:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await automationApi.create(formData);
      setShowModal(false);
      setFormData({
        name: '',
        sensorNode: 'node1',
        metric: 'temperature',
        operator: '>',
        threshold: 30,
        targetDeviceId: actuators[0]?.id || '',
        action: 'ON',
      });
      onReload();
    } catch (err) {
      alert('Lỗi tạo rule: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div style={{ marginTop: '20px' }}>
      <div className="section-header">
        <div className="section-title">
          <Sliders size={20} color="var(--primary)" />
          <span>Luật Tự Động Hóa (Automation Rules)</span>
          <span className="tag">Auto Engine</span>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} /> Thêm Kịch Bản Mới
        </button>
      </div>

      <div className="automations-container">
        {automations.length === 0 ? (
          <div className="stat-card" style={{ justifyContent: 'center', color: 'var(--text-dim)' }}>
            Chưa có luật tự động hóa nào được kích hoạt. Hãy tạo kịch bản đầu tiên!
          </div>
        ) : (
          automations.map((rule) => (
            <div key={rule.id} className="automation-rule-card">
              <div className="rule-info">
                <h4>{rule.name}</h4>
                <div className="rule-condition">
                  <span>NẾU</span>
                  <span className="rule-badge">{rule.sensorNode.toUpperCase()}</span>
                  <span>{rule.metric === 'temperature' ? 'Nhiệt độ' : 'Độ ẩm'}</span>
                  <span style={{ fontWeight: 'bold', color: 'var(--accent-amber)' }}>{rule.operator}</span>
                  <span style={{ fontWeight: 'bold' }}>
                    {rule.threshold} {rule.metric === 'temperature' ? '°C' : '%'}
                  </span>
                  <span>→ THÌ</span>
                  <span className="rule-badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                    {rule.targetDevice?.name || `Thiết bị #${rule.targetDeviceId}`}
                  </span>
                  <span>chuyển sang</span>
                  <span style={{ fontWeight: 'bold', color: rule.action === 'ON' ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                    {rule.action}
                  </span>
                </div>
              </div>

              <div className="rule-actions">
                <label className="switch-control">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={() => handleToggle(rule.id)}
                  />
                  <span className="switch-slider"></span>
                </label>
                <button className="btn-icon" onClick={() => handleDelete(rule.id)}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Thêm Kịch Bản */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem' }}>Tạo Luật Tự Động Mới</h3>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Tên kịch bản</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Bật quạt khi nhiệt độ phòng ngủ > 30°C"
                  className="form-input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Node cảm biến</label>
                  <select
                    className="form-select"
                    value={formData.sensorNode}
                    onChange={(e) => setFormData({ ...formData, sensorNode: e.target.value })}
                  >
                    <option value="node1">Node 1 (Phòng Khách)</option>
                    <option value="node2">Node 2 (Phòng Ngủ)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Thông số đo</label>
                  <select
                    className="form-select"
                    value={formData.metric}
                    onChange={(e) => setFormData({ ...formData, metric: e.target.value })}
                  >
                    <option value="temperature">Nhiệt độ (°C)</option>
                    <option value="humidity">Độ ẩm (%)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Điều kiện</label>
                  <select
                    className="form-select"
                    value={formData.operator}
                    onChange={(e) => setFormData({ ...formData, operator: e.target.value })}
                  >
                    <option value=">">Lớn hơn (&gt;)</option>
                    <option value="<">Nhỏ hơn (&lt;)</option>
                    <option value=">=">Lớn hơn hoặc bằng (&gt;=)</option>
                    <option value="<=">Nhỏ hơn hoặc bằng (&lt;=)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Ngưỡng kích hoạt</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    className="form-input"
                    value={formData.threshold}
                    onChange={(e) => setFormData({ ...formData, threshold: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Thiết bị tác động</label>
                  <select
                    className="form-select"
                    value={formData.targetDeviceId}
                    onChange={(e) => setFormData({ ...formData, targetDeviceId: e.target.value })}
                  >
                    {actuators.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} — {d.nodeId === 'node1' ? 'ESP32 #1 (Phòng Khách)' : d.nodeId === 'node2' ? 'ESP32 #2 (Phòng Ngủ)' : d.nodeId} [{d.type.toUpperCase()}]
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Hành động</label>
                  <select
                    className="form-select"
                    value={formData.action}
                    onChange={(e) => setFormData({ ...formData, action: e.target.value })}
                  >
                    <option value="ON">BẬT (ON)</option>
                    <option value="OFF">TẮT (OFF)</option>
                  </select>
                </div>
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
                  <CheckCircle2 size={18} /> Lưu Kịch Bản
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

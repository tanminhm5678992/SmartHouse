import React, { useState } from 'react';
import {
  Plus, Trash2, CalendarClock, CheckCircle2, X, Clock,
  Sunrise, Moon, Edit3, AlertCircle, Info
} from 'lucide-react';
import { scheduleApi } from '../api/axiosClient';

// Danh sách thứ trong tuần (1 = Thứ 2 ... 7 = Chủ nhật), khớp với backend
const WEEK_DAYS = [
  { value: 1, label: 'T2', full: 'Thứ 2' },
  { value: 2, label: 'T3', full: 'Thứ 3' },
  { value: 3, label: 'T4', full: 'Thứ 4' },
  { value: 4, label: 'T5', full: 'Thứ 5' },
  { value: 5, label: 'T6', full: 'Thứ 6' },
  { value: 6, label: 'T7', full: 'Thứ 7' },
  { value: 7, label: 'CN', full: 'Chủ nhật' },
];

const DEFAULT_FORM = {
  name: '',
  targetDeviceId: '',
  onTime: '18:00',
  offTime: '23:00',
  days: [1, 2, 3, 4, 5, 6, 7],
};

// Đọc chuỗi CSV "1,2,3" từ API thành mảng số
const parseDays = (csv) => {
  if (!csv) return [1, 2, 3, 4, 5, 6, 7];
  return String(csv)
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => n >= 1 && n <= 7);
};

// Hiển thị chuỗi ngày dạng thân thiện
const formatDays = (csv) => {
  const days = parseDays(csv);
  if (days.length === 7) return 'Hằng ngày';
  if (days.join(',') === '1,2,3,4,5') return 'Thứ 2 - Thứ 6';
  if (days.join(',') === '6,7') return 'Cuối tuần';
  return days
    .map((d) => WEEK_DAYS.find((w) => w.value === d)?.label || d)
    .join(', ');
};

export default function ScheduleManager({ schedules, devices, onReload }) {
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ ...DEFAULT_FORM });
  const [error, setError] = useState('');

  // Chỉ cho phép đặt lịch cho thiết bị chấp hành (relay / led / fan)
  const actuators = devices.filter((d) => d.type !== 'sensor');

  const openCreateModal = () => {
    setEditingId(null);
    setError('');
    setFormData({ ...DEFAULT_FORM, targetDeviceId: actuators[0]?.id || '' });
    setShowModal(true);
  };

  const openEditModal = (schedule) => {
    setEditingId(schedule.id);
    setError('');
    setFormData({
      name: schedule.name || '',
      targetDeviceId: schedule.targetDeviceId || '',
      onTime: schedule.onTime || '18:00',
      offTime: schedule.offTime || '23:00',
      days: parseDays(schedule.days),
    });
    setShowModal(true);
  };

  const toggleDay = (value) => {
    setFormData((prev) => {
      const has = prev.days.includes(value);
      const days = has
        ? prev.days.filter((d) => d !== value)
        : [...prev.days, value].sort((a, b) => a - b);
      return { ...prev, days };
    });
  };

  const toggleAllDays = () => {
    setFormData((prev) => ({
      ...prev,
      days: prev.days.length === 7 ? [] : [1, 2, 3, 4, 5, 6, 7],
    }));
  };

  const handleToggle = async (id) => {
    try {
      await scheduleApi.toggle(id);
      onReload();
    } catch (err) {
      console.error('Lỗi bật/tắt lịch hẹn:', err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc muốn xóa lịch hẹn này?')) return;
    try {
      await scheduleApi.delete(id);
      onReload();
    } catch (err) {
      console.error('Lỗi xóa lịch hẹn:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.days.length === 0) {
      setError('Vui lòng chọn ít nhất một ngày áp dụng');
      return;
    }

    const payload = {
      name: formData.name,
      targetDeviceId: formData.targetDeviceId,
      onTime: formData.onTime,
      offTime: formData.offTime,
      days: formData.days.join(','),
    };

    try {
      if (editingId) {
        await scheduleApi.update(editingId, payload);
      } else {
        await scheduleApi.create(payload);
      }
      setShowModal(false);
      onReload();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  return (
    <div style={{ marginTop: '20px' }}>
      <div className="section-header">
        <div className="section-title">
          <CalendarClock size={20} color="var(--primary)" />
          <span>Lịch Hẹn Bật/Tắt Thiết Bị Theo Giờ</span>
          <span className="tag">Scheduler</span>
        </div>
        <button className="btn-primary" onClick={openCreateModal}>
          <Plus size={18} /> Thêm Lịch Hẹn Mới
        </button>
      </div>

      <div className="automations-container">
        {schedules.length === 0 ? (
          <div className="stat-card" style={{ justifyContent: 'center', color: 'var(--text-dim)' }}>
            Chưa có lịch hẹn nào. Hãy tạo lịch đầu tiên để tự động bật/tắt thiết bị theo giờ!
          </div>
        ) : (
          schedules.map((schedule) => (
            <div key={schedule.id} className="automation-rule-card">
              <div className="rule-info">
                <h4>{schedule.name}</h4>
                <div className="rule-condition">
                  <span className="rule-badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                    {schedule.targetDevice?.name || `Thiết bị #${schedule.targetDeviceId}`}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--accent-emerald)', fontWeight: '700' }}>
                    <Sunrise size={14} /> {schedule.onTime}
                  </span>
                  <span>→</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--accent-rose)', fontWeight: '700' }}>
                    <Moon size={14} /> {schedule.offTime}
                  </span>
                  <span className="rule-badge">
                    <Clock size={12} style={{ verticalAlign: '-2px', marginRight: '4px' }} />
                    {formatDays(schedule.days)}
                  </span>
                </div>
              </div>

              <div className="rule-actions">
                <label className="switch-control">
                  <input
                    type="checkbox"
                    checked={schedule.enabled}
                    onChange={() => handleToggle(schedule.id)}
                  />
                  <span className="switch-slider"></span>
                </label>
                <button className="btn-icon" title="Chỉnh sửa" onClick={() => openEditModal(schedule)} style={{ color: 'var(--accent-cyan)' }}>
                  <Edit3 size={16} />
                </button>
                <button className="btn-icon" title="Xóa" onClick={() => handleDelete(schedule.id)}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Thêm / Sửa Lịch Hẹn */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CalendarClock size={20} color="var(--primary)" />
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem' }}>
                  {editingId ? 'Chỉnh Sửa Lịch Hẹn' : 'Tạo Lịch Hẹn Bật/Tắt Mới'}
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {error && (
              <div style={{ background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.3)', padding: '10px 14px', borderRadius: '8px', color: '#f43f5e', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                <AlertCircle size={16} /> {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Tên lịch hẹn</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Bật đèn phòng khách buổi tối"
                  className="form-input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Thiết bị áp dụng</label>
                <select
                  className="form-select"
                  required
                  value={formData.targetDeviceId}
                  onChange={(e) => setFormData({ ...formData, targetDeviceId: e.target.value })}
                >
                  <option value="">-- Chọn thiết bị --</option>
                  {actuators.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.nodeId.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label style={{ color: 'var(--accent-emerald)' }}>
                    <Sunrise size={13} style={{ verticalAlign: '-2px', marginRight: '4px' }} />
                    Giờ BẬT
                  </label>
                  <input
                    type="time"
                    required
                    className="form-input"
                    value={formData.onTime}
                    onChange={(e) => setFormData({ ...formData, onTime: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label style={{ color: 'var(--accent-rose)' }}>
                    <Moon size={13} style={{ verticalAlign: '-2px', marginRight: '4px' }} />
                    Giờ TẮT
                  </label>
                  <input
                    type="time"
                    required
                    className="form-input"
                    value={formData.offTime}
                    onChange={(e) => setFormData({ ...formData, offTime: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Ngày áp dụng</span>
                  <button
                    type="button"
                    onClick={toggleAllDays}
                    style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', fontSize: '0.75rem', textDecoration: 'underline' }}
                  >
                    {formData.days.length === 7 ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                  </button>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
                  {WEEK_DAYS.map((d) => {
                    const active = formData.days.includes(d.value);
                    return (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => toggleDay(d.value)}
                        title={d.full}
                        style={{
                          padding: '9px 0', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '0.8rem',
                          border: active ? '1px solid var(--primary)' : '1px solid var(--border-glass)',
                          background: active ? 'linear-gradient(135deg, var(--primary), #4f46e5)' : 'rgba(255,255,255,0.03)',
                          color: active ? '#fff' : 'var(--text-dim)',
                          transition: 'var(--transition)',
                        }}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '8px' }}>
                <Info size={13} />
                Lịch hẹn chạy mỗi ngày đã chọn. Nếu giờ tắt nhỏ hơn giờ bật, thiết bị sẽ tắt vào hôm sau.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button
                  type="button"
                  className="nav-tab-btn"
                  onClick={() => setShowModal(false)}
                >
                  Hủy
                </button>
                <button type="submit" className="btn-primary">
                  <CheckCircle2 size={18} /> {editingId ? 'Lưu Thay Đổi' : 'Tạo Lịch Hẹn'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

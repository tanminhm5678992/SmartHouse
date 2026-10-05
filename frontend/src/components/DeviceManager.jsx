import React, { useState } from 'react';
import {
  Plus, Trash2, Cpu, CheckCircle2, X, AlertCircle, Edit3,
  Lightbulb, Zap, Fan, Gauge, Info, Check, ChevronRight,
  Settings, PlugZap
} from 'lucide-react';
import { deviceApi } from '../api/axiosClient';

// =========================================================
// CẤU HÌNH CHÂN GPIO CHO TỪNG NODE VÀ TỪNG LOẠI THIẾT BỊ
// Node khác nhau → Cùng loại thiết bị nhưng KHÁC chân cắm
// =========================================================
const NODE_INFO = {
  node1: {
    label: '🛋️ ESP32 #1 - Phòng Khách',
    shortLabel: 'ESP32 #1 (Phòng Khách)',
    color: '#818cf8',
    bg: 'rgba(99, 102, 241, 0.15)',
    border: 'rgba(99, 102, 241, 0.4)',
    badge: 'CÓ TESTBOARD / RELAY',
    badgeStyle: { background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24' },
    pinDiagram: [
      { pin: '5V',      desc: 'Nguồn 5V',                          color: '#ef4444' },
      { pin: '3V3',     desc: 'Nguồn 3.3V',                        color: '#f97316' },
      { pin: 'G',       desc: 'GND (Mass)',                         color: '#6b7280' },
      { pin: 'GPIO 5',  desc: 'IN Relay 1 (Đèn trần)',             color: '#f59e0b', used: true },
      { pin: 'GPIO 6',  desc: '(+) LED bàn làm việc',              color: '#fbbf24', used: true },
      { pin: 'GPIO 3',  desc: '(-) LED bàn làm việc (GND ảo)',     color: '#a78bfa', used: true },
      { pin: 'GPIO 4',  desc: 'DATA DHT11',                         color: '#34d399', used: true },
      { pin: 'GPIO 0-2',desc: 'Chưa dùng',                         color: '#374151' },
    ],
  },
  node2: {
    label: '🛏️ ESP32 #2 - Phòng Ngủ',
    shortLabel: 'ESP32 #2 (Phòng Ngủ)',
    color: '#22d3ee',
    bg: 'rgba(6, 182, 212, 0.15)',
    border: 'rgba(6, 182, 212, 0.4)',
    badge: 'RELAY QUẠT + LED PWM (KHÔNG DHT11)',
    badgeStyle: { background: 'rgba(6, 182, 212, 0.2)', color: '#38bdf8' },
    pinDiagram: [
      { pin: '5V',      desc: 'VCC Relay + COM Relay (nối jumper VCC↔COM)', color: '#ef4444', used: true },
      { pin: 'G',       desc: 'GND Relay, GND Quạt (-), chân ngắn (-) LED', color: '#6b7280', used: true },
      { pin: 'GPIO 4',  desc: 'IN Relay (đóng/ngắt nguồn quạt, active-HIGH)', color: '#22d3ee', used: true },
      { pin: 'GPIO 5',  desc: 'Điện trở 220Ω → chân dài (+) LED (PWM)',      color: '#fbbf24', used: true },
      { pin: 'GPIO 8',  desc: 'LED mạng tích hợp (tự động)',                 color: '#a78bfa', used: true },
      { pin: 'NO',      desc: 'NO Relay → Dây (+) Quạt',                     color: '#f59e0b', used: true },
      { pin: 'GPIO 0-3',desc: 'Chưa dùng',                                   color: '#374151' },
    ],
  },
};

// =========================================================
// PRESET CHÂN CẮM MẪU: node + loại thiết bị → chân khác nhau
// =========================================================
const PRESETS = {
  node1: {
    relay: {
      pin: 'GPIO 5',
      name: 'Relay 1: Đèn trần Phòng Khách',
      description: 'Chân IN của Module Relay cắm GPIO 5 | DC+ cắm 5V | DC- cắm G | Thiết bị 220V cắm qua tiếp điểm COM-NO của Relay',
      mqttTopic: 'home/device/relay1',
    },
    led: {
      pin: 'GPIO 6',
      name: 'LED 1: Đèn bàn làm việc Phòng Khách',
      description: 'Chân dài (+) cắm GPIO 6 qua điện trở 220Ω | Chân ngắn (-) cắm GPIO 3 (đặt LOW làm GND ảo 0V)',
      mqttTopic: 'home/device/led1',
    },
    fan: {
      pin: 'GPIO 5',
      name: 'Quạt thông gió Phòng Khách',
      description: 'Điều khiển qua Module Relay ở GPIO 5 | Nguồn quạt lấy từ 5V hoặc 220V qua tiếp điểm Relay',
      mqttTopic: 'home/device/fan1',
    },
    sensor: {
      pin: 'GPIO 4',
      name: 'DHT11 Phòng Khách',
      description: 'Chân DATA cắm GPIO 4 | VCC cắm 3V3 | GND cắm G (lấy từ chân G của module Relay)',
      mqttTopic: 'home/sensor/node1/telemetry',
    },
  },
  node2: {
    fan: {
      pin: 'GPIO 4',
      name: 'Quạt Mini 5V Phòng Ngủ',
      description: 'GPIO 4 → IN Relay | 5V → VCC & COM Relay | G → GND Relay | NO Relay → Quạt (+) | Quạt (-) → GND',
      mqttTopic: 'home/device/relay2',
    },
    led: {
      pin: 'GPIO 5',
      name: 'Đèn LED ngủ Phòng Ngủ',
      description: 'GPIO 5 → điện trở 220Ω → chân dài (+) LED | Chân ngắn (-) LED → GND | Điều chỉnh độ sáng bằng PWM',
      mqttTopic: 'home/device/led3',
    },
    relay: {
      pin: 'GPIO 4',
      name: 'Relay 2 Phòng Ngủ',
      description: 'GPIO 4 → IN Relay | 5V → VCC Relay (jumper VCC↔COM) | G → GND Relay',
      mqttTopic: 'home/device/relay2',
    },
  },
};

const GPIO_OPTIONS = [
  'GPIO 0', 'GPIO 1', 'GPIO 2', 'GPIO 3', 'GPIO 4',
  'GPIO 5', 'GPIO 6', 'GPIO 7', 'GPIO 8', 'GPIO 9',
  'GPIO 10', 'GPIO 20', 'GPIO 21',
  '3V3', '5V', 'G',
];

const DEVICE_TYPES = [
  { id: 'fan',    label: 'Quạt Mini',    Icon: Fan },
  { id: 'led',    label: 'Đèn LED',      Icon: Lightbulb },
  { id: 'relay',  label: 'Module Relay', Icon: Zap },
  { id: 'sensor', label: 'Cảm biến',     Icon: Gauge },
];

const DEFAULT_FORM = {
  name: '', type: 'led', nodeId: 'node1',
  pin: '', description: '', mqttTopic: '',
};

// =========================================================
// COMPONENT: Sơ đồ chân cắm của một Node
// =========================================================
function PinDiagram({ nodeId }) {
  const info = NODE_INFO[nodeId];
  if (!info) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
      {info.pinDiagram.map((item) => (
        <div
          key={item.pin}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 8px',
            borderRadius: '6px',
            background: item.used ? 'rgba(255,255,255,0.04)' : 'transparent',
            opacity: item.used ? 1 : 0.4,
          }}
        >
          <span style={{
            minWidth: '88px', padding: '2px 8px', borderRadius: '4px',
            fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: '800', textAlign: 'center',
            background: item.used ? `${item.color}22` : 'rgba(255,255,255,0.04)',
            color: item.used ? item.color : '#6b7280',
            border: `1px solid ${item.used ? item.color + '44' : '#374151'}`,
          }}>
            {item.pin}
          </span>
          <span style={{ fontSize: '0.78rem', color: item.used ? 'var(--text-muted)' : '#4b5563' }}>
            {item.desc}
          </span>
          {item.used && (
            <span style={{
              marginLeft: 'auto', width: '8px', height: '8px', borderRadius: '50%',
              background: item.color, boxShadow: `0 0 6px ${item.color}88`, flexShrink: 0,
            }} />
          )}
        </div>
      ))}
    </div>
  );
}

// =========================================================
// COMPONENT CHÍNH
// =========================================================
export default function DeviceManager({ devices, onReload, onToggle }) {
  const [filterNode, setFilterNode] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDiagram, setShowDiagram] = useState(null);
  const [createStep, setCreateStep] = useState(1);

  const [formData, setFormData] = useState({ ...DEFAULT_FORM });
  const [editData, setEditData] = useState({ id: null, ...DEFAULT_FORM });
  const [createError, setCreateError] = useState('');
  const [editError, setEditError] = useState('');

  const applyPreset = (nodeId, type, setFn) => {
    const preset = PRESETS[nodeId]?.[type];
    if (preset) {
      setFn((prev) => ({ ...prev, nodeId, type, pin: preset.pin, name: preset.name, description: preset.description, mqttTopic: preset.mqttTopic }));
    } else {
      setFn((prev) => ({ ...prev, nodeId, type, pin: '', name: '', description: '', mqttTopic: `home/${nodeId}/${type}` }));
    }
  };

  const getDeviceIcon = (type) => {
    const found = DEVICE_TYPES.find((d) => d.id === type);
    const Icon = found ? found.Icon : Lightbulb;
    const colors = { fan: 'var(--accent-cyan)', relay: 'var(--accent-amber)', sensor: 'var(--accent-emerald)', led: '#fbbf24' };
    return <Icon size={15} color={colors[type] || '#fbbf24'} />;
  };

  const filteredDevices = filterNode === 'all' ? devices : devices.filter((d) => d.nodeId === filterNode);

  const openCreateModal = () => {
    setFormData({ ...DEFAULT_FORM });
    setCreateError('');
    setCreateStep(1);
    setShowCreateModal(true);
  };

  const handleCreateNext = () => {
    if (!formData.nodeId || !formData.type) { setCreateError('Vui lòng chọn Trạm và Loại thiết bị'); return; }
    if (!formData.name) applyPreset(formData.nodeId, formData.type, setFormData);
    setCreateError('');
    setCreateStep(2);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setCreateError('');
    try {
      await deviceApi.create(formData);
      setShowCreateModal(false);
      onReload();
    } catch (err) {
      setCreateError(err.response?.data?.error || err.message);
    }
  };

  const openEditModal = (device) => {
    setEditData({
      id: device.id,
      name: device.name || '',
      type: device.type || 'led',
      nodeId: device.nodeId || 'node1',
      pin: device.pin || '',
      description: device.description || '',
      mqttTopic: device.mqttTopic || '',
    });
    setEditError('');
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditError('');
    try {
      await deviceApi.update(editData.id, editData);
      setShowEditModal(false);
      onReload();
    } catch (err) {
      setEditError(err.response?.data?.error || err.message);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Xác nhận hủy đăng ký thiết bị "${name}"?`)) return;
    try { await deviceApi.delete(id); onReload(); }
    catch (err) { alert('Lỗi: ' + (err.response?.data?.error || err.message)); }
  };

  const nColor = (nid) => NODE_INFO[nid]?.color || '#818cf8';
  const nBg    = (nid) => NODE_INFO[nid]?.bg    || 'rgba(99,102,241,0.15)';
  const nBdr   = (nid) => NODE_INFO[nid]?.border || 'rgba(99,102,241,0.4)';

  return (
    <div style={{ marginTop: '20px' }}>

      {/* ── HEADER ── */}
      <div className="section-header" style={{ flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div className="section-title">
          <Cpu size={22} color="var(--primary)" />
          <span>Đăng Ký &amp; Quản Lý Chân Cắm Thiết Bị (GPIO Pin Mapping)</span>
          <span className="tag">Slide 18</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '3px' }}>
            {[
              { key: 'all',   label: `Tất Cả (${devices.length})` },
              { key: 'node1', label: '🛋️ ESP32 #1' },
              { key: 'node2', label: '🛏️ ESP32 #2' },
            ].map((tab) => (
              <button key={tab.key} onClick={() => setFilterNode(tab.key)} style={{
                background: filterNode === tab.key ? 'var(--primary)' : 'transparent',
                color: filterNode === tab.key ? '#fff' : 'var(--text-muted)',
                border: 'none', padding: '6px 12px', borderRadius: '6px',
                cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600', transition: 'var(--transition)',
              }}>
                {tab.label}
              </button>
            ))}
          </div>
          <button className="btn-primary" onClick={openCreateModal}>
            <Plus size={18} /> Đăng Ký Thiết Bị Mới
          </button>
        </div>
      </div>

      {/* ── SƠ ĐỒ CHÂN ESP32 (CÓ THỂ MỞ RỘNG) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        {['node1', 'node2'].map((nid) => {
          const info = NODE_INFO[nid];
          const isOpen = showDiagram === nid;
          const devCount = devices.filter((d) => d.nodeId === nid).length;
          return (
            <div key={nid} style={{
              background: info.bg, border: `1px solid ${info.border}`,
              borderRadius: 'var(--radius-md)', overflow: 'hidden', transition: 'var(--transition)',
            }}>
              <button
                onClick={() => setShowDiagram(isOpen ? null : nid)}
                style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Cpu size={18} color={info.color} />
                  <span style={{ fontWeight: '700', color: info.color, fontSize: '0.9rem' }}>{info.label}</span>
                  <span style={{ ...info.badgeStyle, padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '700' }}>
                    {info.badge}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                    {devCount} thiết bị · {isOpen ? 'Thu gọn' : 'Xem sơ đồ chân'}
                  </span>
                  <ChevronRight size={16} color="var(--text-dim)" style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: '0.2s' }} />
                </div>
              </button>

              {isOpen && (
                <div style={{ padding: '4px 18px 16px', borderTop: `1px solid ${info.border}` }}>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '6px', marginTop: '10px' }}>
                    Sơ đồ chân cắm phần cứng · Chấm sáng = đang sử dụng
                  </p>
                  <PinDiagram nodeId={nid} />
                </div>
              )}

              {!isOpen && (
                <div style={{ padding: '0 18px 14px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {info.pinDiagram.filter((p) => p.used).map((p) => (
                    <span key={p.pin} style={{
                      padding: '2px 8px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.72rem', fontWeight: '700',
                      background: `${p.color}22`, color: p.color, border: `1px solid ${p.color}44`,
                    }}>
                      {p.pin}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── BẢNG THIẾT BỊ ── */}
      <div className="chart-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="logs-table">
            <thead>
              <tr>
                <th style={{ width: '50px' }}>ID</th>
                <th>Tên Thiết Bị</th>
                <th style={{ width: '160px' }}>Trạm (ESP32)</th>
                <th style={{ width: '155px', color: 'var(--accent-amber)' }}>⚡ Chân Cắm GPIO</th>
                <th>Sơ Đồ Đấu Dây</th>
                <th style={{ width: '195px' }}>MQTT Topic</th>
                <th style={{ width: '90px', textAlign: 'center' }}>Thử Nghiệm</th>
                <th style={{ width: '90px', textAlign: 'center' }}>Sửa / Xóa</th>
              </tr>
            </thead>
            <tbody>
              {filteredDevices.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '32px', fontStyle: 'italic' }}>
                    Chưa có thiết bị nào được đăng ký
                  </td>
                </tr>
              )}
              {filteredDevices.map((device) => {
                const isOn = device.state === 'ON';
                return (
                  <tr key={device.id}>
                    <td style={{ color: 'var(--text-dim)', fontWeight: '600' }}>#{device.id}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {getDeviceIcon(device.type)}
                        <div>
                          <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>{device.name}</div>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>{device.type}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <span style={{
                          padding: '3px 10px', borderRadius: '5px', fontSize: '0.78rem', fontWeight: '700',
                          background: nBg(device.nodeId), color: nColor(device.nodeId),
                          border: `1px solid ${nBdr(device.nodeId)}`, display: 'inline-block',
                        }}>
                          {device.nodeId === 'node1' ? '🛋️ ESP32 #1' : '🛏️ ESP32 #2'}
                        </span>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                          {device.nodeId === 'node1' ? 'Phòng Khách' : 'Phòng Ngủ'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-block', padding: '4px 10px', borderRadius: '6px',
                        fontSize: '0.8rem', fontWeight: '800', fontFamily: 'monospace',
                        background: device.pin ? 'rgba(244,63,94,0.15)' : 'rgba(255,255,255,0.05)',
                        color: device.pin ? '#fda4af' : 'var(--text-dim)',
                        border: device.pin ? '1px solid rgba(244,63,94,0.3)' : '1px dashed var(--border-glass)',
                      }}>
                        {device.pin || 'CHƯA GÁN'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)', maxWidth: '260px' }}>
                      {device.description || <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>Chưa có ghi chú</span>}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--accent-cyan)' }}>
                      <code>{device.mqttTopic}</code>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {onToggle && (
                        <button onClick={() => onToggle(device.id, isOn ? 'OFF' : 'ON')} style={{
                          padding: '4px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                          fontSize: '0.73rem', fontWeight: '700', transition: 'var(--transition)',
                          background: isOn ? 'var(--accent-emerald)' : 'rgba(255,255,255,0.08)',
                          color: isOn ? '#022c22' : 'var(--text-muted)',
                        }}>
                          {isOn ? '● BẬT' : '○ TẮT'}
                        </button>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '5px' }}>
                        <button className="btn-icon" title="Chỉnh sửa chân cắm" onClick={() => openEditModal(device)} style={{ color: 'var(--accent-cyan)' }}>
                          <Edit3 size={14} />
                        </button>
                        <button className="btn-icon" title="Hủy đăng ký" onClick={() => handleDelete(device.id, device.name)} style={{ color: 'var(--accent-rose)' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================================================================ */}
      {/* MODAL ĐĂNG KÝ THIẾT BỊ MỚI (2 BƯỚC)                            */}
      {/* ================================================================ */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PlugZap size={22} color="var(--primary)" />
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem' }}>
                  Đăng Ký Thiết Bị IoT &amp; Gán Chân GPIO
                </h3>
              </div>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* Step indicator */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px', gap: '4px' }}>
              {[{ step: 1, label: 'Chọn Node & Loại thiết bị' }, { step: 2, label: 'Điền thông tin & Chân cắm' }].map((s, i) => (
                <React.Fragment key={s.step}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                    <div style={{
                      width: '26px', height: '26px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: createStep >= s.step ? 'var(--primary)' : 'rgba(255,255,255,0.08)',
                      color: createStep >= s.step ? '#fff' : 'var(--text-dim)',
                      fontSize: '0.78rem', fontWeight: '700', flexShrink: 0,
                    }}>
                      {createStep > s.step ? <Check size={13} /> : s.step}
                    </div>
                    <span style={{ fontSize: '0.78rem', fontWeight: '600', color: createStep >= s.step ? 'var(--text-main)' : 'var(--text-dim)' }}>
                      {s.label}
                    </span>
                  </div>
                  {i < 1 && <div style={{ flex: '0 0 24px', height: '2px', background: createStep > 1 ? 'var(--primary)' : 'rgba(255,255,255,0.1)' }} />}
                </React.Fragment>
              ))}
            </div>

            {createError && (
              <div style={{ background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.3)', padding: '10px 14px', borderRadius: '8px', color: '#f43f5e', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                <AlertCircle size={16} /> {createError}
              </div>
            )}

            {/* ── BƯỚC 1 ── */}
            {createStep === 1 && (
              <div>
                <div className="form-group">
                  <label style={{ fontWeight: '700', fontSize: '0.88rem', marginBottom: '8px', display: 'block' }}>
                    Bước 1a · Chọn Trạm ESP32 (Board nào cắm thiết bị này?)
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {['node1', 'node2'].map((nid) => {
                      const info = NODE_INFO[nid];
                      const sel = formData.nodeId === nid;
                      return (
                        <button key={nid} type="button"
                          onClick={() => applyPreset(nid, formData.type, setFormData)}
                          style={{
                            padding: '12px 14px', borderRadius: '10px', cursor: 'pointer', textAlign: 'left',
                            border: sel ? `2px solid ${info.color}` : '1px solid var(--border-glass)',
                            background: sel ? info.bg : 'rgba(255,255,255,0.02)', transition: 'var(--transition)',
                          }}>
                          <div style={{ fontWeight: '700', color: sel ? info.color : 'var(--text-muted)', fontSize: '0.88rem' }}>{info.label}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '4px' }}>{info.badge}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: '700', fontSize: '0.88rem', marginBottom: '8px', display: 'block' }}>
                    Bước 1b · Chọn Loại Thiết Bị{' '}
                    <span style={{ color: 'var(--accent-cyan)', fontSize: '0.75rem', fontWeight: '500' }}>
                      (Bấm để tự điền chân cắm mẫu cho {NODE_INFO[formData.nodeId]?.shortLabel})
                    </span>
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                    {DEVICE_TYPES.map((dt) => {
                      const preset = PRESETS[formData.nodeId]?.[dt.id];
                      const sel = formData.type === dt.id;
                      const Icon = dt.Icon;
                      return (
                        <button key={dt.id} type="button"
                          onClick={() => applyPreset(formData.nodeId, dt.id, setFormData)}
                          style={{
                            padding: '12px 8px', borderRadius: '10px', cursor: 'pointer',
                            border: sel ? '2px solid var(--accent-emerald)' : '1px solid var(--border-glass)',
                            background: sel ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.02)',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                            transition: 'var(--transition)',
                          }}>
                          <Icon size={18} color={sel ? '#6ee7b7' : 'var(--text-dim)'} />
                          <span style={{ fontSize: '0.78rem', fontWeight: '700', color: sel ? '#6ee7b7' : 'var(--text-muted)' }}>{dt.label}</span>
                          {preset && (
                            <span style={{ fontSize: '0.65rem', color: sel ? '#34d399' : 'var(--text-dim)', fontFamily: 'monospace', fontWeight: '600' }}>
                              → {preset.pin}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Preview preset */}
                {PRESETS[formData.nodeId]?.[formData.type] && (
                  <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '8px', padding: '12px 16px', marginBottom: '4px' }}>
                    <div style={{ fontSize: '0.78rem', color: '#34d399', fontWeight: '700', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Info size={13} /> Chân cắm mẫu sẽ được tự động điền ở bước 2:
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      ⚡ <strong style={{ color: '#fda4af', fontFamily: 'monospace' }}>{PRESETS[formData.nodeId][formData.type].pin}</strong>
                      {' — '}{PRESETS[formData.nodeId][formData.type].description}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                  <button type="button" className="nav-tab-btn" onClick={() => setShowCreateModal(false)}>Hủy</button>
                  <button type="button" className="btn-primary" onClick={handleCreateNext}>
                    Tiếp Theo <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* ── BƯỚC 2 ── */}
            {createStep === 2 && (
              <form onSubmit={handleCreateSubmit}>
                {/* Tóm tắt lựa chọn */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ padding: '4px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '700', background: NODE_INFO[formData.nodeId].bg, color: NODE_INFO[formData.nodeId].color, border: `1px solid ${NODE_INFO[formData.nodeId].border}` }}>
                    {NODE_INFO[formData.nodeId].label}
                  </span>
                  <span style={{ padding: '4px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '700', background: 'rgba(16,185,129,0.15)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.3)' }}>
                    {DEVICE_TYPES.find((d) => d.id === formData.type)?.label}
                  </span>
                  <button type="button" onClick={() => setCreateStep(1)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '0.75rem', textDecoration: 'underline' }}>
                    Thay đổi
                  </button>
                </div>

                <div className="form-group">
                  <label>Tên thiết bị</label>
                  <input type="text" required className="form-input" placeholder="Ví dụ: Đèn LED ngủ Phòng Ngủ"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: '700', color: 'var(--accent-amber)' }}>
                    ⚡ Chân Cắm GPIO (đã điền mẫu — có thể chỉnh sửa tự do)
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <select className="form-select" value={formData.pin}
                      onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                      style={{ borderColor: 'rgba(245,158,11,0.4)' }}>
                      <option value="">-- Chọn từ danh sách --</option>
                      {GPIO_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                    <input type="text" className="form-input" placeholder={'Hoặc tự nhập: GPIO 6 & GPIO 7'}
                      value={formData.pin}
                      onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                      style={{ borderColor: 'rgba(245,158,11,0.4)' }} />
                  </div>
                  <small style={{ color: 'var(--text-dim)', fontSize: '0.72rem', marginTop: '4px', display: 'block' }}>
                    Dropdown và ô nhập đồng bộ nhau. Nhập tự do nếu cần ví dụ: &quot;GPIO 6 &amp; GPIO 7&quot;
                  </small>
                </div>

                <div className="form-group">
                  <label>Sơ đồ &amp; Hướng dẫn đấu dây</label>
                  <textarea className="form-input" rows={3} style={{ resize: 'vertical', fontSize: '0.8rem' }}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Ghi chú: chân nào cắm vào lỗ nào, cực dương/âm..." />
                </div>

                <div className="form-group">
                  <label>MQTT Topic gửi lệnh</label>
                  <input type="text" required className="form-input"
                    value={formData.mqttTopic}
                    onChange={(e) => setFormData({ ...formData, mqttTopic: e.target.value })} />
                  <small style={{ color: 'var(--text-dim)', fontSize: '0.72rem', marginTop: '4px', display: 'block' }}>
                    Lệnh ON/OFF gửi tới: <code>{formData.mqttTopic}/command</code>
                  </small>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                  <button type="button" className="nav-tab-btn" onClick={() => setCreateStep(1)}>← Quay Lại</button>
                  <button type="submit" className="btn-primary">
                    <CheckCircle2 size={17} /> Đăng Ký Thiết Bị
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* MODAL CHỈNH SỬA CHÂN CẮM                                        */}
      {/* ================================================================ */}
      {showEditModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit3 size={20} color="var(--accent-cyan)" />
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem' }}>
                  Chỉnh Sửa Chân Cắm Thiết Bị #{editData.id}
                </h3>
              </div>
              <button onClick={() => setShowEditModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {editError && (
              <div style={{ background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.3)', padding: '10px 14px', borderRadius: '8px', color: '#f43f5e', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                <AlertCircle size={16} /> {editError}
              </div>
            )}

            <form onSubmit={handleEditSubmit}>
              <div className="form-group">
                <label>Tên thiết bị</label>
                <input type="text" required className="form-input"
                  value={editData.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Trạm (Node)</label>
                  <select className="form-select" value={editData.nodeId}
                    onChange={(e) => setEditData({ ...editData, nodeId: e.target.value })}>
                    <option value="node1">🛋️ ESP32 #1 (Phòng Khách)</option>
                    <option value="node2">🛏️ ESP32 #2 (Phòng Ngủ)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Loại thiết bị</label>
                  <select className="form-select" value={editData.type}
                    onChange={(e) => setEditData({ ...editData, type: e.target.value })}>
                    {DEVICE_TYPES.map((dt) => <option key={dt.id} value={dt.id}>{dt.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Nút áp dụng chân mẫu */}
              <div style={{ marginBottom: '14px' }}>
                <button type="button"
                  onClick={() => applyPreset(editData.nodeId, editData.type, setEditData)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px',
                    borderRadius: '7px', cursor: 'pointer', background: 'rgba(16,185,129,0.15)',
                    color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.35)',
                    fontSize: '0.8rem', fontWeight: '600', transition: 'var(--transition)',
                  }}>
                  <Settings size={14} /> Áp Dụng Chân Mẫu ({NODE_INFO[editData.nodeId]?.shortLabel} · {DEVICE_TYPES.find((d) => d.id === editData.type)?.label})
                </button>
                {PRESETS[editData.nodeId]?.[editData.type] && (
                  <small style={{ color: 'var(--text-dim)', fontSize: '0.72rem', marginTop: '4px', display: 'block' }}>
                    Mẫu: <strong style={{ color: '#fda4af', fontFamily: 'monospace' }}>{PRESETS[editData.nodeId][editData.type].pin}</strong>
                    {' — '}{PRESETS[editData.nodeId][editData.type].description}
                  </small>
                )}
              </div>

              <div className="form-group">
                <label style={{ fontWeight: '700', color: 'var(--accent-amber)' }}>⚡ Chân Cắm GPIO</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <select className="form-select" value={editData.pin}
                    onChange={(e) => setEditData({ ...editData, pin: e.target.value })}
                    style={{ borderColor: 'rgba(245,158,11,0.4)' }}>
                    <option value="">-- Chọn chân --</option>
                    {GPIO_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <input type="text" className="form-input" placeholder="Hoặc tự nhập chân cắm"
                    value={editData.pin}
                    onChange={(e) => setEditData({ ...editData, pin: e.target.value })}
                    style={{ borderColor: 'rgba(245,158,11,0.4)' }} />
                </div>
              </div>

              <div className="form-group">
                <label>Sơ đồ &amp; Ghi chú đấu dây</label>
                <textarea className="form-input" rows={3} style={{ resize: 'vertical', fontSize: '0.8rem' }}
                  value={editData.description}
                  onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                  placeholder="Ghi chú cách đấu dây chi tiết..." />
              </div>

              <div className="form-group">
                <label>MQTT Topic</label>
                <input type="text" required className="form-input"
                  value={editData.mqttTopic}
                  onChange={(e) => setEditData({ ...editData, mqttTopic: e.target.value })} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" className="nav-tab-btn" onClick={() => setShowEditModal(false)}>Hủy</button>
                <button type="submit" className="btn-primary">
                  <Check size={17} /> Lưu Thay Đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

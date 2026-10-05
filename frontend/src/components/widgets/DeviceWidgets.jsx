import React, { useState } from 'react';
import {
  Lightbulb, Zap, Fan, Gauge, MapPin, WifiOff, Power, PowerOff, Sun,
  ArrowRight, X, History, BellRing, Cpu, Activity, Info,
} from 'lucide-react';
import WidgetCard, { EmptyState } from './WidgetCard';
import { timeAgo, SEVERITY_META } from '../../hooks/useAlarms';
import { deriveTrigger } from '../../utils/triggers';

const ROOM = { node1: 'Phòng Khách', node2: 'Phòng Ngủ' };
const NODE_LABEL = { node1: 'ESP32 #1', node2: 'ESP32 #2' };
const ACCENT = { relay: '#f59e0b', fan: '#06b6d4', sensor: '#10b981', led: '#fbbf24' };

export function deviceIcon(type, size = 18, isOn = false) {
  switch (type) {
    case 'relay': return <Zap size={size} />;
    case 'fan': return <Fan size={size} className={isOn ? 'spin-icon' : ''} />;
    case 'sensor': return <Gauge size={size} />;
    case 'led':
    default: return <Lightbulb size={size} />;
  }
}

// =========================================================
// CONTROL WIDGET — điều khiển thiết bị THẬT:
//   Dashboard → POST /api/devices/:id/command → Backend → MQTT {topic}/command → ESP32
// Mọi thao tác đều gọi API hiện có rồi chờ trạng thái thật phản hồi về qua MQTT.
// =========================================================
export function ControlWidget({ device, nodeStatus, onToggle, onBrightness, now, span = 4 }) {
  const [busy, setBusy] = useState(false);
  const [lastCmd, setLastCmd] = useState(null);
  const [brightness, setBrightness] = useState(device.brightness ?? 0);

  const isOn = device.state === 'ON';
  const isLed = device.type === 'led';
  const nodeOnline = nodeStatus !== 'offline';
  const accent = ACCENT[device.type] || '#6366f1';

  React.useEffect(() => {
    setBrightness(device.brightness ?? (device.state === 'ON' ? 100 : 0));
  }, [device.brightness, device.state]);

  const send = async (action) => {
    setBusy(true);
    setLastCmd({ action, at: new Date() });
    try {
      await onToggle(device.id, action);
    } finally {
      setBusy(false);
    }
  };

  const sendBrightness = async (value) => {
    setBrightness(value);
    setLastCmd({ action: `SET:${value}`, at: new Date() });
    await onBrightness(device.id, value);
  };

  return (
    <WidgetCard
      title={device.name}
      subtitle={`${NODE_LABEL[device.nodeId] || device.nodeId} · ${ROOM[device.nodeId] || ''} · ${device.type.toUpperCase()}`}
      icon={Zap}
      accent={accent}
      span={span}
      toolbar={
        <>
          <span className={`status-chip tone-${isOn ? 'ok' : 'neutral'}`}>{isOn ? 'ĐANG BẬT' : 'ĐANG TẮT'}</span>
          <span className={`status-chip tone-${nodeOnline ? 'ok' : 'error'}`} title="Trạng thái trạm ESP32 qua MQTT LWT">
            {nodeOnline ? 'NODE ONLINE' : 'NODE OFFLINE'}
          </span>
        </>
      }
    >
      <div className="control-block">
        <div className="control-head">
          <span
            className="control-icon"
            style={{ color: accent, background: `${accent}1f`, borderColor: `${accent}3d` }}
          >
            {deviceIcon(device.type, 20, isOn)}
          </span>
          <div className="control-meta">
            {device.pin && (
              <span className="device-pin-chip">
                <MapPin size={11} /> {device.pin}
              </span>
            )}
            <span className="control-seen">
              Phản hồi cuối: {device.lastSeen ? timeAgo(device.lastSeen, now) : 'chưa có'}
            </span>
          </div>
        </div>

        <div className="control-buttons">
          <button type="button" className="ctrl-btn on" disabled={busy || isOn} onClick={() => send('ON')}>
            <Power size={15} /> TURN ON
          </button>
          <button type="button" className="ctrl-btn off" disabled={busy || !isOn} onClick={() => send('OFF')}>
            <PowerOff size={15} /> TURN OFF
          </button>
        </div>

        {isLed && (
          <div className="brightness-control">
            <div className="brightness-header">
              <span className="brightness-label">
                <Sun size={13} /> Độ sáng (PWM)
              </span>
              <span className="brightness-value">{brightness}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={brightness}
              disabled={busy}
              onChange={(e) => setBrightness(Number(e.target.value))}
              onMouseUp={(e) => sendBrightness(Number(e.target.value))}
              onTouchEnd={(e) => sendBrightness(Number(e.target.value))}
              className="brightness-slider"
              style={{ '--fill': `${brightness}%` }}
            />
          </div>
        )}

        {!nodeOnline && (
          <div className="device-offline-warn">
            <WifiOff size={13} />
            <span>
              Trạm <b>{device.nodeId.toUpperCase()}</b> đang OFFLINE — lệnh được ghi vào CSDL
              nhưng chưa chắc tới mạch.
            </span>
          </div>
        )}

        <div className="cmd-path">
          <span className="cmd-path-label">Đường đi của lệnh</span>
          <div className="cmd-path-chain">
            <span>Dashboard</span>
            <ArrowRight size={11} />
            <span className="cmd-path-api">POST /api/devices/{device.id}/command</span>
            <ArrowRight size={11} />
            <span>Backend</span>
            <ArrowRight size={11} />
            <span className="cmd-path-topic">MQTT {device.mqttTopic}/command</span>
            <ArrowRight size={11} />
            <span>ESP32</span>
          </div>
          <div className="cmd-path-last">
            {busy
              ? 'Đang gửi lệnh...'
              : lastCmd
                ? `Lệnh gần nhất: ${lastCmd.action} lúc ${lastCmd.at.toLocaleTimeString('vi-VN')}`
                : 'Chưa gửi lệnh nào từ Dashboard'}
          </div>
        </div>
      </div>
    </WidgetCard>
  );
}

// =========================================================
// DEVICE TABLE WIDGET — bảng entity kiểu IoT platform.
// Click 1 dòng để mở chi tiết thiết bị (drill-down).
// =========================================================
export function DeviceTableWidget({ devices, nodeStatuses, now, onToggle, onSelect, span = 12 }) {
  const sorted = [...devices].sort((a, b) => (a.type === 'sensor' ? 1 : 0) - (b.type === 'sensor' ? 1 : 0));

  return (
    <WidgetCard
      title="Danh sách thiết bị"
      subtitle={`${devices.length} thiết bị · click một dòng để xem chi tiết`}
      icon={Cpu}
      accent="#6366f1"
      span={span}
      footer={
        <div className="widget-note">
          <Info size={12} />
          <span>Chân GPIO và MQTT topic hiển thị đúng theo dữ liệu đã đăng ký trong CSDL.</span>
        </div>
      }
    >
      {devices.length === 0 ? (
        <EmptyState icon={Cpu} text="Chưa có thiết bị nào" hint="Vào mục Thiết bị để đăng ký" />
      ) : (
        <div className="tw-scroll">
          <table className="entity-table">
            <thead>
              <tr>
                <th style={{ width: 64 }}>ID</th>
                <th>Thiết bị</th>
                <th style={{ width: 130 }}>Node</th>
                <th style={{ width: 120 }}>Chân GPIO</th>
                <th style={{ width: 175 }}>MQTT topic</th>
                <th style={{ width: 90 }}>Trạng thái</th>
                <th style={{ width: 96 }}>Node</th>
                <th style={{ width: 130 }}>Phản hồi cuối</th>
                <th style={{ width: 84 }} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((d) => {
                const isOn = d.state === 'ON';
                const online = nodeStatuses[d.nodeId] !== 'offline';
                const accent = ACCENT[d.type] || '#6366f1';
                return (
                  <tr key={d.id} className="entity-row" onClick={() => onSelect && onSelect(d)}>
                    <td className="mono dim">#{d.id}</td>
                    <td>
                      <div className="cell-device">
                        <span
                          className="cell-icon"
                          style={{ color: accent, background: `${accent}1f`, borderColor: `${accent}3d` }}
                        >
                          {deviceIcon(d.type, 14, isOn)}
                        </span>
                        <div className="cell-device-text">
                          <div className="cell-name">{d.name}</div>
                          <span className="cell-sub">{(d.type || '').toUpperCase()}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="chip-node">{NODE_LABEL[d.nodeId] || d.nodeId}</div>
                      <div className="cell-sub">{ROOM[d.nodeId] || ''}</div>
                    </td>
                    <td className="mono">{d.pin || '—'}</td>
                    <td className="mono small">{d.mqttTopic}</td>
                    <td>
                      <span className={`status-chip tone-${isOn ? 'ok' : 'neutral'}`}>{isOn ? 'ON' : 'OFF'}</span>
                    </td>
                    <td>
                      <span className={`status-chip tone-${online ? 'ok' : 'error'}`}>
                        {online ? 'ONLINE' : 'OFFLINE'}
                      </span>
                    </td>
                    <td className="cell-sub">{d.lastSeen ? timeAgo(d.lastSeen, now) : '—'}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {d.type !== 'sensor' && onToggle && (
                        <button
                          type="button"
                          className={`mini-ctrl ${isOn ? 'off' : 'on'}`}
                          onClick={() => onToggle(d.id, isOn ? 'OFF' : 'ON')}
                        >
                          {isOn ? 'TẮT' : 'BẬT'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </WidgetCard>
  );
}

// =========================================================
// DEVICE DETAIL (drill-down) — mô phỏng trang chi tiết thiết bị kiểu
// ThingsBoard nhưng chỉ dùng dữ liệu project THẬT có:
//   Tổng quan | Điều khiển | Cảnh báo (suy ra) | Nhật ký (activity log)
// =========================================================
const DETAIL_TABS = [
  { key: 'overview', label: 'Tổng quan', icon: Cpu },
  { key: 'control', label: 'Điều khiển', icon: Power },
  { key: 'alarms', label: 'Cảnh báo', icon: BellRing },
  { key: 'logs', label: 'Nhật ký', icon: History },
];

export function DeviceDetailDrawer({
  device, nodeStatus, sensorReading, alarms = [], logs = [], now, onClose, onToggle, onBrightness,
}) {
  const [tab, setTab] = useState('overview');
  const [brightness, setBrightness] = useState(0);
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (device) setBrightness(device.brightness ?? (device.state === 'ON' ? 100 : 0));
  }, [device]);

  if (!device) return null;

  const isOn = device.state === 'ON';
  const isLed = device.type === 'led';
  const isSensor = device.type === 'sensor';
  const online = nodeStatus !== 'offline';
  const accent = ACCENT[device.type] || '#6366f1';
  const nodeAlarms = alarms.filter((a) => a.nodeId === device.nodeId);
  const deviceLogs = logs.filter((l) => l.deviceId === device.id).slice(0, 15);

  const run = async (action) => {
    setBusy(true);
    try {
      await onToggle(device.id, action);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <header className="drawer-head">
          <span
            className="drawer-icon"
            style={{ color: accent, background: `${accent}1f`, borderColor: `${accent}3d` }}
          >
            {deviceIcon(device.type, 20, isOn)}
          </span>
          <div className="drawer-title">
            <h3>{device.name}</h3>
            <div className="drawer-sub">
              #{device.id} · {(device.type || '').toUpperCase()} · {NODE_LABEL[device.nodeId] || device.nodeId}
            </div>
          </div>
          <button type="button" className="drawer-close" onClick={onClose} title="Đóng">
            <X size={18} />
          </button>
        </header>

        <div className="drawer-tabs">
          {DETAIL_TABS.map((t) => {
            const Icon = t.icon;
            const count = t.key === 'alarms' ? nodeAlarms.length : t.key === 'logs' ? deviceLogs.length : null;
            return (
              <button
                key={t.key}
                type="button"
                className={`drawer-tab ${tab === t.key ? 'active' : ''}`}
                onClick={() => setTab(t.key)}
              >
                <Icon size={14} /> {t.label}
                {count ? <span className="drawer-tab-count">{count}</span> : null}
              </button>
            );
          })}
        </div>

        <div className="drawer-body">
          {tab === 'overview' && (
            <>
              <dl className="kv-grid">
                <div><dt>Loại</dt><dd>{(device.type || '').toUpperCase()}</dd></div>
                <div><dt>Trạm</dt><dd>{NODE_LABEL[device.nodeId] || device.nodeId} · {ROOM[device.nodeId] || ''}</dd></div>
                <div><dt>Chân GPIO</dt><dd className="mono">{device.pin || 'chưa gán'}</dd></div>
                <div>
                  <dt>Trạng thái</dt>
                  <dd>
                    <span className={`status-chip tone-${isOn ? 'ok' : 'neutral'}`}>{isOn ? 'ON' : 'OFF'}</span>{' '}
                    <span className={`status-chip tone-${online ? 'ok' : 'error'}`}>{online ? 'ONLINE' : 'OFFLINE'}</span>
                  </dd>
                </div>
                <div><dt>MQTT lệnh</dt><dd className="mono">{device.mqttTopic}/command</dd></div>
                <div><dt>MQTT trạng thái</dt><dd className="mono">{device.mqttTopic}/state</dd></div>
                <div><dt>Phản hồi cuối</dt><dd>{device.lastSeen ? timeAgo(device.lastSeen, now) : 'chưa có'}</dd></div>
                <div><dt>Đăng ký lúc</dt><dd>{device.createdAt ? new Date(device.createdAt).toLocaleString('vi-VN') : '—'}</dd></div>
              </dl>

              {device.description && (
                <div className="drawer-note">
                  <Info size={13} />
                  <span>{device.description}</span>
                </div>
              )}

              {sensorReading && (
                <div className="drawer-section">
                  <div className="drawer-section-title">
                    Telemetry mới nhất của trạm {device.nodeId.toUpperCase()}
                  </div>
                  <div className="telemetry-inline">
                    <div>
                      <span className="ti-label">Nhiệt độ</span>
                      <span className="ti-value">{Number(sensorReading.temperature).toFixed(1)} °C</span>
                    </div>
                    <div>
                      <span className="ti-label">Độ ẩm</span>
                      <span className="ti-value">{Number(sensorReading.humidity).toFixed(1)} %</span>
                    </div>
                    <div>
                      <span className="ti-label">Cập nhật</span>
                      <span className="ti-value small">{timeAgo(sensorReading.createdAt, now)}</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {tab === 'control' && (
            isSensor ? (
              <EmptyState icon={Gauge} text="Cảm biến chỉ đọc" hint="DHT11 không nhận lệnh điều khiển" />
            ) : (
              <>
                <div className="control-buttons">
                  <button type="button" className="ctrl-btn on" disabled={busy || isOn} onClick={() => run('ON')}>
                    <Power size={15} /> TURN ON
                  </button>
                  <button type="button" className="ctrl-btn off" disabled={busy || !isOn} onClick={() => run('OFF')}>
                    <PowerOff size={15} /> TURN OFF
                  </button>
                </div>

                {isLed && (
                  <div className="brightness-control" style={{ marginTop: 14 }}>
                    <div className="brightness-header">
                      <span className="brightness-label"><Sun size={13} /> Độ sáng (PWM)</span>
                      <span className="brightness-value">{brightness}%</span>
                    </div>
                    <input
                      type="range" min="0" max="100" step="1" value={brightness} disabled={busy}
                      onChange={(e) => setBrightness(Number(e.target.value))}
                      onMouseUp={(e) => onBrightness(device.id, Number(e.target.value))}
                      onTouchEnd={(e) => onBrightness(device.id, Number(e.target.value))}
                      className="brightness-slider" style={{ '--fill': `${brightness}%` }}
                    />
                  </div>
                )}

                <div className="cmd-path">
                  <span className="cmd-path-label">Đường đi của lệnh</span>
                  <div className="cmd-path-chain">
                    <span>Dashboard</span>
                    <ArrowRight size={11} />
                    <span className="cmd-path-api">POST /api/devices/{device.id}/command</span>
                    <ArrowRight size={11} />
                    <span className="cmd-path-topic">MQTT {device.mqttTopic}/command</span>
                    <ArrowRight size={11} />
                    <span>ESP32</span>
                  </div>
                </div>
              </>
            )
          )}

          {tab === 'alarms' && (
            nodeAlarms.length === 0 ? (
              <EmptyState
                icon={BellRing}
                text="Không có cảnh báo cho trạm này"
                hint="Các luật đang bật đều nằm trong ngưỡng an toàn"
              />
            ) : (
              <ul className="alarm-list">
                {nodeAlarms.map((a) => {
                  const meta = SEVERITY_META[a.severity];
                  return (
                    <li className="alarm-item" key={a.id} style={{ borderLeftColor: meta.color }}>
                      <div className="alarm-top">
                        <span className="alarm-sev" style={{ color: meta.color, background: meta.bg }}>{meta.label}</span>
                        <span className="alarm-time">{timeAgo(a.time, now) || '—'}</span>
                      </div>
                      <div className="alarm-title">{a.title}</div>
                      <div className="alarm-detail">{a.detail}</div>
                    </li>
                  );
                })}
              </ul>
            )
          )}

          {tab === 'logs' && (
            deviceLogs.length === 0 ? (
              <EmptyState icon={History} text="Chưa có bản ghi cho thiết bị này" hint="Thao tác điều khiển sẽ được ghi lại" />
            ) : (
              <ul className="feed-list">
                {deviceLogs.map((log) => {
                  const t = deriveTrigger(log);
                  return (
                    <li className="feed-item" key={log.id}>
                      <span className={`badge-source ${t.cls}`}>{t.label}</span>
                      <div className="feed-body">
                        <div className="feed-action">{log.action}</div>
                        <div className="feed-meta">{timeAgo(log.createdAt, now) || '—'}</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )
          )}
        </div>
      </aside>
    </div>
  );
}

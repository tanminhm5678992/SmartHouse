import React, { useState } from 'react';
import { Cpu, RadioTower, WifiOff, Zap, BellRing, History, ShieldCheck, Info } from 'lucide-react';
import WidgetCard, { EmptyState } from './WidgetCard';
import { SEVERITY_META, timeAgo } from '../../hooks/useAlarms';
import { deriveTrigger } from '../../utils/triggers';

// =========================================================
// KPI STRIP — dải widget số liệu, tương tự hàng "cards" của IoT platform.
// Mọi con số đều tính từ dữ liệu THẬT đang có trong state của App.
// =========================================================
export function KpiStrip({ devices, nodeStatuses, alarms, isSocketConnected }) {
  const actuators = devices.filter((d) => d.type !== 'sensor');
  const sensors = devices.filter((d) => d.type === 'sensor');
  const activeActuators = actuators.filter((d) => d.state === 'ON').length;
  const onlineNodes = Object.values(nodeStatuses).filter((s) => s === 'online').length;
  const offlineNodes = 2 - onlineNodes;

  const critical = alarms.filter((a) => a.severity === 'critical').length;
  const warning = alarms.filter((a) => a.severity === 'warning').length;
  const offlineAlarms = alarms.filter((a) => a.severity === 'offline').length;

  const items = [
    {
      key: 'devices',
      icon: Cpu,
      accent: '#6366f1',
      label: 'Thiết bị đã đăng ký',
      value: devices.length,
      sub: `${actuators.length} chấp hành · ${sensors.length} cảm biến`,
    },
    {
      key: 'online',
      icon: RadioTower,
      accent: '#10b981',
      label: 'Node online',
      value: `${onlineNodes}/2`,
      sub: isSocketConnected ? 'Kênh realtime đang mở' : 'Mất Socket.IO',
    },
    {
      key: 'offline',
      icon: WifiOff,
      accent: '#f43f5e',
      label: 'Node offline',
      value: `${offlineNodes}/2`,
      sub: offlineAlarms > 0 ? 'Có cảnh báo mất kết nối' : 'Không có cảnh báo mất kết nối',
    },
    {
      key: 'active',
      icon: Zap,
      accent: '#f59e0b',
      label: 'Chấp hành đang bật',
      value: `${activeActuators}/${actuators.length}`,
      sub: 'Trạng thái đọc từ CSDL',
    },
    {
      key: 'alarms',
      icon: BellRing,
      accent: critical > 0 ? '#f43f5e' : warning > 0 ? '#f59e0b' : '#10b981',
      label: 'Cảnh báo đang có',
      value: alarms.length,
      sub: `${critical} nguy hiểm · ${warning} cảnh báo · ${offlineAlarms} offline`,
    },
  ];

  return (
    <div className="kpi-strip">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <div className="kpi-card" key={it.key}>
            <span
              className="kpi-icon"
              style={{ color: it.accent, background: `${it.accent}1f`, borderColor: `${it.accent}3d` }}
            >
              <Icon size={17} />
            </span>
            <div className="kpi-text">
              <div className="kpi-label">{it.label}</div>
              <div className="kpi-value">{it.value}</div>
              <div className="kpi-sub">{it.sub}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// =========================================================
// ALARM WIDGET — Cảnh báo SUY RA từ dữ liệu thật (luật đang bật + kết nối).
// Project không có Alarm API nên KHÔNG có nút "xác nhận/xoá" giả.
// =========================================================
const SEV_FILTERS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'critical', label: 'Nguy hiểm' },
  { key: 'warning', label: 'Cảnh báo' },
  { key: 'offline', label: 'Offline' },
];

export function AlarmWidget({ alarms, now, span = 4 }) {
  const [sev, setSev] = useState('all');
  const list = sev === 'all' ? alarms : alarms.filter((a) => a.severity === sev);

  return (
    <WidgetCard
      title="Cảnh báo"
      subtitle={`${alarms.length} mục đang hoạt động · suy ra từ luật bật + kết nối`}
      icon={BellRing}
      accent={alarms.length ? '#f43f5e' : '#10b981'}
      span={span}
      toolbar={
        <div className="widget-seg">
          {SEV_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`widget-seg-btn ${sev === f.key ? 'active' : ''}`}
              onClick={() => setSev(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      }
      footer={
        <div className="widget-note">
          <Info size={12} />
          <span>
            Chưa có bảng alarms trong CSDL — các mục trên được tính lại mỗi khi dữ liệu đổi,
            nên không có trạng thái “đã xác nhận”.
          </span>
        </div>
      }
    >
      {list.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          text={alarms.length === 0 ? 'Không có cảnh báo' : 'Không có mục nào ở mức này'}
          hint="Toàn bộ luật đang bật đều nằm trong ngưỡng an toàn"
        />
      ) : (
        <ul className="alarm-list">
          {list.map((a) => {
            const meta = SEVERITY_META[a.severity];
            return (
              <li className="alarm-item" key={a.id} style={{ borderLeftColor: meta.color }}>
                <div className="alarm-top">
                  <span className="alarm-sev" style={{ color: meta.color, background: meta.bg }}>
                    {meta.label}
                  </span>
                  <span className="alarm-time">{timeAgo(a.time, now) || 'chưa có mốc'}</span>
                </div>
                <div className="alarm-title">{a.title}</div>
                <div className="alarm-detail">{a.detail}</div>
                <div className="alarm-meta">
                  <span className="alarm-origin">{a.origin}</span>
                  {a.nodeId && <span className="alarm-node">{a.nodeId.toUpperCase()}</span>}
                  {a.deviceName && <span className="alarm-node">→ {a.deviceName}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </WidgetCard>
  );
}

// =========================================================
// ACTIVITY FEED WIDGET — n bản ghi mới nhất từ /api/logs
// =========================================================
export function ActivityFeedWidget({ logs, now, limit = 8, span = 4 }) {
  const items = logs.slice(0, limit);

  return (
    <WidgetCard
      title="Sự kiện gần đây"
      subtitle={`${items.length} bản ghi mới nhất từ /api/logs`}
      icon={History}
      accent="#8b5cf6"
      span={span}
    >
      {items.length === 0 ? (
        <EmptyState icon={History} text="Chưa có bản ghi nào" hint="Thao tác điều khiển sẽ xuất hiện tại đây" />
      ) : (
        <ul className="feed-list">
          {items.map((log) => {
            const t = deriveTrigger(log);
            return (
              <li className="feed-item" key={log.id}>
                <span className={`badge-source ${t.cls}`}>{t.label}</span>
                <div className="feed-body">
                  <div className="feed-action">{log.action}</div>
                  <div className="feed-meta">
                    {log.device?.name ? `${log.device.name} · ` : ''}
                    {timeAgo(log.createdAt, now) || '—'}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </WidgetCard>
  );
}

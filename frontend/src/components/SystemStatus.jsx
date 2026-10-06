import React from 'react';
import {
  Cpu, RadioTower, Cloud, Server, Database, Home, MonitorSmartphone,
  ExternalLink, ArrowRight, Router, WifiOff, Cable, Globe
} from 'lucide-react';

// =========================================================
// Bảng "Kiến trúc 5 tầng & Tình trạng hệ thống"
// Phản ánh ĐÚNG kiến trúc thật của dự án (theo docker-compose.yml):
//   ESP32-C3 → Mosquitto (gateway) → EMQX (server) → Backend + PostgreSQL → Web React
// Chỉ báo trạng thái LIVE khi suy ra được từ dữ liệu Socket.IO/REST hiện có.
// Những gì trình duyệt KHÔNG thể kiểm tra sẽ ghi rõ, không báo xanh giả.
// =========================================================

// Cổng/dịch vụ lấy từ docker-compose.yml
const SERVICES = [
  { name: 'EMQX Dashboard', desc: 'Quản trị Broker Server', url: 'http://localhost:18083', port: '18083', auth: 'admin / public' },
  { name: 'Backend REST API', desc: 'Health check', url: 'http://localhost:4000/api/health', port: '4000', auth: 'Không cần' },
  { name: 'React Dashboard', desc: 'Trang đang xem', url: null, port: '3000', auth: '—' },
];

const ROOM_LABEL = { node1: 'Phòng Khách', node2: 'Phòng Ngủ' };
const NODE_LABEL = { node1: 'ESP32 #1', node2: 'ESP32 #2' };

// Đổi mốc thời gian thành chuỗi "x giây/phút trước"
function timeAgo(ts) {
  if (!ts) return null;
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (Number.isNaN(diff)) return null;
  if (diff < 0) return 'vừa xong';
  if (diff < 60) return `${diff} giây trước`;
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  return `${Math.floor(diff / 86400)} ngày trước`;
}

function StatusPill({ kind, children }) {
  return <span className={`sys-pill ${kind}`}>{children}</span>;
}

export default function SystemStatus({
  nodeStatuses,
  sensorData,
  devices,
  isSocketConnected,
  automations = [],
  schedules = [],
}) {
  const nodeIds = ['node1', 'node2'];
  const onlineCount = nodeIds.filter((n) => nodeStatuses?.[n] === 'online').length;
  const hasDevices = devices.length > 0;
  const enabledRules = automations.filter((a) => a.enabled).length;
  const enabledSchedules = schedules.filter((s) => s.enabled).length;

  // Tầng 2 (Mosquitto Local): suy luận trung thực — ESP32 chỉ nói chuyện được với Broker Local.
  const localBrokerLive = onlineCount > 0;
  // Tầng 4 (Backend): Socket.IO đang kết nối ⇒ backend chắc chắn sống.
  const backendKind = isSocketConnected ? 'ok' : 'error';
  // Tầng 4 (PostgreSQL): đọc được danh sách thiết bị qua REST ⇒ DB có dữ liệu.
  const dbKind = hasDevices ? 'ok' : 'warn';

  const layers = [
    {
      n: 1,
      title: 'Tầng 1 · Thiết bị Edge',
      subtitle: '2 trạm ESP32-C3 + DHT11, Relay, LED, Quạt mini',
      Icon: Cpu,
      color: '#06b6d4',
      status: <StatusPill kind={onlineCount > 0 ? 'ok' : 'error'}>{onlineCount}/2 node online</StatusPill>,
      details: nodeIds.map((id) => {
        const online = nodeStatuses?.[id] === 'online';
        const reading = sensorData?.[id];
        return (
          <div className="sys-node-line" key={id}>
            <span className={`status-dot ${online ? 'online' : 'offline'}`} />
            <b>{NODE_LABEL[id]}</b>
            <span className="sys-dim">{ROOM_LABEL[id]}</span>
            <span className="sys-dim">
              {online
                ? reading?.createdAt
                  ? `DHT11 cập nhật ${timeAgo(reading.createdAt)}`
                  : 'Đang chờ bản tin đầu tiên'
                : 'Mất kết nối (LWT offline)'}
            </span>
          </div>
        );
      }),
    },
    {
      n: 2,
      title: 'Tầng 2 · MQTT Broker Local (Gateway)',
      subtitle: 'Mosquitto 2.0 · cổng 1883 cho ESP32 trong mạng nội bộ',
      Icon: Router,
      color: '#10b981',
      status: (
        <StatusPill kind={localBrokerLive ? 'ok' : 'warn'}>
          {localBrokerLive ? 'Đang nhận dữ liệu thiết bị' : 'Không có thiết bị kết nối'}
        </StatusPill>
      ),
      details: (
        <div className="sys-node-line">
          <Cable size={13} color="var(--text-dim)" />
          <span className="sys-dim">
            Cầu Bridge chuyển tiếp 2 chiều topic <code>home/#</code> (QoS 1) → <code>broker_server:1883</code>
          </span>
        </div>
      ),
    },
    {
      n: 3,
      title: 'Tầng 3 · MQTT Broker Server',
      subtitle: 'EMQX 5.6.1 · TCP 1884 · WebSocket 8083 · Dashboard 18083',
      Icon: Cloud,
      color: '#8b5cf6',
      status: (
        <StatusPill kind={localBrokerLive ? 'ok' : 'unknown'}>
          {localBrokerLive ? 'Đang nhận bản tin qua Bridge' : 'Chưa xác thực từ trình duyệt'}
        </StatusPill>
      ),
      details: (
        <div className="sys-node-line">
          <Globe size={13} color="var(--text-dim)" />
          <span className="sys-dim">
            Backend kết nối <code>mqtt://broker_server:1883</code>, subscribe{' '}
            <code>home/sensor/+/telemetry</code>, <code>home/sensor/+/status</code>, <code>home/device/+/state</code>
          </span>
        </div>
      ),
    },
    {
      n: 4,
      title: 'Tầng 4 · Backend & Cơ sở dữ liệu',
      subtitle: 'Node.js + Express · Socket.IO · Prisma ORM · PostgreSQL 16',
      Icon: Server,
      color: '#6366f1',
      status: (
        <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
          <StatusPill kind={backendKind}>{isSocketConnected ? 'API + Socket.IO online' : 'Mất kết nối API'}</StatusPill>
          <StatusPill kind={dbKind}>{hasDevices ? `PostgreSQL: ${devices.length} thiết bị` : 'PostgreSQL: chưa có dữ liệu'}</StatusPill>
        </span>
      ),
      details: (
        <div className="sys-node-line">
          <Database size={13} color="var(--text-dim)" />
          <span className="sys-dim">
            {enabledRules} luật tự động hóa · {enabledSchedules} lịch hẹn đang bật ·{' '}
            {devices.filter((d) => d.type !== 'sensor').length} thiết bị chấp hành
          </span>
        </div>
      ),
    },
    {
      n: 5,
      title: 'Tầng 5 · Ứng dụng người dùng',
      subtitle: 'ReactJS (Nginx :3000)',
      Icon: MonitorSmartphone,
      color: '#f59e0b',
      status: <StatusPill kind="ok">Web Dashboard đang mở</StatusPill>,
      details: (
        <div className="sys-node-line">
          <Home size={13} color="var(--text-dim)" />
          <span className="sys-dim">
            Dashboard điều khiển thiết bị qua REST API + nhận realtime qua Socket.IO (JWT)
          </span>
        </div>
      ),
    },
  ];

  return (
    <section>
      <div className="section-header">
        <div className="section-title">
          <RadioTower size={20} color="var(--primary)" />
          <span>Kiến Trúc Hệ Thống &amp; Tình Trạng Kết Nối</span>
          <span className="tag">5 Tầng · Live</span>
        </div>
      </div>

      <div className="sys-grid">
        {/* Cột trái: sơ đồ 5 tầng */}
        <div className="sys-layers">
          {layers.map((layer, idx) => (
            <React.Fragment key={layer.n}>
              <div className="sys-layer">
                <div
                  className="sys-layer-icon"
                  style={{ color: layer.color, background: `${layer.color}1f`, borderColor: `${layer.color}44` }}
                >
                  <layer.Icon size={18} />
                </div>
                <div className="sys-layer-body">
                  <div className="sys-layer-head">
                    <span className="sys-layer-title">{layer.title}</span>
                    {layer.status}
                  </div>
                  <div className="sys-layer-sub">{layer.subtitle}</div>
                  <div className="sys-layer-details">{layer.details}</div>
                </div>
              </div>
              {idx < layers.length - 1 && (
                <div className="sys-connector">
                  <ArrowRight size={14} color="var(--text-dim)" />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Cột phải: liên kết dịch vụ */}
        <div className="sys-services">
          <div className="sys-services-head">
            <ExternalLink size={15} color="var(--accent-cyan)" />
            <span>Dịch Vụ &amp; Cổng Truy Cập</span>
          </div>

          {SERVICES.map((svc) => (
            <a
              key={svc.name}
              className={`sys-service-item ${svc.url ? '' : 'disabled'}`}
              href={svc.url || undefined}
              target="_blank"
              rel="noopener noreferrer"
            >
              <div>
                <div className="sys-service-name">{svc.name}</div>
                <div className="sys-service-desc">
                  {svc.desc} · <code>:{svc.port}</code> · {svc.auth}
                </div>
              </div>
              {svc.url ? (
                <ExternalLink size={14} color="var(--accent-cyan)" />
              ) : (
                <span className="sys-dim" style={{ fontSize: '0.72rem' }}>đang xem</span>
              )}
            </a>
          ))}

          <div className="sys-note">
            <WifiOff size={13} />
            <span>
              Trạng thái EMQX không thể kiểm tra từ trình duyệt nên chỉ hiển thị
              trạng thái suy luận (có/không có bản tin qua Bridge) — bấm vào để mở trực tiếp.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

import React from 'react';
import {
  LayoutDashboard, Cpu, LineChart, SlidersHorizontal, Workflow, CalendarClock,
  BellRing, History, ServerCog, ChevronsLeft, ChevronsRight, Home,
} from 'lucide-react';

// =========================================================
// SIDEBAR theo tinh thần ThingsBoard: nhóm menu rõ ràng, thu gọn được,
// chỉ giữ những mục TƯƠNG ỨNG CHỨC NĂNG THẬT của project.
// (Không có User Management / Tenants / Assets / Rule chains ⇒ không tạo menu)
// =========================================================
export const NAV_GROUPS = [
  {
    label: 'Giám sát',
    items: [
      { key: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard, hint: 'Widget workspace' },
      { key: 'devices', label: 'Thiết bị', icon: Cpu, hint: 'Đăng ký & chân GPIO' },
      { key: 'telemetry', label: 'Telemetry', icon: LineChart, hint: 'Lịch sử cảm biến' },
    ],
  },
  {
    label: 'Điều khiển',
    items: [
      { key: 'controls', label: 'Điều khiển', icon: SlidersHorizontal, hint: 'Relay / LED / Quạt' },
      { key: 'automations', label: 'Tự động hóa', icon: Workflow, hint: 'Luật theo ngưỡng' },
      { key: 'schedules', label: 'Lịch hẹn', icon: CalendarClock, hint: 'Bật/tắt theo giờ' },
    ],
  },
  {
    label: 'Sự kiện',
    items: [
      { key: 'alarms', label: 'Cảnh báo', icon: BellRing, hint: 'Suy ra từ luật & kết nối' },
      { key: 'logs', label: 'Nhật ký', icon: History, hint: 'Activity log' },
    ],
  },
  {
    label: 'Hệ thống',
    items: [{ key: 'system', label: 'Kiến trúc & Dịch vụ', icon: ServerCog, hint: '5 tầng MQTT' }],
  },
];

export function findNavItem(key) {
  for (const g of NAV_GROUPS) {
    const found = g.items.find((i) => i.key === key);
    if (found) return { ...found, group: g.label };
  }
  return null;
}

export default function AppSidebar({
  active,
  onChange,
  collapsed,
  onToggleCollapse,
  alarmsCount = 0,
  onlineNodes = 0,
  totalNodes = 2,
  devicesCount = 0,
  isSocketConnected,
}) {
  return (
    <aside className={`app-sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-brand">
        <div className="sidebar-logo">
          <Home size={19} color="#fff" />
        </div>
        {!collapsed && (
          <div className="sidebar-brand-text">
            <div className="sidebar-brand-title">SmartHome IoT</div>
            <div className="sidebar-brand-sub">ESP32-C3 · MQTT · React</div>
          </div>
        )}
      </div>

      <nav className="sidebar-nav">
        {NAV_GROUPS.map((group) => (
          <div className="sidebar-group" key={group.label}>
            {!collapsed && <div className="sidebar-group-label">{group.label}</div>}
            {group.items.map((item) => {
              const Icon = item.icon;
              const showBadge = item.key === 'alarms' && alarmsCount > 0;
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`sidebar-item ${active === item.key ? 'active' : ''}`}
                  onClick={() => onChange(item.key)}
                  title={collapsed ? `${item.label} — ${item.hint}` : item.hint}
                >
                  <Icon size={17} className="sidebar-item-icon" />
                  {!collapsed && <span className="sidebar-item-label">{item.label}</span>}
                  {showBadge &&
                    (collapsed ? (
                      <span className="sidebar-dot" />
                    ) : (
                      <span className="sidebar-badge">{alarmsCount}</span>
                    ))}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar-foot">
        <div className="sidebar-status">
          <span className={`status-dot ${isSocketConnected ? 'online' : 'offline'}`} />
          {!collapsed && <span>{isSocketConnected ? 'Socket.IO: Live' : 'Mất kết nối'}</span>}
        </div>
        <div className="sidebar-status">
          <span className={`status-dot ${onlineNodes > 0 ? 'online' : 'offline'}`} />
          {!collapsed && <span>Node online {onlineNodes}/{totalNodes}</span>}
        </div>
        {!collapsed && <div className="sidebar-meta">{devicesCount} thiết bị đã đăng ký</div>}

        <button
          type="button"
          className="sidebar-collapse"
          onClick={onToggleCollapse}
          title={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
        >
          {collapsed ? (
            <ChevronsRight size={16} />
          ) : (
            <>
              <ChevronsLeft size={16} />
              <span>Thu gọn menu</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}

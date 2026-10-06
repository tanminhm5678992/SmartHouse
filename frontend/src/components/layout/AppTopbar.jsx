import React from 'react';
import { RefreshCw, ExternalLink, BellRing, RadioTower, ChevronRight, Globe } from 'lucide-react';

// Top bar theo tinh thần ThingsBoard: breadcrumb + tiêu đề trang ở bên trái,
// trạng thái realtime / cảnh báo / liên kết dịch vụ ở bên phải.
export default function AppTopbar({
  page,
  isSocketConnected,
  alarmsCount = 0,
  onlineNodes = 0,
  totalNodes = 2,
  lastSync,
  onRefresh,
}) {
  const lastSyncText = lastSync
    ? new Date(lastSync).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '--:--:--';

  return (
    <header className="app-topbar">
      <div className="topbar-left">
        <div className="topbar-breadcrumb">
          <span>{page?.group || 'Giám sát'}</span>
          <ChevronRight size={13} />
          <span className="topbar-breadcrumb-current">{page?.label || 'Tổng quan'}</span>
        </div>
        <h1 className="topbar-title">{page?.label || 'Tổng quan'}</h1>
        <p className="topbar-subtitle">{page?.hint || 'Widget workspace'}</p>
      </div>

      <div className="topbar-right">
        <div className="topbar-chip" title="Số trạm ESP32 đang gửi dữ liệu">
          <RadioTower size={14} />
          <span>{onlineNodes}/{totalNodes} node</span>
        </div>

        <div className={`topbar-chip ${alarmsCount > 0 ? 'warn' : ''}`} title="Cảnh báo đang tính từ dữ liệu thật">
          <BellRing size={14} />
          <span>{alarmsCount} cảnh báo</span>
        </div>

        <div className={`topbar-chip ${isSocketConnected ? 'ok' : 'error'}`} title="Kênh realtime Socket.IO tới Backend">
          <span className={`status-dot ${isSocketConnected ? 'online' : 'offline'}`} />
          <span>{isSocketConnected ? 'Realtime' : 'Offline'}</span>
        </div>

        <div className="topbar-divider" />

        <a className="topbar-link" href="http://localhost:18083" target="_blank" rel="noopener noreferrer">
          <Globe size={13} /> EMQX
          <ExternalLink size={11} />
        </a>

        <button type="button" className="topbar-refresh" onClick={onRefresh} title={`Đồng bộ REST lần cuối: ${lastSyncText}`}>
          <RefreshCw size={14} />
          <span className="topbar-refresh-time">{lastSyncText}</span>
        </button>
      </div>
    </header>
  );
}

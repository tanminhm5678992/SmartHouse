import React from 'react';
import { Bell, Clock, Terminal } from 'lucide-react';

export default function ActivityLogView({ logs }) {
  const formatTime = (ts) => {
    return new Date(ts).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit',
    });
  };

  const getSourceBadgeClass = (source) => {
    if (source === 'auto') return 'badge-source auto';
    if (source === 'HA') return 'badge-source HA';
    return 'badge-source manual';
  };

  const getSourceLabel = (source) => {
    if (source === 'auto') return 'Tự động (Rule)';
    if (source === 'HA') return 'Home Assistant';
    return 'Thủ công (Web)';
  };

  return (
    <div style={{ marginTop: '20px' }}>
      <div className="section-header">
        <div className="section-title">
          <Bell size={20} color="var(--primary)" />
          <span>Nhật Ký Hoạt Động (Activity Logs)</span>
          <span className="tag">Live Audit Trail</span>
        </div>
      </div>

      <div className="chart-panel" style={{ padding: '0', overflow: 'hidden' }}>
        {logs.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-dim)' }}>
            Chưa có nhật ký hoạt động nào được ghi lại.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="logs-table">
              <thead>
                <tr>
                  <th style={{ width: '180px' }}>Thời Gian</th>
                  <th>Hành Động / Sự Kiện</th>
                  <th style={{ width: '180px' }}>Nguồn Kích Hoạt</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={13} /> {formatTime(log.createdAt)}
                      </span>
                    </td>
                    <td style={{ fontWeight: '500' }}>
                      {log.action}
                    </td>
                    <td>
                      <span className={getSourceBadgeClass(log.source)}>
                        {getSourceLabel(log.source)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

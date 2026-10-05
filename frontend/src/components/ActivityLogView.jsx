import React, { useState } from 'react';
import { Bell, Clock, Search, Filter } from 'lucide-react';

// =========================================================
// Nguồn kích hoạt THẬT của hệ thống:
// Backend chỉ ghi source = 'manual' | 'auto'. Riêng 'auto' được dùng CHUNG cho
// cả Lịch hẹn lẫn Luật tự động hóa, nên phải đọc nội dung hành động để tách ra.
// (Bản cũ gắn nhãn "Tự động (Rule)" cho mọi bản ghi source='auto'
//  → sự kiện của Lịch Hẹn bị báo sai nguồn.)
// =========================================================
function deriveTrigger(log) {
  const action = log?.action || '';
  if (log?.source === 'HA') return { key: 'ha', label: 'Home Assistant', cls: 'HA' };
  if (action.includes('Theo lịch hẹn')) return { key: 'schedule', label: 'Lịch hẹn (Auto)', cls: 'schedule' };
  if (action.includes('(Luật:')) return { key: 'rule', label: 'Luật tự động', cls: 'auto' };
  if (action.startsWith('Đăng ký') || action.startsWith('Chỉnh sửa') || action.startsWith('Hủy đăng ký')) {
    return { key: 'devices', label: 'Quản lý thiết bị', cls: 'devices' };
  }
  if (log?.source === 'auto') return { key: 'rule', label: 'Tự động', cls: 'auto' };
  return { key: 'manual', label: 'Thủ công (Web)', cls: 'manual' };
}

const FILTERS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'schedule', label: 'Lịch hẹn' },
  { key: 'rule', label: 'Luật tự động' },
  { key: 'manual', label: 'Thủ công' },
  { key: 'devices', label: 'Quản lý thiết bị' },
  { key: 'ha', label: 'Home Assistant' },
];

export default function ActivityLogView({ logs }) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  const formatTime = (ts) => {
    return new Date(ts).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit',
    });
  };

  const decorated = logs.map((log) => ({ ...log, _trigger: deriveTrigger(log) }));

  const counts = decorated.reduce((acc, l) => {
    acc[l._trigger.key] = (acc[l._trigger.key] || 0) + 1;
    return acc;
  }, {});

  const filtered = decorated.filter((l) => {
    const byCat = filter === 'all' || l._trigger.key === filter;
    const q = query.trim().toLowerCase();
    const byQuery = !q || (l.action || '').toLowerCase().includes(q);
    return byCat && byQuery;
  });

  return (
    <div style={{ marginTop: '20px' }}>
      <div className="section-header">
        <div className="section-title">
          <Bell size={20} color="var(--primary)" />
          <span>Nhật Ký Hoạt Động (Activity Logs)</span>
          <span className="tag">Live Audit Trail</span>
        </div>
        <span className="sys-dim" style={{ fontSize: '0.78rem' }}>
          Hiển thị {filtered.length} / {logs.length} bản ghi mới nhất
        </span>
      </div>

      {/* Thanh lọc theo đúng 4 nguồn kích hoạt thật của hệ thống */}
      <div className="log-toolbar">
        <div className="log-filters">
          <Filter size={14} color="var(--text-dim)" />
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={`log-filter-btn ${filter === f.key ? 'active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              {counts[f.key] ? <span className="log-filter-count">{counts[f.key]}</span> : null}
            </button>
          ))}
        </div>
        <div className="log-search">
          <Search size={14} color="var(--text-dim)" />
          <input
            type="text"
            className="log-search-input"
            placeholder="Tìm theo nội dung hành động..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="chart-panel" style={{ padding: '0', overflow: 'hidden' }}>
        {logs.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-dim)' }}>
            Chưa có nhật ký hoạt động nào được ghi lại.
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-dim)' }}>
            Không có bản ghi nào khớp bộ lọc hiện tại.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="logs-table">
              <thead>
                <tr>
                  <th style={{ width: '170px' }}>Thời Gian</th>
                  <th>Hành Động / Sự Kiện</th>
                  <th style={{ width: '170px' }}>Thiết Bị</th>
                  <th style={{ width: '180px' }}>Nguồn Kích Hoạt</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((log) => (
                  <tr key={log.id}>
                    <td style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={13} /> {formatTime(log.createdAt)}
                      </span>
                    </td>
                    <td style={{ fontWeight: '500' }}>{log.action}</td>
                    <td>
                      {log.device ? (
                        <span className="log-device-chip">{log.device.name}</span>
                      ) : (
                        <span className="sys-dim" style={{ fontSize: '0.75rem' }}>Hệ thống</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge-source ${log._trigger.cls}`}>{log._trigger.label}</span>
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

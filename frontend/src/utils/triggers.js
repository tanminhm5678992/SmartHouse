// =========================================================
// Dùng chung cho Nhật ký & Activity feed.
// Backend chỉ ghi source = 'manual' | 'auto'. Riêng 'auto' được dùng CHUNG cho
// cả Lịch hẹn lẫn Luật tự động hóa nên phải đọc nội dung hành động để tách ra.
// =========================================================
export function deriveTrigger(log) {
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

export const LOG_FILTERS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'schedule', label: 'Lịch hẹn' },
  { key: 'rule', label: 'Luật tự động' },
  { key: 'manual', label: 'Thủ công' },
  { key: 'devices', label: 'Quản lý thiết bị' },
  { key: 'ha', label: 'Home Assistant' },
];

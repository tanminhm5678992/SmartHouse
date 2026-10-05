import { useEffect, useMemo, useState } from 'react';

// =========================================================
// Suy ra CẢNH BÁO từ dữ liệu THẬT của project.
// Project KHÔNG có bảng alarms trong CSDL và KHÔNG có Alarm API, nên ở đây
// không hề giả lập trạng thái "đã xác nhận/đã xoá". Toàn bộ cảnh báo được
// TÍNH LẠI mỗi lần dữ liệu thay đổi từ 3 nguồn có thật:
//   1. Luật tự động hóa đang BẬT (automations) đối chiếu telemetry mới nhất
//   2. Trạng thái kết nối node qua MQTT LWT (node_status)
//   3. Độ mới của bản tin telemetry (quá 60s = mất bản tin)
// =========================================================

const STALE_MS = 60000; // ESP32 gửi telemetry mỗi 5s → quá 60s là bất thường

export const SEVERITY_ORDER = { critical: 0, warning: 1, offline: 2 };

export const SEVERITY_META = {
  critical: { label: 'Nguy hiểm', color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.14)' },
  warning: { label: 'Cảnh báo', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.14)' },
  offline: { label: 'Mất kết nối', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.14)' },
};

// Bộ đếm thời gian để các widget tự cập nhật phần "x giây trước"
export function useNow(intervalMs = 5000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function timeAgo(ts, now = Date.now()) {
  if (!ts) return null;
  const diff = Math.floor((now - new Date(ts).getTime()) / 1000);
  if (Number.isNaN(diff)) return null;
  if (diff < 0) return 'vừa xong';
  if (diff < 60) return `${diff} giây trước`;
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  return `${Math.floor(diff / 86400)} ngày trước`;
}

// So sánh đúng như backend/src/services/automationService.js
function evaluate(operator, value, threshold) {
  switch (operator) {
    case '>': return value > threshold;
    case '<': return value < threshold;
    case '>=': return value >= threshold;
    case '<=': return value <= threshold;
    case '==': return value === threshold;
    default: return false;
  }
}

// Mức độ nghiêm trọng suy ra từ ĐỘ VƯỢT NGƯỠNG thật (không phải giá trị bịa)
function severityFromDeviation(value, threshold) {
  if (!threshold) return 'warning';
  const deviation = Math.abs((value - threshold) / threshold);
  return deviation >= 0.1 ? 'critical' : 'warning';
}

const OPERATOR_TEXT = { '>': 'lớn hơn', '<': 'nhỏ hơn', '>=': '≥', '<=': '≤', '==': 'bằng' };

/**
 * @param sensorData   { node1: {temperature, humidity, createdAt}, node2: {...} }
 * @param nodeStatuses { node1: 'online'|'offline', node2: ... }
 * @param automations  danh sách luật THẬT từ /api/automations
 * @param seenNodes    Set các node đã từng thấy bản tin (tránh báo động giả lúc mới mở trang)
 */
export function useAlarms({ sensorData, nodeStatuses, automations = [], seenNodes = [], now }) {
  return useMemo(() => {
    const alarms = [];
    const metricLabel = { temperature: 'Nhiệt độ', humidity: 'Độ ẩm' };
    const unitOf = (m) => (m === 'temperature' ? '°C' : '%');

    // ---- 1. Cảnh báo theo luật tự động hóa đang bật ----
    automations
      .filter((rule) => rule.enabled)
      .forEach((rule) => {
        const reading = sensorData?.[rule.sensorNode];
        const value = rule.metric === 'temperature' ? reading?.temperature : reading?.humidity;
        if (value === undefined || value === null) return;
        if (!evaluate(rule.operator, value, rule.threshold)) return;

        alarms.push({
          id: `rule-${rule.id}`,
          severity: severityFromDeviation(value, rule.threshold),
          title: `${metricLabel[rule.metric] || rule.metric} ${rule.operator} ${rule.threshold}${unitOf(rule.metric)}`,
          detail: `Giá trị hiện tại ${Number(value).toFixed(1)}${unitOf(rule.metric)} — luật "${rule.name}"`,
          origin: 'Luật tự động hóa',
          nodeId: rule.sensorNode,
          deviceName: rule.targetDevice?.name,
          time: reading?.createdAt,
        });
      });

    // ---- 2 & 3. Cảnh báo kết nối / mất bản tin (chỉ với node đã từng hoạt động) ----
    ['node1', 'node2'].forEach((nodeId) => {
      if (!seenNodes.includes(nodeId)) return; // chưa từng thấy dữ liệu ⇒ không kết luận
      const online = nodeStatuses?.[nodeId] === 'online';
      const reading = sensorData?.[nodeId];

      if (!online) {
        alarms.push({
          id: `offline-${nodeId}`,
          severity: 'offline',
          title: `Trạm ${nodeId.toUpperCase()} mất kết nối`,
          detail: 'Broker không nhận được bản tin LWT "online" từ thiết bị',
          origin: 'Kết nối MQTT',
          nodeId,
          time: reading?.createdAt,
        });
        return;
      }

      if (reading?.createdAt && now - new Date(reading.createdAt).getTime() > STALE_MS) {
        alarms.push({
          id: `stale-${nodeId}`,
          severity: 'warning',
          title: `Trạm ${nodeId.toUpperCase()} trễ bản tin`,
          detail: `Bản tin DHT11 cuối cách đây hơn 60 giây (chu kỳ thật là 5 giây)`,
          origin: 'Chất lượng dữ liệu',
          nodeId,
          time: reading.createdAt,
        });
      }
    });

    return alarms.sort((a, b) => {
      const s = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
      if (s !== 0) return s;
      return new Date(b.time || 0) - new Date(a.time || 0);
    });
  }, [sensorData, nodeStatuses, automations, seenNodes, now]);
}

export default useAlarms;

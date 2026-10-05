import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { Thermometer, Droplets, Activity, Info, RefreshCcw } from 'lucide-react';
import WidgetCard, { EmptyState } from './WidgetCard';
import { timeAgo } from '../../hooks/useAlarms';
import { sensorApi } from '../../api/axiosClient';

// =========================================================
// METRIC GAUGE WIDGET — một chỉ số telemetry của một node.
// Mức "Normal / Nóng / Khô..." lấy từ ĐÚNG ngưỡng mà project dùng:
// luật tự động hóa mẫu đặt mốc nhiệt độ 32°C.
// =========================================================
const TEMP_HOT = 32;
const STALE_MS = 60000;

const RANGES = {
  temperature: { min: 0, max: 50 },
  humidity: { min: 0, max: 100 },
};

function evaluate(operator, value, threshold) {
  switch (operator) {
    case '>': return value > threshold;
    case '<': return value < threshold;
    case '>=': return value >= threshold;
    case '<=': return value <= threshold;
    default: return false;
  }
}

function statusOf(metric, value) {
  if (value === null || value === undefined) return { label: 'Chưa có dữ liệu', tone: 'unknown' };
  if (metric === 'temperature') {
    if (value >= TEMP_HOT) return { label: 'Nóng', tone: 'error' };
    if (value >= 28) return { label: 'Ấm', tone: 'warn' };
    return { label: 'Bình thường', tone: 'ok' };
  }
  if (value >= 80) return { label: 'Ẩm cao', tone: 'warn' };
  if (value < 40) return { label: 'Khô', tone: 'warn' };
  return { label: 'Bình thường', tone: 'ok' };
}

export function MetricGaugeWidget({
  nodeId, nodeLabel, room, metric, reading, nodeOnline, automations = [], now, span = 3,
}) {
  const isTemp = metric === 'temperature';
  const raw = isTemp ? reading?.temperature : reading?.humidity;
  const value = raw === undefined || raw === null ? null : Number(raw);
  const unit = isTemp ? '°C' : '%';
  const status = statusOf(metric, value);

  const range = RANGES[metric];
  const pct = value === null ? 0 : Math.max(0, Math.min(100, ((value - range.min) / (range.max - range.min)) * 100));

  const ageMs = reading?.createdAt ? now - new Date(reading.createdAt).getTime() : Infinity;
  const isStale = ageMs > STALE_MS;

  // Đối chiếu với các luật THẬT đang bật trên cùng node + cùng chỉ số
  const triggered = automations.filter(
    (r) => r.enabled && r.sensorNode === nodeId && r.metric === metric
      && value !== null && evaluate(r.operator, value, r.threshold)
  );

  const toneColor = {
    ok: '#10b981', warn: '#f59e0b', error: '#f43f5e', unknown: '#94a3b8',
  }[status.tone];

  return (
    <WidgetCard
      title={isTemp ? 'Nhiệt độ' : 'Độ ẩm'}
      subtitle={`${nodeLabel} · ${room} · DHT11 (GPIO 4)`}
      icon={isTemp ? Thermometer : Droplets}
      accent={isTemp ? '#f43f5e' : '#06b6d4'}
      span={span}
      toolbar={
        <span className={`status-chip tone-${nodeOnline ? 'ok' : 'error'}`}>
          {nodeOnline ? 'ONLINE' : 'OFFLINE'}
        </span>
      }
    >
      <div className="gauge">
        <div className="gauge-value-row">
          <span className="gauge-value" style={{ color: toneColor }}>
            {value === null ? '--' : value.toFixed(1)}
          </span>
          <span className="gauge-unit">{unit}</span>
        </div>

        <div className="gauge-meter">
          <div className="gauge-meter-fill" style={{ width: `${pct}%`, background: toneColor }} />
          {isTemp && (
            <span className="gauge-marker" style={{ left: `${((TEMP_HOT - range.min) / (range.max - range.min)) * 100}%` }} title={`Ngưỡng luật: ${TEMP_HOT}°C`} />
          )}
        </div>
        <div className="gauge-scale">
          <span>{range.min}{unit}</span>
          {isTemp && <span className="gauge-threshold">ngưỡng luật {TEMP_HOT}°C</span>}
          <span>{range.max}{unit}</span>
        </div>

        <div className="gauge-foot">
          <span className="status-chip" style={{ color: toneColor, background: `${toneColor}1f` }}>{status.label}</span>
          <span className="gauge-updated">
            {reading?.createdAt ? `Cập nhật ${timeAgo(reading.createdAt, now)}` : 'chưa có bản tin'}
          </span>
        </div>

        {triggered.length > 0 && (
          <div className="gauge-trigger">
            <Activity size={12} />
            <span>Đang vượt ngưỡng luật: {triggered.map((t) => t.name).join(', ')}</span>
          </div>
        )}
        {isStale && nodeOnline && (
          <div className="gauge-stale">
            <Info size={12} /> Dữ liệu cũ hơn 60 giây (chu kỳ thật là 5 giây)
          </div>
        )}
      </div>
    </WidgetCard>
  );
}

// =========================================================
// TELEMETRY CHART WIDGET — biểu đồ lịch sử + cập nhật realtime.
// "Time window" = số điểm gần nhất, lấy đúng tham số `limit` mà
// GET /api/sensors/history?nodeId=&limit= hỗ trợ (backend giới hạn ≤ 200).
// =========================================================
const POINT_OPTIONS = [40, 80, 150];

export function TelemetryChartWidget({ liveData, span = 8, defaultNode = 'node1' }) {
  const [nodeId, setNodeId] = useState(defaultNode);
  const [points, setPoints] = useState(80);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState(null);

  const fetchHistory = async (nid, lim) => {
    setLoading(true);
    try {
      const res = await sensorApi.getHistory(nid, lim);
      setData(
        res.data.map((item) => ({
          time: new Date(item.createdAt).toLocaleTimeString('vi-VN', {
            hour: '2-digit', minute: '2-digit', second: '2-digit',
          }),
          temperature: item.temperature,
          humidity: item.humidity,
        }))
      );
      setLastFetch(new Date());
    } catch (err) {
      console.error('Lỗi tải lịch sử cảm biến:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory(nodeId, points);
  }, [nodeId, points]);

  // Bổ sung điểm realtime vào cuối chuỗi (không cần refresh trang)
  useEffect(() => {
    if (!liveData || liveData.nodeId !== nodeId) return;
    setData((prev) => {
      const next = [
        ...prev,
        {
          time: new Date().toLocaleTimeString('vi-VN', {
            hour: '2-digit', minute: '2-digit', second: '2-digit',
          }),
          temperature: liveData.temperature,
          humidity: liveData.humidity,
        },
      ];
      return next.slice(-points);
    });
  }, [liveData, nodeId, points]);

  const stats = useMemo(() => {
    if (data.length === 0) return null;
    const temps = data.map((d) => d.temperature).filter((v) => typeof v === 'number');
    const hums = data.map((d) => d.humidity).filter((v) => typeof v === 'number');
    const agg = (arr) => ({
      min: Math.min(...arr).toFixed(1),
      max: Math.max(...arr).toFixed(1),
      avg: (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1),
    });
    return { temp: agg(temps), hum: agg(hums) };
  }, [data]);

  return (
    <WidgetCard
      title="Lịch sử Telemetry"
      subtitle={`${data.length} điểm gần nhất của ${nodeId.toUpperCase()}`}
      icon={Activity}
      accent="#6366f1"
      span={span}
      toolbar={
        <div className="widget-tools">
          <div className="widget-seg">
            {['node1', 'node2'].map((n) => (
              <button
                key={n}
                type="button"
                className={`widget-seg-btn ${nodeId === n ? 'active' : ''}`}
                onClick={() => setNodeId(n)}
              >
                {n === 'node1' ? 'ESP32 #1' : 'ESP32 #2'}
              </button>
            ))}
          </div>
          <div className="widget-seg">
            {POINT_OPTIONS.map((p) => (
              <button
                key={p}
                type="button"
                className={`widget-seg-btn ${points === p ? 'active' : ''}`}
                onClick={() => setPoints(p)}
              >
                {p} điểm
              </button>
            ))}
          </div>
          <button
            type="button"
            className="widget-icon-btn"
            onClick={() => fetchHistory(nodeId, points)}
            title={lastFetch ? `REST lần cuối: ${lastFetch.toLocaleTimeString('vi-VN')}` : 'Tải lại'}
          >
            <RefreshCcw size={14} />
          </button>
        </div>
      }
      footer={
        stats ? (
          <div className="chart-stats">
            <span>
              <b style={{ color: '#f43f5e' }}>Nhiệt độ</b> min {stats.temp.min} · tb {stats.temp.avg} · max {stats.temp.max} °C
            </span>
            <span>
              <b style={{ color: '#06b6d4' }}>Độ ẩm</b> min {stats.hum.min} · tb {stats.hum.avg} · max {stats.hum.max} %
            </span>
          </div>
        ) : null
      }
    >
      {data.length === 0 ? (
        <EmptyState
          icon={Activity}
          text={loading ? 'Đang tải dữ liệu...' : 'Chưa có dữ liệu lịch sử'}
          hint="Dữ liệu xuất hiện khi ESP32 gửi telemetry lên MQTT"
        />
      ) : (
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10 }} minTickGap={28} />
              <YAxis yAxisId="left" stroke="#64748b" tick={{ fontSize: 10 }} domain={['dataMin - 2', 'dataMax + 2']} />
              <YAxis yAxisId="right" orientation="right" stroke="#64748b" tick={{ fontSize: 10 }} domain={[0, 100]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a2233',
                  borderColor: 'rgba(255,255,255,0.1)',
                  borderRadius: '10px',
                  color: '#fff',
                  fontSize: '12px',
                }}
              />
              <Legend verticalAlign="top" height={30} wrapperStyle={{ fontSize: '12px' }} />
              <Line yAxisId="left" type="monotone" dataKey="temperature" name="Nhiệt độ (°C)" stroke="#f43f5e" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line yAxisId="right" type="monotone" dataKey="humidity" name="Độ ẩm (%)" stroke="#06b6d4" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </WidgetCard>
  );
}

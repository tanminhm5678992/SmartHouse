import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { Activity } from 'lucide-react';
import { sensorApi } from '../api/axiosClient';

export default function ChartSection({ liveData }) {
  const [selectedNode, setSelectedNode] = useState('node1');
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = async (nodeId) => {
    try {
      setLoading(true);
      const res = await sensorApi.getHistory(nodeId, 40);
      const formatted = res.data.map((item) => ({
        time: new Date(item.createdAt).toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        temperature: item.temperature,
        humidity: item.humidity,
      }));
      setHistoryData(formatted);
    } catch (err) {
      console.error('Lỗi tải lịch sử cảm biến:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory(selectedNode);
  }, [selectedNode]);

  // Khi có dữ liệu realtime mới của node đang chọn, bổ sung vào cuối biểu đồ
  useEffect(() => {
    if (liveData && liveData.nodeId === selectedNode) {
      setHistoryData((prev) => {
        const newPoint = {
          time: new Date().toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
          temperature: liveData.temperature,
          humidity: liveData.humidity,
        };
        const updated = [...prev, newPoint];
        if (updated.length > 40) updated.shift();
        return updated;
      });
    }
  }, [liveData, selectedNode]);

  return (
    <div className="chart-panel">
      <div className="chart-header">
        <div className="section-title">
          <Activity size={20} color="var(--primary)" />
          <span>Biểu Đồ Xu Hướng Nhiệt Độ & Độ Ẩm</span>
          <span className="tag">Recharts Realtime</span>
        </div>

        <div className="node-selector">
          <button
            className={`node-btn ${selectedNode === 'node1' ? 'active' : ''}`}
            onClick={() => setSelectedNode('node1')}
          >
            Node 1 (Phòng Khách)
          </button>
          <button
            className={`node-btn ${selectedNode === 'node2' ? 'active' : ''}`}
            onClick={() => setSelectedNode('node2')}
          >
            Node 2 (Phòng Ngủ)
          </button>
        </div>
      </div>

      <div style={{ width: '100%', height: 320 }}>
        {historyData.length === 0 ? (
          <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
            {loading ? 'Đang tải dữ liệu...' : 'Chưa có đủ dữ liệu lịch sử để vẽ đồ thị'}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={historyData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
              <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} domain={['dataMin - 2', 'dataMax + 2']} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  borderColor: 'rgba(255,255,255,0.1)',
                  borderRadius: '10px',
                  color: '#fff',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                }}
              />
              <Legend verticalAlign="top" height={36} />
              <Line
                type="monotone"
                dataKey="temperature"
                name="Nhiệt độ (°C)"
                stroke="#f43f5e"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="humidity"
                name="Độ ẩm (%)"
                stroke="#06b6d4"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

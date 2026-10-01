import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import StatsOverview from './components/StatsOverview';
import SensorCard from './components/SensorCard';
import DeviceCard from './components/DeviceCard';
import ChartSection from './components/ChartSection';
import AutomationBuilder from './components/AutomationBuilder';
import ActivityLogView from './components/ActivityLogView';

import { deviceApi, sensorApi, automationApi, logApi } from './api/axiosClient';
import { useSocket } from './hooks/useSocket';
import { Cpu, Zap } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [devices, setDevices] = useState([]);
  const [sensorData, setSensorData] = useState({ node1: null, node2: null });
  const [nodeStatuses, setNodeStatuses] = useState({ node1: 'offline', node2: 'offline' });
  const [automations, setAutomations] = useState([]);
  const [logs, setLogs] = useState([]);
  const [liveSensor, setLiveSensor] = useState(null);

  // Tải dữ liệu ban đầu từ REST API
  const loadInitialData = useCallback(async () => {
    try {
      const [devicesRes, sensorsRes, automationsRes, logsRes] = await Promise.allSettled([
        deviceApi.getAll(),
        sensorApi.getLatest(),
        automationApi.getAll(),
        logApi.getAll(),
      ]);

      if (devicesRes.status === 'fulfilled') setDevices(devicesRes.value.data);
      if (sensorsRes.status === 'fulfilled') setSensorData(sensorsRes.value.data);
      if (automationsRes.status === 'fulfilled') setAutomations(automationsRes.value.data);
      if (logsRes.status === 'fulfilled') setLogs(logsRes.value.data);
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu ban đầu:', err);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Xử lý sự kiện Realtime qua Socket.IO
  const handleSensorData = useCallback((data) => {
    setSensorData((prev) => ({ ...prev, [data.nodeId]: data }));
    setLiveSensor(data);
    // Khi nhận được telemetry, chắc chắn node đó đang online
    setNodeStatuses((prev) => ({ ...prev, [data.nodeId]: 'online' }));
  }, []);

  const handleDeviceState = useCallback((updatedDevice) => {
    setDevices((prev) =>
      prev.map((d) => (d.id === updatedDevice.id ? { ...d, state: updatedDevice.state } : d))
    );
  }, []);

  const handleNodeStatus = useCallback(({ nodeId, status }) => {
    setNodeStatuses((prev) => ({ ...prev, [nodeId]: status }));
  }, []);

  const handleActivityLog = useCallback((newLog) => {
    setLogs((prev) => [newLog, ...prev.slice(0, 49)]);
  }, []);

  const { isConnected: isSocketConnected } = useSocket({
    onSensorData: handleSensorData,
    onDeviceState: handleDeviceState,
    onNodeStatus: handleNodeStatus,
    onActivityLog: handleActivityLog,
  });

  // Điều khiển thiết bị (Toggle Relay / LED)
  const handleToggleDevice = async (id, action) => {
    try {
      // Optimistic update
      setDevices((prev) =>
        prev.map((d) => (d.id === id ? { ...d, state: action } : d))
      );
      await deviceApi.sendCommand(id, action);
    } catch (err) {
      console.error('Lỗi gửi lệnh điều khiển:', err);
      // Rollback nếu thất bại
      loadInitialData();
    }
  };

  return (
    <div className="app-container">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isSocketConnected={isSocketConnected}
      />

      {/* KPI Stats Bar */}
      <StatsOverview
        sensorData={sensorData}
        devices={devices}
        nodeStatuses={nodeStatuses}
      />

      {/* Nội dung tương ứng theo Tab */}
      {activeTab === 'dashboard' && (
        <main>
          {/* Cảm biến DHT11 */}
          <section>
            <div className="section-header">
              <div className="section-title">
                <Cpu size={20} color="var(--primary)" />
                <span>Cảm Biến Môi Trường (DHT11)</span>
                <span className="tag">2 Trạm ESP32-C3</span>
              </div>
            </div>

            <div className="sensors-grid">
              <SensorCard
                nodeId="node1"
                title="Node 1: Trạm Phòng Khách"
                room="Phòng Khách"
                data={sensorData.node1}
                status={nodeStatuses.node1}
              />
              <SensorCard
                nodeId="node2"
                title="Node 2: Trạm Phòng Ngủ"
                room="Phòng Ngủ"
                data={sensorData.node2}
                status={nodeStatuses.node2}
              />
            </div>
          </section>

          {/* Điều khiển Thiết bị (2 Relay + 4 LED) */}
          <section>
            <div className="section-header">
              <div className="section-title">
                <Zap size={20} color="var(--primary)" />
                <span>Thiết Bị Chấp Hành (Actuators)</span>
                <span className="tag">2 Relay • 4 LED</span>
              </div>
            </div>

            <div className="devices-grid">
              {devices.map((device) => (
                <DeviceCard
                  key={device.id}
                  device={device}
                  onToggle={handleToggleDevice}
                />
              ))}
            </div>
          </section>

          {/* Biểu đồ nhanh ở cuối Dashboard */}
          <ChartSection liveData={liveSensor} />
        </main>
      )}

      {activeTab === 'charts' && (
        <ChartSection liveData={liveSensor} />
      )}

      {activeTab === 'automations' && (
        <AutomationBuilder
          automations={automations}
          devices={devices}
          onReload={loadInitialData}
        />
      )}

      {activeTab === 'logs' && (
        <ActivityLogView logs={logs} />
      )}
    </div>
  );
}

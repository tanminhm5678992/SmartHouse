import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import StatsOverview from './components/StatsOverview';
import SensorCard from './components/SensorCard';
import DeviceCard from './components/DeviceCard';
import ChartSection from './components/ChartSection';
import AutomationBuilder from './components/AutomationBuilder';
import ActivityLogView from './components/ActivityLogView';
import DeviceManager from './components/DeviceManager';
import ScheduleManager from './components/ScheduleManager';
import UserManager from './components/UserManager';
import SystemStatus from './components/SystemStatus';

import { deviceApi, sensorApi, automationApi, scheduleApi, logApi } from './api/axiosClient';
import { useSocket } from './hooks/useSocket';
import { Cpu, Zap, Plus } from 'lucide-react';

export default function Dashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('dashboard');

  // Chỉ admin mới được xem trang Quản Lý Người Dùng.
  // Chạy lại mỗi khi đổi tab / phiên đăng nhập để không bỏ sót trường hợp quyền bị hạ.
  useEffect(() => {
    if (activeTab === 'users' && user?.role !== 'admin') {
      setActiveTab('dashboard');
    }
  }, [activeTab, user]);
  const [devices, setDevices] = useState([]);
  const [sensorData, setSensorData] = useState({ node1: null, node2: null });
  const [nodeStatuses, setNodeStatuses] = useState({ node1: 'offline', node2: 'offline' });
  const [automations, setAutomations] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [logs, setLogs] = useState([]);
  const [liveSensor, setLiveSensor] = useState(null);

  // Tải dữ liệu ban đầu từ REST API
  const loadInitialData = useCallback(async () => {
    try {
      const [devicesRes, sensorsRes, automationsRes, schedulesRes, logsRes] = await Promise.allSettled([
        deviceApi.getAll(),
        sensorApi.getLatest(),
        automationApi.getAll(),
        scheduleApi.getAll(),
        logApi.getAll(),
      ]);

      if (devicesRes.status === 'fulfilled') setDevices(devicesRes.value.data);
      if (sensorsRes.status === 'fulfilled') setSensorData(sensorsRes.value.data);
      if (automationsRes.status === 'fulfilled') setAutomations(automationsRes.value.data);
      if (schedulesRes.status === 'fulfilled') setSchedules(schedulesRes.value.data);
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
      prev.map((d) =>
        d.id === updatedDevice.id
          ? {
              ...d,
              state: updatedDevice.state,
              ...(updatedDevice.brightness !== undefined && { brightness: updatedDevice.brightness }),
            }
          : d
      )
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

  // Chỉnh độ sáng đèn LED (PWM 0-100%)
  const handleBrightnessChange = async (id, brightness) => {
    try {
      // Optimistic update
      setDevices((prev) =>
        prev.map((d) =>
          d.id === id
            ? { ...d, brightness, state: brightness > 0 ? 'ON' : 'OFF' }
            : d
        )
      );
      await deviceApi.setBrightness(id, brightness);
    } catch (err) {
      console.error('Lỗi chỉnh độ sáng:', err);
      loadInitialData();
    }
  };

  return (
    <div className="app-container">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isSocketConnected={isSocketConnected}
        user={user}
        onLogout={onLogout}
      />

      {/* KPI Stats Bar */}
      <StatsOverview
        sensorData={sensorData}
        devices={devices}
        nodeStatuses={nodeStatuses}
        automations={automations}
        schedules={schedules}
      />

      {/* Kiến trúc 5 tầng & tình trạng kết nối thật của hệ thống */}
      {activeTab === 'dashboard' && (
        <SystemStatus
          nodeStatuses={nodeStatuses}
          sensorData={sensorData}
          devices={devices}
          isSocketConnected={isSocketConnected}
          automations={automations}
          schedules={schedules}
        />
      )}

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
                <span>Thiết Bị Chấp Hành &amp; Cảm Biến Đã Đăng Ký</span>
                <span className="tag">
                  {devices.filter((d) => d.type !== 'sensor').length} chấp hành ·{' '}
                  {devices.filter((d) => d.type === 'sensor').length} cảm biến
                </span>
              </div>
              <button
                className="btn-primary"
                style={{ padding: '6px 14px', fontSize: '0.82rem' }}
                onClick={() => setActiveTab('devices')}
              >
                <Plus size={14} /> Đăng Ký Thiết Bị
              </button>
            </div>

            <div className="devices-grid">
              {[...devices]
                .sort((a, b) => (a.type === 'sensor' ? 1 : 0) - (b.type === 'sensor' ? 1 : 0))
                .map((device) => (
                  <DeviceCard
                    key={device.id}
                    device={device}
                    nodeStatus={nodeStatuses[device.nodeId]}
                    onToggle={handleToggleDevice}
                    onBrightness={handleBrightnessChange}
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

      {activeTab === 'devices' && (
        <DeviceManager
          devices={devices}
          onReload={loadInitialData}
          onToggle={handleToggleDevice}
        />
      )}

      {activeTab === 'automations' && (
        <AutomationBuilder
          automations={automations}
          devices={devices}
          onReload={loadInitialData}
        />
      )}

      {activeTab === 'schedules' && (
        <ScheduleManager
          schedules={schedules}
          devices={devices}
          onReload={loadInitialData}
        />
      )}

      {activeTab === 'logs' && (
        <ActivityLogView logs={logs} />
      )}

      {/* Quản lý người dùng - chỉ render khi admin (guard phía client + 403 phía server) */}
      {activeTab === 'users' && user?.role === 'admin' && (
        <UserManager currentUser={user} />
      )}
    </div>
  );
}

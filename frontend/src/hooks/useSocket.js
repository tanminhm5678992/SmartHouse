import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { getToken } from '../api/authStorage';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';

export function useSocket({ onSensorData, onDeviceState, onNodeStatus, onActivityLog }) {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) return undefined; // Chưa đăng nhập → không mở kết nối realtime

    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      auth: { token },
    });

    socket.on('connect', () => {
      console.log('[Socket.IO] Đã kết nối tới Backend');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('[Socket.IO] Mất kết nối tới Backend');
      setIsConnected(false);
    });

    if (onSensorData) {
      socket.on('sensor_data', onSensorData);
    }

    if (onDeviceState) {
      socket.on('device_state', onDeviceState);
    }

    if (onNodeStatus) {
      socket.on('node_status', onNodeStatus);
    }

    if (onActivityLog) {
      socket.on('activity_log', onActivityLog);
    }

    return () => {
      socket.disconnect();
    };
  }, [onSensorData, onDeviceState, onNodeStatus, onActivityLog]);

  return { isConnected };
}

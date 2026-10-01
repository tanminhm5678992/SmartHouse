let ioInstance = null;

function initSocket(io) {
  ioInstance = io;

  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Client đã kết nối: ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client đã ngắt kết nối: ${socket.id}`);
    });
  });
}

function getIO() {
  return ioInstance;
}

function emitSensorData(data) {
  if (ioInstance) {
    ioInstance.emit('sensor_data', data);
  }
}

function emitDeviceState(data) {
  if (ioInstance) {
    ioInstance.emit('device_state', data);
  }
}

function emitNodeStatus(data) {
  if (ioInstance) {
    ioInstance.emit('node_status', data);
  }
}

function emitActivityLog(data) {
  if (ioInstance) {
    ioInstance.emit('activity_log', data);
  }
}

module.exports = {
  initSocket,
  getIO,
  emitSensorData,
  emitDeviceState,
  emitNodeStatus,
  emitActivityLog,
};

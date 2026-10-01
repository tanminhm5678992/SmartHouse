const prisma = require('../config/prisma');
const { emitActivityLog } = require('../sockets/socketHandler');

async function evaluateAutomations(nodeId, telemetry, mqttPublishFn) {
  try {
    const automations = await prisma.automation.findMany({
      where: {
        sensorNode: nodeId,
        enabled: true,
      },
      include: {
        targetDevice: true,
      },
    });

    for (const rule of automations) {
      const sensorValue = rule.metric === 'temperature' ? telemetry.temp : telemetry.hum;
      if (sensorValue === undefined || sensorValue === null) continue;

      let isTriggered = false;
      switch (rule.operator) {
        case '>':
          isTriggered = sensorValue > rule.threshold;
          break;
        case '<':
          isTriggered = sensorValue < rule.threshold;
          break;
        case '>=':
          isTriggered = sensorValue >= rule.threshold;
          break;
        case '<=':
          isTriggered = sensorValue <= rule.threshold;
          break;
        case '==':
          isTriggered = sensorValue === rule.threshold;
          break;
        default:
          break;
      }

      if (isTriggered && rule.targetDevice) {
        // Chỉ gửi lệnh nếu thiết bị chưa ở trạng thái mong muốn (tránh spam lệnh)
        if (rule.targetDevice.state !== rule.action) {
          console.log(`[Automation] Luật '${rule.name}' kích hoạt: ${rule.metric} (${sensorValue}) ${rule.operator} ${rule.threshold} -> ${rule.targetDevice.name} = ${rule.action}`);

          // Gửi lệnh MQTT tới thiết bị
          const commandTopic = `${rule.targetDevice.mqttTopic}/command`;
          mqttPublishFn(commandTopic, rule.action);

          // Cập nhật trạng thái device trong DB
          await prisma.device.update({
            where: { id: rule.targetDevice.id },
            data: { state: rule.action, lastSeen: new Date() },
          });

          // Lưu log hoạt động
          const log = await prisma.activityLog.create({
            data: {
              deviceId: rule.targetDevice.id,
              action: `Tự động chuyển ${rule.targetDevice.name} sang ${rule.action} (Luật: ${rule.name})`,
              source: 'auto',
            },
            include: { device: true },
          });

          emitActivityLog(log);
        }
      }
    }
  } catch (error) {
    console.error('[Automation] Lỗi khi xử lý automation:', error.message);
  }
}

module.exports = {
  evaluateAutomations,
};

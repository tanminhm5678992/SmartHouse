const prisma = require('../config/prisma');
const { publishCommand } = require('../mqtt/mqttClient');
const { emitActivityLog, emitDeviceState } = require('../sockets/socketHandler');

let timer = null;

// Tạo khóa phút dạng "YYYY-MM-DDTHH:MM" (giờ local) để chống kích hoạt trùng
function currentMinuteKey(now) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

// Chuỗi giờ hiện tại dạng "HH:MM"
function currentTimeHHMM(now) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

// JS getDay(): 0 = Chủ nhật, 1 = Thứ 2 ... 6 = Thứ 7 → chuẩn hóa sang 1..7 (1 = Thứ 2 ... 7 = Chủ nhật)
function currentIsoDay(now) {
  const d = now.getDay();
  return d === 0 ? 7 : d;
}

// Kiểm tra hôm nay có nằm trong danh sách ngày áp dụng (CSV: "1,2,3") không
function isDayAllowed(daysCsv, day) {
  if (!daysCsv || daysCsv.trim() === '') return true;
  return daysCsv
    .split(',')
    .map((s) => s.trim())
    .includes(String(day));
}

// Gửi lệnh MQTT, cập nhật DB, ghi log và phát realtime
async function triggerAction(schedule, device, action) {
  const commandTopic = `${device.mqttTopic}/command`;
  publishCommand(commandTopic, action);

  const data = { state: action, lastSeen: new Date() };
  // Với đèn LED: BẬT thì khôi phục độ sáng cũ (hoặc 100%), TẮT thì đưa về 0%
  if (device.type === 'led') {
    data.brightness = action === 'ON' ? (device.brightness > 0 ? device.brightness : 100) : 0;
  }

  const updated = await prisma.device.update({ where: { id: device.id }, data });

  const log = await prisma.activityLog.create({
    data: {
      deviceId: device.id,
      action: `Theo lịch hẹn "${schedule.name}": ${action === 'ON' ? 'BẬT' : 'TẮT'} ${device.name}`,
      source: 'auto',
    },
    include: { device: true },
  });

  emitDeviceState(updated);
  emitActivityLog(log);

  console.log(`[Schedule] "${schedule.name}" → ${device.name} = ${action}`);
}

// Quét toàn bộ lịch hẹn đang bật và kích hoạt nếu khớp giờ
async function checkSchedules() {
  try {
    const now = new Date();
    const minuteKey = currentMinuteKey(now);
    const hhmm = currentTimeHHMM(now);
    const day = currentIsoDay(now);

    const schedules = await prisma.schedule.findMany({
      where: { enabled: true },
      include: { targetDevice: true },
    });

    for (const schedule of schedules) {
      const device = schedule.targetDevice;
      if (!device) continue;
      if (!isDayAllowed(schedule.days, day)) continue;

      // Đến giờ BẬT
      if (schedule.onTime === hhmm && schedule.lastOnRun !== minuteKey) {
        if (device.state !== 'ON') {
          await triggerAction(schedule, device, 'ON');
        }
        await prisma.schedule.update({
          where: { id: schedule.id },
          data: { lastOnRun: minuteKey },
        });
      }

      // Đến giờ TẮT
      if (schedule.offTime === hhmm && schedule.lastOffRun !== minuteKey) {
        if (device.state !== 'OFF') {
          await triggerAction(schedule, device, 'OFF');
        }
        await prisma.schedule.update({
          where: { id: schedule.id },
          data: { lastOffRun: minuteKey },
        });
      }
    }
  } catch (error) {
    console.error('[Schedule] Lỗi khi kiểm tra lịch hẹn:', error.message);
  }
}

// Khởi động bộ lập lịch (mặc định quét mỗi 20 giây)
function startScheduler(intervalMs = 20000) {
  if (timer) return;
  console.log(`[Schedule] Bộ lập lịch bật/tắt thiết bị đã khởi động (quét mỗi ${intervalMs / 1000}s)`);
  checkSchedules();
  timer = setInterval(checkSchedules, intervalMs);
}

module.exports = {
  startScheduler,
  checkSchedules,
};

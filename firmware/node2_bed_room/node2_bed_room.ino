/**
 * PROJECT: MQTT SMART HOME - BÁO CÁO IOT
 * NODE 2: PHÒNG NGỦ (ESP32-C3 SUPER MINI)
 *
 * =================================================================================
 * SƠ ĐỒ ĐẤU DÂY NODE 2 — MỖI CHÂN ESP32 CHỈ CẮM ĐÚNG 1 LỖ DUY NHẤT
 * =================================================================================
 *
 * ┌──────────────────────────────────────────────────────────────┐
 * │  LINH KIỆN          CHÂN LINH KIỆN   →   CHÂN ESP32-C3     │
 * ├──────────────────────────────────────────────────────────────┤
 * │  DHT11              VCC  (+)          →   3V3               │
 * │                     GND  (-)          →   GPIO 2  ← GND ẢO  │
 * │                     DATA (S)          →   GPIO 4            │
 * ├──────────────────────────────────────────────────────────────┤
 * │  MODULE RELAY       DC+               →   5V                │
 * │                     DC-               →   G   (GND thật)    │
 * │                     IN                →   GPIO 5  (kích)    │
 * │                     NO                →   G   (GND thật)    │
 * │  * DC- và NO đều cắm vào G  ← đây là 2 chân của RELAY,     │
 * │    không phải 2 chân của ESP32. Dây Relay DC- và NO         │
 * │    nối chung tại điểm G của ESP32 (chấp nhận được vì        │
 * │    cùng nguồn GND phần cứng, không phải chia chân GPIO)     │
 * ├──────────────────────────────────────────────────────────────┤
 * │  QUẠT MINI 5V       Dây Đỏ  (+)      →   5V                │
 * │                     Dây Đen (-)       →   COM relay         │
 * ├──────────────────────────────────────────────────────────────┤
 * │  ĐÈN LED            Chân dài  (+)    →   GPIO 6            │
 * │                     Chân ngắn (-)    →   GPIO 7  ← GND ẢO  │
 * │  * GPIO 6 và GPIO 7 NGAY CẠNH NHAU → cắm thẳng LED vào     │
 * ├──────────────────────────────────────────────────────────────┤
 * │  LED MẠNG           (tích hợp ESP32) →   GPIO 8  (tự động) │
 * └──────────────────────────────────────────────────────────────┘
 *
 * GIẢI THÍCH GND ẢO:
 *    GPIO 2 = OUTPUT LOW (0V) → làm GND cho DHT11 (~1mA, an toàn cho GPIO)
 *    GPIO 7 = OUTPUT LOW (0V) → làm GND cho chân (-) LED (~5mA, an toàn)
 *    Chân G (phần cứng)  → chỉ dùng cho Relay DC- và NO (dòng lớn hơn)
 * =================================================================================
 * LÝ DO DÙNG RELAY CHO QUẠT:
 *    GPIO chỉ chịu ~40mA — quạt mini cần 100-500mA → relay là bắt buộc
 * =================================================================================
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <ArduinoJson.h>
#include <esp_arduino_version.h>

// ========== CẤU HÌNH THÔNG TIN MẠNG WIFI & MQTT BROKER ==========
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* MQTT_BROKER   = "192.168.1.100";   // IP máy tính chạy Docker
const int   MQTT_PORT     = 1883;
const char* CLIENT_ID     = "ESP32C3_Node2_BedRoom";

// ========== CẤU HÌNH CHÂN GPIO (MỖI CHÂN 1 LỖ DUY NHẤT) ==========
#define PIN_DHT_VCC     1   // GPIO 1: VCC ảo cho DHT11 — xuất 3.3V (~1mA, an toàn cho GPIO)
#define PIN_DHT_GND     2   // GPIO 2: GND ảo cho DHT11 — xuất 0V  (~1mA, an toàn cho GPIO)
#define PIN_DHT11       4   // GPIO 4: Chân DATA cảm biến DHT11
#define PIN_RELAY_FAN   5   // GPIO 5: Chân IN Module Relay → kích quạt (Active LOW)
#define PIN_LED_ANODE   6   // GPIO 6: Chân dài (+) Đèn LED
#define PIN_LED_CATHODE 7   // GPIO 7: GND ảo cho (-) Đèn LED — xuất 0V (~5mA, an toàn)
#define PIN_ONBOARD_LED 8   // GPIO 8: LED xanh tích hợp ESP32 (báo mạng)

#define DHTTYPE DHT11

// ========== CẤU HÌNH PWM (ĐỘ SÁNG) CHO ĐÈN LED ==========
#define LED3_PWM_CHANNEL 0      // Kênh LEDC dùng cho core < 3.0 (core >= 3.0 gán tự động theo chân)
#define LED_PWM_FREQ     5000   // Tần số PWM 5kHz (ánh sáng mịn, không nhấp nháy)
#define LED_PWM_RES      8      // Độ phân giải 8-bit → giá trị duty 0-255

// ========== DANH SÁCH MQTT TOPICS ==========
const char* TOPIC_STATUS    = "home/sensor/node2/status";
const char* TOPIC_TELEMETRY = "home/sensor/node2/telemetry";
const char* TOPIC_FAN_CMD   = "home/device/relay2/command";
const char* TOPIC_FAN_STATE = "home/device/relay2/state";
const char* TOPIC_LED_CMD   = "home/device/led3/command";
const char* TOPIC_LED_STATE = "home/device/led3/state";

// ========== KHỞI TẠO ĐỐI TƯỢNG VÀ BIẾN TOÀN CỤC ==========
DHT dht(PIN_DHT11, DHTTYPE);
WiFiClient espClient;
PubSubClient mqttClient(espClient);

bool fanState = false;
bool ledState = false;

float lastValidTemp = 28.5;
float lastValidHum  = 65.0;

unsigned long lastSensorReadTime   = 0;
unsigned long lastReconnectAttempt = 0;
unsigned long lastWifiRetry        = 0;
unsigned long lastHeartbeatTime    = 0;
bool          wifiConnecting       = false;

const unsigned long SENSOR_INTERVAL     = 5000;
const unsigned long HEARTBEAT_INTERVAL  = 10000;
const unsigned long WIFI_RETRY_INTERVAL = 5000;

// ----------------------------------------------------------------
// HÀM ĐIỀU KHIỂN QUẠT MINI QUA MODULE RELAY
// GPIO5 → Chân IN của Relay (Relay Active LOW)
// ----------------------------------------------------------------
void setFan(bool state) {
  fanState = state;
  // Relay tích cực mức THẤP (Active LOW):
  //   IN = LOW  (0V)   → Relay ĐÓNG → mạch COM-NO kín → Quạt CHẠY
  //   IN = HIGH (3.3V) → Relay HỞ   → mạch hở          → Quạt DỪNG
  digitalWrite(PIN_RELAY_FAN, state ? LOW : HIGH);
  mqttClient.publish(TOPIC_FAN_STATE, state ? "ON" : "OFF", true);
  Serial.printf("[Quạt/Relay] %s (GPIO5=%s → Relay %s)\n",
                state ? "ON (BẬT)" : "OFF (TẮT)",
                state ? "LOW" : "HIGH",
                state ? "ĐÓNG" : "HỞ");
}

// ----------------------------------------------------------------
// HÀM ĐIỀU KHIỂN ĐÈN LED (2 CHÂN)
// Chân dài (+) cắm lỗ GPIO 6, Chân ngắn (-) cắm lỗ GPIO 7
// ----------------------------------------------------------------
// Chuyển đổi phần trăm độ sáng (0-100%) sang giá trị duty (0-255)
int percentToDuty(int percent) {
  percent = constrain(percent, 0, 100);
  return (percent * ((1 << LED_PWM_RES) - 1)) / 100;
}

// Gắn chân LED vào bộ điều chế độ rộng xung (PWM/LEDC) - tương thích core 2.x và 3.x
void pwmAttachLed(int pin, int channel) {
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcAttach(pin, LED_PWM_FREQ, LED_PWM_RES);
#else
  ledcSetup(channel, LED_PWM_FREQ, LED_PWM_RES);
  ledcAttachPin(pin, channel);
#endif
}

// Ghi giá trị duty ra chân LED (core >= 3.0 dùng chân, core < 3.0 dùng kênh)
void pwmWriteLed(int pin, int channel, int duty) {
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcWrite(pin, duty);
#else
  ledcWrite(channel, duty);
#endif
}

// Điều khiển độ sáng đèn LED theo phần trăm (0-100%)
void setLedBrightness(int percent) {
  percent = constrain(percent, 0, 100);
  ledState = percent > 0;
  pwmWriteLed(PIN_LED_ANODE, LED3_PWM_CHANNEL, percentToDuty(percent));
  mqttClient.publish(TOPIC_LED_STATE, ledState ? "ON" : "OFF", true);
  Serial.printf("[Đèn LED] Độ sáng: %d%% (%s)\n", percent, ledState ? "ON (SÁNG)" : "OFF (TẮT)");
}

void setLed(bool state) {
  setLedBrightness(state ? 100 : 0);
}
// ----------------------------------------------------------------
// HÀM NHẬN LỆNH MQTT TỪ WEB / APP
// ----------------------------------------------------------------
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (unsigned int i = 0; i < length; i++) message += (char)payload[i];
  message.trim();
  Serial.printf("[MQTT RX] Topic [%s]: %s\n", topic, message.c_str());

  if (String(topic) == TOPIC_FAN_CMD) {
    if (message.equalsIgnoreCase("ON"))       setFan(true);
    else if (message.equalsIgnoreCase("OFF")) setFan(false);
  }
  else if (String(topic) == TOPIC_LED_CMD) {
    if (message.equalsIgnoreCase("ON"))       setLed(true);
    else if (message.equalsIgnoreCase("OFF")) setLed(false);
    else if (message.startsWith("SET:"))      setLedBrightness(message.substring(4).toInt());
  }
  else if (String(topic).startsWith("home/node2/gpio/") && String(topic).endsWith("/command")) {
    int pin = String(topic).substring(16, String(topic).indexOf("/command")).toInt();
    bool state = message.equalsIgnoreCase("ON");
    bool isSet = message.startsWith("SET:");
    if (pin == PIN_RELAY_FAN)      setFan(state);
    else if (pin == PIN_LED_ANODE) {
      if (isSet) setLedBrightness(message.substring(4).toInt());
      else setLed(state);
    }
    else if (pin >= 0 && pin <= 21) {
      pinMode(pin, OUTPUT);
      digitalWrite(pin, state ? HIGH : LOW);
      String st = "home/node2/gpio/" + String(pin) + "/state";
      mqttClient.publish(st.c_str(), state ? "ON" : "OFF", true);
      Serial.printf("[Dynamic GPIO] GPIO %d -> %s\n", pin, state ? "ON" : "OFF");
    }
  }
}

// ----------------------------------------------------------------
// SỰ KIỆN WIFI: TỰ ĐỘNG XỬ LÝ KẾT NỐI / NGẮT MẠNG
// ----------------------------------------------------------------
void onWifiEvent(WiFiEvent_t event) {
  switch (event) {
    case ARDUINO_EVENT_WIFI_STA_GOT_IP:
      Serial.println("\n[WiFi] Đã kết nối! IP: " + WiFi.localIP().toString());
      digitalWrite(PIN_ONBOARD_LED, LOW);
      wifiConnecting = false;
      lastReconnectAttempt = 0;
      break;
    case ARDUINO_EVENT_WIFI_STA_DISCONNECTED:
      Serial.println("[WiFi] Mất kết nối! Sẽ tự thử lại...");
      digitalWrite(PIN_ONBOARD_LED, HIGH);
      wifiConnecting = false;
      break;
    default:
      break;
  }
}

// ----------------------------------------------------------------
// KHỞI TẠO WIFI LẦN ĐẦU (BLOCKING TỐI ĐA 15 GIÂY)
// ----------------------------------------------------------------
void setupWiFi() {
  Serial.println("\n----------------------------------");
  Serial.printf("Đang kết nối WiFi: %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(WIFI_PS_NONE);
  WiFi.setAutoReconnect(true);
  WiFi.persistent(false);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long startMs = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - startMs > 15000) {
      Serial.println("\n[WiFi] Quá thời gian 15s. Khởi động lại chip...");
      ESP.restart();
    }
    delay(300);
    digitalWrite(PIN_ONBOARD_LED, !digitalRead(PIN_ONBOARD_LED));
    Serial.print(".");
  }
  digitalWrite(PIN_ONBOARD_LED, LOW);
  Serial.println("\n[WiFi] Kết nối thành công! IP: " + WiFi.localIP().toString());
}

// ----------------------------------------------------------------
// KẾT NỐI LẠI WIFI (NON-BLOCKING)
// ----------------------------------------------------------------
void reconnectWiFi() {
  unsigned long now = millis();
  if (wifiConnecting || (now - lastWifiRetry < WIFI_RETRY_INTERVAL)) return;
  lastWifiRetry = now;
  wifiConnecting = true;
  Serial.println("[WiFi] Đang thử kết nối lại...");
  WiFi.disconnect(false);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

// ----------------------------------------------------------------
// KẾT NỐI MQTT BROKER (NON-BLOCKING)
// ----------------------------------------------------------------
void reconnectMQTT() {
  unsigned long now = millis();
  if (now - lastReconnectAttempt < 3000) return;
  lastReconnectAttempt = now;

  Serial.print("[MQTT] Đang kết nối tới Broker... ");
  String uid = String(CLIENT_ID) + "_" + String((uint32_t)ESP.getEfuseMac(), HEX);

  if (mqttClient.connect(uid.c_str(), TOPIC_STATUS, 1, true, "offline")) {
    Serial.println("Thành công!");
    digitalWrite(PIN_ONBOARD_LED, LOW);
    mqttClient.publish(TOPIC_STATUS, "online", true);
    mqttClient.subscribe(TOPIC_FAN_CMD);
    mqttClient.subscribe(TOPIC_LED_CMD);
    mqttClient.subscribe("home/node2/gpio/+/command");
    mqttClient.publish(TOPIC_FAN_STATE, fanState ? "ON" : "OFF", true);
    mqttClient.publish(TOPIC_LED_STATE, ledState ? "ON" : "OFF", true);
  } else {
    Serial.printf("Thất bại (rc=%d). Thử lại sau 3s...\n", mqttClient.state());
    digitalWrite(PIN_ONBOARD_LED, HIGH);
  }
}

// ----------------------------------------------------------------
// SETUP: KHỞI TẠO HỆ THỐNG
// ----------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n=======================================================");
  Serial.println("  SMART HOME NODE 2: PHÒNG NGỦ (ESP32-C3) KHỞI ĐỘNG  ");
  Serial.println("=======================================================");

  // 1. Đèn LED trạng thái tích hợp (GPIO 8)
  pinMode(PIN_ONBOARD_LED, OUTPUT);
  digitalWrite(PIN_ONBOARD_LED, HIGH);

  // 2. VCC ảo + GND ảo cho DHT11 (mỗi chân 1 dây duy nhất)
  //    GPIO 1 = OUTPUT HIGH (3.3V) → VCC ảo cho DHT11 (~1mA, an toàn)
  //    GPIO 2 = OUTPUT LOW  (0V)   → GND ảo cho DHT11 (~1mA, an toàn)
  //    → Chân 3V3 phần cứng chỉ còn 1 dây duy nhất (Relay DC+)
  pinMode(PIN_DHT_VCC, OUTPUT);
  digitalWrite(PIN_DHT_VCC, HIGH);    // Luôn giữ 3.3V làm VCC ảo
  pinMode(PIN_DHT_GND, OUTPUT);
  digitalWrite(PIN_DHT_GND, LOW);     // Luôn giữ 0V làm GND ảo

  // 3. Module Relay điều khiển Quạt (GPIO 5, Active LOW)
  //    pinMode TRƯỚC → digitalWrite sau (tránh xung LOW ngắn khi reset)
  pinMode(PIN_RELAY_FAN, OUTPUT);
  digitalWrite(PIN_RELAY_FAN, HIGH);  // HIGH = Relay HỞ = quạt tắt

  // 4. Đèn LED 2 chân
  //    GPIO 7 = GND ảo (OUTPUT LOW) cho chân ngắn (-) của LED
  //    GPIO 6 = điều khiển bật/tắt cho chân dài (+) của LED
  pinMode(PIN_LED_CATHODE, OUTPUT);
  digitalWrite(PIN_LED_CATHODE, LOW);  // GND ảo 0V cố định
  pwmAttachLed(PIN_LED_ANODE, LED3_PWM_CHANNEL);     // Gắn PWM cho đèn LED (điều khiển độ sáng)
  pwmWriteLed(PIN_LED_ANODE, LED3_PWM_CHANNEL, 0);   // LED tắt (duty = 0)

  // 5. Trạng thái logic ban đầu
  fanState = false;
  ledState = false;

  // 6. Cảm biến DHT11 (không cần pull-up ngoài, dùng pull-up nội bộ)
  pinMode(PIN_DHT11, INPUT_PULLUP);
  dht.begin();

  // 6. Đăng ký sự kiện WiFi
  WiFi.onEvent(onWifiEvent);

  // 7. Kết nối WiFi lần đầu (blocking tối đa 15 giây)
  setupWiFi();

  // 8. Cấu hình MQTT
  espClient.setNoDelay(true);
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  mqttClient.setBufferSize(512);
  mqttClient.setKeepAlive(60);

  Serial.println("[System] Khởi động hoàn tất!");
  Serial.println("[Relay] GPIO5=HIGH → Relay HỞ → Quạt TẮT (trạng thái ban đầu an toàn)");
}

// ----------------------------------------------------------------
// LOOP: VÒNG LẶP CHÍNH (HOÀN TOÀN NON-BLOCKING)
// ----------------------------------------------------------------
void loop() {
  // 1. Kiểm tra WiFi non-blocking
  if (WiFi.status() != WL_CONNECTED) {
    reconnectWiFi();
    return;
  }

  // 2. Kiểm tra MQTT non-blocking
  if (!mqttClient.connected()) {
    reconnectMQTT();
  } else {
    mqttClient.loop();
  }

  unsigned long now = millis();

  // 3. Đọc và gửi dữ liệu cảm biến DHT11 mỗi 5 giây
  if (now - lastSensorReadTime >= SENSOR_INTERVAL) {
    lastSensorReadTime = now;
    float humidity    = dht.readHumidity();
    float temperature = dht.readTemperature();
    if (!isnan(humidity) && !isnan(temperature)) {
      lastValidTemp = temperature;
      lastValidHum  = humidity;
      Serial.printf("[DHT11] %.1f°C | %.1f%%\n", temperature, humidity);
    } else {
      Serial.println("[DHT11] Đọc lỗi — dùng giá trị đệm.");
    }
    if (mqttClient.connected()) {
      StaticJsonDocument<128> doc;
      doc["temp"] = round(lastValidTemp * 10) / 10.0;
      doc["hum"]  = round(lastValidHum  * 10) / 10.0;
      char buffer[128];
      serializeJson(doc, buffer);
      mqttClient.publish(TOPIC_TELEMETRY, buffer, true);
    }
  }

  // 4. Heartbeat MQTT mỗi 10 giây
  if (now - lastHeartbeatTime >= HEARTBEAT_INTERVAL) {
    lastHeartbeatTime = now;
    if (mqttClient.connected()) {
      mqttClient.publish(TOPIC_STATUS, "online", true);
    }
  }
}

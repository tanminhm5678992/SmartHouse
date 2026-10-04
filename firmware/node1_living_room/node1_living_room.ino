/**
 * PROJECT: MQTT SMART HOME - IOT REPORT
 * NODE 1: PHÒNG KHÁCH (ESP32-C3)
 * 
 * PHẦN CỨNG:
 * - Cảm biến DHT11: GPIO 4 (Đo nhiệt độ, độ ẩm)
 * - Relay 1 (Đèn trần/Quạt): GPIO 5 (Mặc định Module Active LOW)
 * - LED 1 (Đèn bàn): GPIO 6 (Active HIGH)
 * - LED 2 (Chỉ báo kết nối WiFi/MQTT): GPIO 7 (Active HIGH)
 * 
 * THƯ VIỆN CẦN CÀI ĐẶT TRÊN ARDUINO IDE:
 * 1. PubSubClient (bởi Nick O'Leary)
 * 2. DHT sensor library (bởi Adafruit)
 * 3. ArduinoJson (bởi Benoit Blanchon)
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <ArduinoJson.h>
#include <esp_arduino_version.h>

// ========== CẤU HÌNH WIFI & MQTT ==========
const char* WIFI_SSID     = "YOUR_WIFI_SSID";         // Thay bằng tên WiFi của bạn
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";     // Thay bằng mật khẩu WiFi
const char* MQTT_BROKER   = "192.168.1.100";          // IP máy tính chạy Docker EMQX
const int   MQTT_PORT     = 1883;
const char* CLIENT_ID     = "ESP32C3_Node1_LivingRoom";

// ========== CẤU HÌNH CHÂN GPIO (ESP32-C3) ==========
#define PIN_DHT11       4
#define PIN_RELAY1      5
#define PIN_LED1        6
#define PIN_LED1_GND    3     // Chân GND ảo cho chân ngắn (-) của LED (xuất mức 0V)
#define PIN_LED_STATUS  7

#define DHTTYPE         DHT11
#define RELAY_ACTIVE_LOW true // Đặt true nếu module Relay bật khi chân kích mức LOW (0V)

// ========== CẤU HÌNH PWM (ĐỘ SÁNG) CHO ĐÈN LED ==========
#define LED1_PWM_CHANNEL 0      // Kênh LEDC dùng cho core < 3.0 (core >= 3.0 gán tự động theo chân)
#define LED_PWM_FREQ     5000   // Tần số PWM 5kHz (ánh sáng mịn, không nhấp nháy)
#define LED_PWM_RES      8      // Độ phân giải 8-bit → giá trị duty 0-255

// ========== MQTT TOPICS ==========
const char* TOPIC_STATUS          = "home/sensor/node1/status";
const char* TOPIC_TELEMETRY       = "home/sensor/node1/telemetry";

const char* TOPIC_RELAY1_CMD      = "home/device/relay1/command";
const char* TOPIC_RELAY1_STATE    = "home/device/relay1/state";

const char* TOPIC_LED1_CMD        = "home/device/led1/command";
const char* TOPIC_LED1_STATE      = "home/device/led1/state";

// ========== KHỞI TẠO ĐỐI TƯỢNG ==========
// ========== KHỞI TẠO ĐỐI TƯỢNG VÀ BIẾN TOÀN CỤC ==========
DHT dht(PIN_DHT11, DHTTYPE);
WiFiClient espClient;
PubSubClient mqttClient(espClient);

// Biến lưu trạng thái
bool relay1State = false;
bool led1State = false;

// Biến lưu trữ dữ liệu cảm biến (có giá trị đệm chống gián đoạn khi DHT11 đọc lỗi)
float lastValidTemp = 29.0;
float lastValidHum  = 60.0;

unsigned long lastSensorReadTime = 0;
const unsigned long SENSOR_INTERVAL = 5000; // Đọc DHT11 mỗi 5 giây

unsigned long lastReconnectAttempt = 0;
unsigned long lastHeartbeatTime = 0;
const unsigned long HEARTBEAT_INTERVAL = 10000; // Gửi tín hiệu Heartbeat mỗi 10s giữ kết nối Broker

void setRelay(bool state) {
  relay1State = state;
  if (RELAY_ACTIVE_LOW) {
    digitalWrite(PIN_RELAY1, state ? LOW : HIGH);
  } else {
    digitalWrite(PIN_RELAY1, state ? HIGH : LOW);
  }
  // Gửi trạng thái mới lên MQTT (retained = true để các client sau biết ngay)
  mqttClient.publish(TOPIC_RELAY1_STATE, state ? "ON" : "OFF", true);
  Serial.printf("[Relay 1] Đã chuyển sang: %s\n", state ? "ON" : "OFF");
}

// Chuyển đổi phần trăm độ sáng (0-100%) sang giá trị duty (0-255)
int percentToDuty(int percent) {
  percent = constrain(percent, 0, 100);
  return (percent * ((1 << LED_PWM_RES) - 1)) / 100;
}

// Gắn chân LED vào bộ điều chế độ rộng xung (PWM/LEDC) - tương thích cả core 2.x và 3.x
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
  led1State = percent > 0;
  pwmWriteLed(PIN_LED1, LED1_PWM_CHANNEL, percentToDuty(percent));
  mqttClient.publish(TOPIC_LED1_STATE, led1State ? "ON" : "OFF", true);
  Serial.printf("[LED 1] Độ sáng: %d%% (%s)\n", percent, led1State ? "ON" : "OFF");
}

void setLed(bool state) {
  setLedBrightness(state ? 100 : 0);
}

// Xử lý gói tin MQTT nhận được
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  message.trim();
  Serial.printf("[MQTT RX] [%s] %s\n", topic, message.c_str());

  if (String(topic) == TOPIC_RELAY1_CMD) {
    if (message.equalsIgnoreCase("ON")) {
      setRelay(true);
    } else if (message.equalsIgnoreCase("OFF")) {
      setRelay(false);
    }
  } else if (String(topic) == TOPIC_LED1_CMD) {
    if (message.equalsIgnoreCase("ON")) {
      setLed(true);
    } else if (message.equalsIgnoreCase("OFF")) {
      setLed(false);
    } else if (message.startsWith("SET:")) {
      // Lệnh chỉnh độ sáng dạng "SET:<0-100>"
      setLedBrightness(message.substring(4).toInt());
    }
  }
  // Điều khiển động chân GPIO đăng ký mới từ Web: home/node1/gpio/{pin}/command
  else if (String(topic).startsWith("home/node1/gpio/") && String(topic).endsWith("/command")) {
    int pin = String(topic).substring(16, String(topic).indexOf("/command")).toInt();
    bool state = message.equalsIgnoreCase("ON");
    bool isSet = message.startsWith("SET:");
    if (pin == PIN_RELAY1) {
      setRelay(state);
    } else if (pin == PIN_LED1) {
      if (isSet) setLedBrightness(message.substring(4).toInt());
      else setLed(state);
    } else if (pin >= 0 && pin <= 21) {
      pinMode(pin, OUTPUT);
      digitalWrite(pin, state ? HIGH : LOW);
      String stateTopic = "home/node1/gpio/" + String(pin) + "/state";
      mqttClient.publish(stateTopic.c_str(), state ? "ON" : "OFF", true);
      Serial.printf("[Node 1 Dynamic GPIO] Chân GPIO %d -> %s\n", pin, state ? "ON" : "OFF");
    }
  }
}

// Kết nối WiFi
void setupWiFi() {
  delay(10);
  Serial.println("\n----------------------------------");
  Serial.printf("Đang kết nối WiFi: %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
    digitalWrite(PIN_LED_STATUS, !digitalRead(PIN_LED_STATUS)); // Nhấp nháy LED khi chờ WiFi
    Serial.print(".");
  }

  digitalWrite(PIN_LED_STATUS, HIGH); // Bật sáng LED khi WiFi thành công
  
  // TỐI ƯU CỰC KỲ QUAN TRỌNG: Tắt chế độ tiết kiệm pin để WiFi không bị ngắt kết nối MQTT ngầm
  WiFi.setSleep(false);
  
  Serial.println("\n[WiFi] Đã kết nối thành công!");
  Serial.print("[WiFi] Địa chỉ IP: ");
  Serial.println(WiFi.localIP());
}

// Kết nối MQTT Broker (NON-BLOCKING: KHÔNG GÂY TREO CHIP KHI MẤT MẠNG)
void reconnectMQTT() {
  unsigned long now = millis();
  // Giữ khoảng cách 3 giây giữa các lần thử kết nối để không làm nghẽn socket TCP
  if (now - lastReconnectAttempt < 3000) {
    return;
  }
  lastReconnectAttempt = now;

  Serial.print("[MQTT] Đang kết nối tới broker... ");

  // Tạo Client ID duy nhất dựa vào địa chỉ MAC phần cứng để Broker không bao giờ đá văng
  String uniqueClientId = String(CLIENT_ID) + "_" + String((uint32_t)ESP.getEfuseMac(), HEX);

  // LWT: Nếu node mất kết nối đột ngột, Broker sẽ tự gửi "offline" với retain=true
  if (mqttClient.connect(uniqueClientId.c_str(), TOPIC_STATUS, 1, true, "offline")) {
    Serial.println("Thành công!");
    digitalWrite(PIN_LED_STATUS, HIGH);

    // Báo trạng thái Node đã Online (retain = true)
    mqttClient.publish(TOPIC_STATUS, "online", true);

    // Đăng ký nhận lệnh từ Backend / Home Assistant
    mqttClient.subscribe(TOPIC_RELAY1_CMD);
    mqttClient.subscribe(TOPIC_LED1_CMD);
    mqttClient.subscribe("home/node1/gpio/+/command"); // Cho phép điều khiển động bất kỳ chân nào đăng ký trên Web

    // Publish trạng thái hiện tại
    mqttClient.publish(TOPIC_RELAY1_STATE, relay1State ? "ON" : "OFF", true);
    mqttClient.publish(TOPIC_LED1_STATE, led1State ? "ON" : "OFF", true);

  } else {
    Serial.printf("Thất bại (rc=%d). Sẽ tự thử lại trong vòng 3s...\n", mqttClient.state());
    digitalWrite(PIN_LED_STATUS, LOW);
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n=== SMART HOME NODE 1 (ESP32-C3) KHỞI ĐỘNG ===");

  // Cấu hình chân I/O
  pinMode(PIN_RELAY1, OUTPUT);
  pwmAttachLed(PIN_LED1, LED1_PWM_CHANNEL); // Gắn PWM cho đèn LED (điều khiển độ sáng)
  pinMode(PIN_LED_STATUS, OUTPUT);

  // Cấu hình chân GPIO 3 làm chân GND (0V) cho chân ngắn của LED
  pinMode(PIN_LED1_GND, OUTPUT);
  digitalWrite(PIN_LED1_GND, LOW);

  // Trạng thái ban đầu
  setRelay(false);
  setLed(false);
  digitalWrite(PIN_LED_STATUS, LOW);

  // Khởi động DHT11 (bật trở kéo lên nội bộ)
  pinMode(PIN_DHT11, INPUT_PULLUP);
  dht.begin();

  // Kết nối WiFi & cấu hình MQTT
  setupWiFi();

  // TỐI ƯU CỰC KỲ QUAN TRỌNG CHO TCP SOCKET:
  espClient.setNoDelay(true);        // Tắt Nagle's algorithm để gói tin MQTT đi ngay lập tức
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  mqttClient.setBufferSize(512);     // Mở rộng bộ đệm lên 512 bytes
  mqttClient.setKeepAlive(60);       // Tăng KeepAlive lên 60 giây (Broker chờ tối đa 90 giây)
}

void loop() {
  // Tự động kết nối lại nếu mất WiFi hoặc MQTT
  if (WiFi.status() != WL_CONNECTED) {
    setupWiFi();
  }

  if (!mqttClient.connected()) {
    reconnectMQTT();
  } else {
    mqttClient.loop();
  }

  unsigned long now = millis();

  // 1. Đọc cảm biến nhiệt độ & độ ẩm định kỳ mỗi 5 giây
  if (now - lastSensorReadTime >= SENSOR_INTERVAL) {
    lastSensorReadTime = now;

    float humidity = dht.readHumidity();
    float temperature = dht.readTemperature();

    // Nếu đọc thành công thì cập nhật dữ liệu mới nhất
    if (!isnan(humidity) && !isnan(temperature)) {
      lastValidTemp = temperature;
      lastValidHum = humidity;
      Serial.printf("[DHT11 Phòng Khách] Nhiệt độ: %.1f °C | Độ ẩm: %.1f %%\n", temperature, humidity);
    } else {
      // Nếu cảm biến bị lỏng dây hoặc nhiễu, vẫn giữ giá trị đệm để gửi dữ liệu liên tục, không làm rớt mạng MQTT
      Serial.println("[DHT11 Phòng Khách] Lưu ý: Đọc cảm biến tạm thời gián đoạn, sử dụng giá trị đệm an toàn.");
    }

    // Luôn gửi Telemetry khi MQTT đang kết nối (đảm bảo Broker luôn nhận gói tin, không bao giờ timeout)
    if (mqttClient.connected()) {
      StaticJsonDocument<128> doc;
      doc["temp"] = round(lastValidTemp * 10) / 10.0;
      doc["hum"] = round(lastValidHum * 10) / 10.0;

      char buffer[128];
      serializeJson(doc, buffer);
      mqttClient.publish(TOPIC_TELEMETRY, buffer, true);
    }
  }

  // 2. Gửi tín hiệu Heartbeat định kỳ mỗi 10 giây để giữ kết nối socket luôn thông suốt
  if (now - lastHeartbeatTime >= HEARTBEAT_INTERVAL) {
    lastHeartbeatTime = now;
    if (mqttClient.connected()) {
      mqttClient.publish(TOPIC_STATUS, "online", true);
    }
  }
}

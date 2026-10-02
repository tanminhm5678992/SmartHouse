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

// ========== MQTT TOPICS ==========
const char* TOPIC_STATUS          = "home/sensor/node1/status";
const char* TOPIC_TELEMETRY       = "home/sensor/node1/telemetry";

const char* TOPIC_RELAY1_CMD      = "home/device/relay1/command";
const char* TOPIC_RELAY1_STATE    = "home/device/relay1/state";

const char* TOPIC_LED1_CMD        = "home/device/led1/command";
const char* TOPIC_LED1_STATE      = "home/device/led1/state";

// ========== KHỞI TẠO ĐỐI TƯỢNG ==========
DHT dht(PIN_DHT11, DHTTYPE);
WiFiClient espClient;
PubSubClient mqttClient(espClient);

// Biến lưu trạng thái
bool relay1State = false;
bool led1State = false;
unsigned long lastSensorReadTime = 0;
const unsigned long SENSOR_INTERVAL = 5000; // Đọc DHT11 mỗi 5 giây

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

void setLed(bool state) {
  led1State = state;
  digitalWrite(PIN_LED1, state ? HIGH : LOW);
  mqttClient.publish(TOPIC_LED1_STATE, state ? "ON" : "OFF", true);
  Serial.printf("[LED 1] Đã chuyển sang: %s\n", state ? "ON" : "OFF");
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
    delay(500);
    digitalWrite(PIN_LED_STATUS, !digitalRead(PIN_LED_STATUS)); // Nhấp nháy LED khi chờ WiFi
    Serial.print(".");
  }

  digitalWrite(PIN_LED_STATUS, HIGH); // Bật sáng LED khi WiFi thành công
  Serial.println("\n[WiFi] Đã kết nối thành công!");
  Serial.print("[WiFi] Địa chỉ IP: ");
  Serial.println(WiFi.localIP());
}

// Kết nối MQTT Broker và cấu hình LWT (Last Will & Testament)
void reconnectMQTT() {
  while (!mqttClient.connected()) {
    Serial.print("[MQTT] Đang kết nối tới broker... ");

    // LWT: Nếu node mất kết nối đột ngột, Broker sẽ tự gửi "offline" với retain=true
    if (mqttClient.connect(CLIENT_ID, TOPIC_STATUS, 1, true, "offline")) {
      Serial.println("Thành công!");
      digitalWrite(PIN_LED_STATUS, HIGH);

      // Báo trạng thái Node đã Online (retain = true)
      mqttClient.publish(TOPIC_STATUS, "online", true);

      // Đăng ký nhận lệnh từ Backend / Home Assistant
      mqttClient.subscribe(TOPIC_RELAY1_CMD);
      mqttClient.subscribe(TOPIC_LED1_CMD);

      // Publish trạng thái hiện tại
      mqttClient.publish(TOPIC_RELAY1_STATE, relay1State ? "ON" : "OFF", true);
      mqttClient.publish(TOPIC_LED1_STATE, led1State ? "ON" : "OFF", true);

    } else {
      Serial.printf("Thất bại, mã lỗi rc=%d. Thử lại sau 5s...\n", mqttClient.state());
      digitalWrite(PIN_LED_STATUS, LOW);
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n=== SMART HOME NODE 1 (ESP32-C3) KHỞI ĐỘNG ===");

  // Cấu hình chân I/O
  pinMode(PIN_RELAY1, OUTPUT);
  pinMode(PIN_LED1, OUTPUT);
  pinMode(PIN_LED_STATUS, OUTPUT);

  // Cấu hình chân GPIO 3 làm chân GND (0V) cho chân ngắn của LED
  pinMode(PIN_LED1_GND, OUTPUT);
  digitalWrite(PIN_LED1_GND, LOW);

  // Trạng thái ban đầu
  setRelay(false);
  setLed(false);
  digitalWrite(PIN_LED_STATUS, LOW);

  // Khởi động DHT11
  dht.begin();

  // Kết nối WiFi & cấu hình MQTT
  setupWiFi();
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    setupWiFi();
  }

  if (!mqttClient.connected()) {
    reconnectMQTT();
  }
  mqttClient.loop();

  // Đọc cảm biến định kỳ
  unsigned long now = millis();
  if (now - lastSensorReadTime >= SENSOR_INTERVAL) {
    lastSensorReadTime = now;

    float humidity = dht.readHumidity();
    float temperature = dht.readTemperature();

    if (isnan(humidity) || isnan(temperature)) {
      Serial.println("[DHT11] Lỗi đọc dữ liệu từ cảm biến!");
      return;
    }

    Serial.printf("[DHT11] Nhiệt độ: %.1f °C | Độ ẩm: %.1f %%\n", temperature, humidity);

    // Đóng gói JSON payload
    StaticJsonDocument<128> doc;
    doc["temp"] = round(temperature * 10) / 10.0;
    doc["hum"] = round(humidity * 10) / 10.0;

    char buffer[128];
    serializeJson(doc, buffer);

    // Gửi lên MQTT (retained = true để Home Assistant và Backend nhận ngay)
    mqttClient.publish(TOPIC_TELEMETRY, buffer, true);
  }
}

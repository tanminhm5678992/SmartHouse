/**
 * PROJECT: MQTT SMART HOME - IOT REPORT
 * NODE 2: PHÒNG NGỦ (ESP32-C3)
 * 
 * PHẦN CỨNG:
 * - Cảm biến DHT11: GPIO 4 (Đo nhiệt độ, độ ẩm)
 * - Relay 2 (Quạt hút / Máy lạnh): GPIO 5 (Mặc định Module Active LOW)
 * - LED 3 (Đèn ngủ): GPIO 6 (Active HIGH)
 * - LED 4 (Chỉ báo kết nối WiFi/MQTT): GPIO 7 (Active HIGH)
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
const char* CLIENT_ID     = "ESP32C3_Node2_BedRoom";

// ========== CẤU HÌNH CHÂN GPIO (ESP32-C3) ==========
#define PIN_DHT11       4
#define PIN_RELAY2      5
#define PIN_LED3        6
#define PIN_LED3_GND    3     // Chân GND ảo cho chân ngắn (-) của LED (xuất 0V)
#define PIN_LED_STATUS  7

#define DHTTYPE         DHT11
#define RELAY_ACTIVE_LOW true

// ========== MQTT TOPICS ==========
const char* TOPIC_STATUS          = "home/sensor/node2/status";
const char* TOPIC_TELEMETRY       = "home/sensor/node2/telemetry";

const char* TOPIC_RELAY2_CMD      = "home/device/relay2/command";
const char* TOPIC_RELAY2_STATE    = "home/device/relay2/state";

const char* TOPIC_LED3_CMD        = "home/device/led3/command";
const char* TOPIC_LED3_STATE      = "home/device/led3/state";

// ========== KHỞI TẠO ĐỐI TƯỢNG ==========
DHT dht(PIN_DHT11, DHTTYPE);
WiFiClient espClient;
PubSubClient mqttClient(espClient);

// Biến lưu trạng thái
bool relay2State = false;
bool led3State = false;
unsigned long lastSensorReadTime = 0;
const unsigned long SENSOR_INTERVAL = 5000; // Đọc DHT11 mỗi 5 giây

void setRelay(bool state) {
  relay2State = state;
  if (RELAY_ACTIVE_LOW) {
    digitalWrite(PIN_RELAY2, state ? LOW : HIGH);
  } else {
    digitalWrite(PIN_RELAY2, state ? HIGH : LOW);
  }
  mqttClient.publish(TOPIC_RELAY2_STATE, state ? "ON" : "OFF", true);
  Serial.printf("[Relay 2] Đã chuyển sang: %s\n", state ? "ON" : "OFF");
}

void setLed(bool state) {
  led3State = state;
  digitalWrite(PIN_LED3, state ? HIGH : LOW);
  mqttClient.publish(TOPIC_LED3_STATE, state ? "ON" : "OFF", true);
  Serial.printf("[LED 3] Đã chuyển sang: %s\n", state ? "ON" : "OFF");
}

// Xử lý gói tin MQTT nhận được
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  message.trim();
  Serial.printf("[MQTT RX] [%s] %s\n", topic, message.c_str());

  if (String(topic) == TOPIC_RELAY2_CMD) {
    if (message.equalsIgnoreCase("ON")) {
      setRelay(true);
    } else if (message.equalsIgnoreCase("OFF")) {
      setRelay(false);
    }
  } else if (String(topic) == TOPIC_LED3_CMD) {
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
    digitalWrite(PIN_LED_STATUS, !digitalRead(PIN_LED_STATUS));
    Serial.print(".");
  }

  digitalWrite(PIN_LED_STATUS, HIGH);
  Serial.println("\n[WiFi] Đã kết nối thành công!");
  Serial.print("[WiFi] Địa chỉ IP: ");
  Serial.println(WiFi.localIP());
}

// Kết nối MQTT Broker và cấu hình LWT
void reconnectMQTT() {
  while (!mqttClient.connected()) {
    Serial.print("[MQTT] Đang kết nối tới broker... ");

    if (mqttClient.connect(CLIENT_ID, TOPIC_STATUS, 1, true, "offline")) {
      Serial.println("Thành công!");
      digitalWrite(PIN_LED_STATUS, HIGH);

      mqttClient.publish(TOPIC_STATUS, "online", true);

      mqttClient.subscribe(TOPIC_RELAY2_CMD);
      mqttClient.subscribe(TOPIC_LED3_CMD);

      mqttClient.publish(TOPIC_RELAY2_STATE, relay2State ? "ON" : "OFF", true);
      mqttClient.publish(TOPIC_LED3_STATE, led3State ? "ON" : "OFF", true);

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
  Serial.println("\n=== SMART HOME NODE 2 (ESP32-C3) KHỞI ĐỘNG ===");

  pinMode(PIN_RELAY2, OUTPUT);
  pinMode(PIN_LED3, OUTPUT);
  pinMode(PIN_LED_STATUS, OUTPUT);

  // Cấu hình chân GPIO 3 làm chân GND (0V) cho chân ngắn của LED
  pinMode(PIN_LED3_GND, OUTPUT);
  digitalWrite(PIN_LED3_GND, LOW);

  setRelay(false);
  setLed(false);
  digitalWrite(PIN_LED_STATUS, LOW);

  dht.begin();

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

    StaticJsonDocument<128> doc;
    doc["temp"] = round(temperature * 10) / 10.0;
    doc["hum"] = round(humidity * 10) / 10.0;

    char buffer[128];
    serializeJson(doc, buffer);

    mqttClient.publish(TOPIC_TELEMETRY, buffer, true);
  }
}

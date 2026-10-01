/**
 * PROJECT: SMART HOME IOT - 4 NODES SETUP
 * ESP32 SỐ 2: TRẠM ĐO CẢM BIẾN PHÒNG NGỦ (DHT11)
 * 
 * ĐI DÂY:
 * - DHT11 DATA: GPIO 4 (Nguồn 3.3V & GND)
 * - LED Báo mạng: GPIO 7
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <ArduinoJson.h>

const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* MQTT_BROKER   = "192.168.1.100";
const int   MQTT_PORT     = 1883;
const char* CLIENT_ID     = "ESP32C3_02_Sensor_BedRoom";

#define PIN_DHT11       4
#define PIN_LED_STATUS  7
#define DHTTYPE         DHT11

const char* TOPIC_STATUS    = "home/sensor/node2/status";
const char* TOPIC_TELEMETRY = "home/sensor/node2/telemetry";

DHT dht(PIN_DHT11, DHTTYPE);
WiFiClient espClient;
PubSubClient mqttClient(espClient);
unsigned long lastRead = 0;

void setupWiFi() {
  Serial.printf("\n[ESP32 #2] Đang kết nối WiFi: %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    digitalWrite(PIN_LED_STATUS, !digitalRead(PIN_LED_STATUS));
    Serial.print(".");
  }
  digitalWrite(PIN_LED_STATUS, HIGH);
  Serial.printf("\n[WiFi] Đã kết nối! IP: %s\n", WiFi.localIP().toString().c_str());
}

void reconnectMQTT() {
  while (!mqttClient.connected()) {
    Serial.print("[MQTT] Đang kết nối Broker... ");
    if (mqttClient.connect(CLIENT_ID, TOPIC_STATUS, 1, true, "offline")) {
      Serial.println("Thành công!");
      digitalWrite(PIN_LED_STATUS, HIGH);
      mqttClient.publish(TOPIC_STATUS, "online", true);
    } else {
      Serial.printf("Thất bại (rc=%d), thử lại sau 5s...\n", mqttClient.state());
      digitalWrite(PIN_LED_STATUS, LOW);
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_LED_STATUS, OUTPUT);
  dht.begin();
  setupWiFi();
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) setupWiFi();
  if (!mqttClient.connected()) reconnectMQTT();
  mqttClient.loop();

  if (millis() - lastRead >= 5000) {
    lastRead = millis();
    float hum = dht.readHumidity();
    float temp = dht.readTemperature();

    if (isnan(hum) || isnan(temp)) {
      Serial.println("[DHT11 PN] Lỗi đọc cảm biến!");
      return;
    }

    Serial.printf("[ESP32 #2 - Phòng Ngủ] Nhiệt độ: %.1f °C | Độ ẩm: %.1f %%\n", temp, hum);

    StaticJsonDocument<128> doc;
    doc["temp"] = round(temp * 10) / 10.0;
    doc["hum"] = round(hum * 10) / 10.0;
    char buf[128];
    serializeJson(doc, buf);
    mqttClient.publish(TOPIC_TELEMETRY, buf, true);
  }
}

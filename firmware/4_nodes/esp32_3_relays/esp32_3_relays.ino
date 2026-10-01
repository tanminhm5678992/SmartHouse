/**
 * PROJECT: SMART HOME IOT - 4 NODES SETUP
 * ESP32 SỐ 3: TRẠM ĐÓNG NGẮT 2 RELAY CÔNG SUẤT (ACTUATOR STATION)
 * 
 * ĐI DÂY:
 * - Relay 1 IN: GPIO 4 (Nguồn VCC nối 5V/VIN, GND nối GND)
 * - Relay 2 IN: GPIO 5 (Nguồn VCC nối 5V/VIN, GND nối GND)
 * - LED Báo mạng: GPIO 7
 */

#include <WiFi.h>
#include <PubSubClient.h>

const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* MQTT_BROKER   = "192.168.1.100";
const int   MQTT_PORT     = 1883;
const char* CLIENT_ID     = "ESP32C3_03_Dual_Relays";

#define PIN_RELAY1      4
#define PIN_RELAY2      5
#define PIN_LED_STATUS  7
#define RELAY_ACTIVE_LOW true

const char* TOPIC_STATUS        = "home/device/relays/status";
const char* TOPIC_RELAY1_CMD    = "home/device/relay1/command";
const char* TOPIC_RELAY1_STATE  = "home/device/relay1/state";
const char* TOPIC_RELAY2_CMD    = "home/device/relay2/command";
const char* TOPIC_RELAY2_STATE  = "home/device/relay2/state";

WiFiClient espClient;
PubSubClient mqttClient(espClient);

bool state1 = false;
bool state2 = false;

void setRelay1(bool s) {
  state1 = s;
  digitalWrite(PIN_RELAY1, RELAY_ACTIVE_LOW ? (s ? LOW : HIGH) : (s ? HIGH : LOW));
  mqttClient.publish(TOPIC_RELAY1_STATE, s ? "ON" : "OFF", true);
  Serial.printf("[ESP32 #3] Relay 1: %s\n", s ? "ON" : "OFF");
}

void setRelay2(bool s) {
  state2 = s;
  digitalWrite(PIN_RELAY2, RELAY_ACTIVE_LOW ? (s ? LOW : HIGH) : (s ? HIGH : LOW));
  mqttClient.publish(TOPIC_RELAY2_STATE, s ? "ON" : "OFF", true);
  Serial.printf("[ESP32 #3] Relay 2: %s\n", s ? "ON" : "OFF");
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String msg = "";
  for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];
  msg.trim();
  Serial.printf("[MQTT RX] [%s]: %s\n", topic, msg.c_str());

  if (String(topic) == TOPIC_RELAY1_CMD) {
    setRelay1(msg.equalsIgnoreCase("ON"));
  } else if (String(topic) == TOPIC_RELAY2_CMD) {
    setRelay2(msg.equalsIgnoreCase("ON"));
  }
}

void setupWiFi() {
  Serial.printf("\n[ESP32 #3] Đang kết nối WiFi: %s\n", WIFI_SSID);
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
      mqttClient.subscribe(TOPIC_RELAY1_CMD);
      mqttClient.subscribe(TOPIC_RELAY2_CMD);
      mqttClient.publish(TOPIC_RELAY1_STATE, state1 ? "ON" : "OFF", true);
      mqttClient.publish(TOPIC_RELAY2_STATE, state2 ? "ON" : "OFF", true);
    } else {
      Serial.printf("Thất bại (rc=%d), thử lại sau 5s...\n", mqttClient.state());
      digitalWrite(PIN_LED_STATUS, LOW);
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_RELAY1, OUTPUT);
  pinMode(PIN_RELAY2, OUTPUT);
  pinMode(PIN_LED_STATUS, OUTPUT);

  setRelay1(false);
  setRelay2(false);

  setupWiFi();
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) setupWiFi();
  if (!mqttClient.connected()) reconnectMQTT();
  mqttClient.loop();
}

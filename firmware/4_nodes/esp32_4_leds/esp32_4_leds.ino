/**
 * PROJECT: SMART HOME IOT - 4 NODES SETUP
 * ESP32 SỐ 4: TRẠM ĐÈN CHIẾU SÁNG 4 KÊNH (LIGHTING STATION)
 * 
 * ĐI DÂY (Tất cả LED nối cực dương qua trở 220Ω, cực âm về GND):
 * - LED 1 (Đèn bàn làm việc):  GPIO 4
 * - LED 2 (Đèn tủ trang trí):  GPIO 5
 * - LED 3 (Đèn ngủ dịu nhẹ):   GPIO 6
 * - LED 4 (Đèn ban công):      GPIO 7
 */

#include <WiFi.h>
#include <PubSubClient.h>

const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* MQTT_BROKER   = "192.168.1.100";
const int   MQTT_PORT     = 1883;
const char* CLIENT_ID     = "ESP32C3_04_Quad_LEDs";

#define PIN_LED1  4
#define PIN_LED2  5
#define PIN_LED3  6
#define PIN_LED4  7

const char* TOPIC_STATUS = "home/device/leds/status";

bool ledStates[4] = {false, false, false, false};
const int ledPins[4] = {PIN_LED1, PIN_LED2, PIN_LED3, PIN_LED4};
const char* cmdTopics[4] = {
  "home/device/led1/command",
  "home/device/led2/command",
  "home/device/led3/command",
  "home/device/led4/command"
};
const char* stateTopics[4] = {
  "home/device/led1/state",
  "home/device/led2/state",
  "home/device/led3/state",
  "home/device/led4/state"
};

WiFiClient espClient;
PubSubClient mqttClient(espClient);

void setLed(int index, bool state) {
  ledStates[index] = state;
  digitalWrite(ledPins[index], state ? HIGH : LOW);
  mqttClient.publish(stateTopics[index], state ? "ON" : "OFF", true);
  Serial.printf("[ESP32 #4] LED %d: %s\n", index + 1, state ? "ON" : "OFF");
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String msg = "";
  for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];
  msg.trim();
  Serial.printf("[MQTT RX] [%s]: %s\n", topic, msg.c_str());

  for (int i = 0; i < 4; i++) {
    if (String(topic) == cmdTopics[i]) {
      setLed(i, msg.equalsIgnoreCase("ON"));
      break;
    }
  }
}

void setupWiFi() {
  Serial.printf("\n[ESP32 #4] Đang kết nối WiFi: %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.printf("\n[WiFi] Đã kết nối! IP: %s\n", WiFi.localIP().toString().c_str());
}

void reconnectMQTT() {
  while (!mqttClient.connected()) {
    Serial.print("[MQTT] Đang kết nối Broker... ");
    if (mqttClient.connect(CLIENT_ID, TOPIC_STATUS, 1, true, "offline")) {
      Serial.println("Thành công!");
      mqttClient.publish(TOPIC_STATUS, "online", true);

      for (int i = 0; i < 4; i++) {
        mqttClient.subscribe(cmdTopics[i]);
        mqttClient.publish(stateTopics[i], ledStates[i] ? "ON" : "OFF", true);
      }
    } else {
      Serial.printf("Thất bại (rc=%d), thử lại sau 5s...\n", mqttClient.state());
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  for (int i = 0; i < 4; i++) {
    pinMode(ledPins[i], OUTPUT);
    setLed(i, false);
  }
  setupWiFi();
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) setupWiFi();
  if (!mqttClient.connected()) reconnectMQTT();
  mqttClient.loop();
}

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
#include <esp_arduino_version.h>

const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* MQTT_BROKER   = "192.168.1.100";
const int   MQTT_PORT     = 1883;
const char* CLIENT_ID     = "ESP32C3_04_Quad_LEDs";

#define PIN_LED1  4
#define PIN_LED2  5
#define PIN_LED3  6
#define PIN_LED4  7

// ========== CẤU HÌNH PWM (ĐỘ SÁNG) CHO ĐÈN LED ==========
#define LED_PWM_FREQ 5000  // Tần số PWM 5kHz (ánh sáng mịn, không nhấp nháy)
#define LED_PWM_RES  8     // Độ phân giải 8-bit → giá trị duty 0-255
// Kênh LEDC cho core < 3.0 (core >= 3.0 tự gán kênh theo chân)
const int ledPwmChannel[4] = {0, 1, 2, 3};

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

// Chuyển đổi phần trăm độ sáng (0-100%) sang giá trị duty (0-255)
int percentToDuty(int percent) {
  percent = constrain(percent, 0, 100);
  return (percent * ((1 << LED_PWM_RES) - 1)) / 100;
}

// Điều khiển độ sáng LED theo phần trăm (0-100%)
void setLedBrightness(int index, int percent) {
  percent = constrain(percent, 0, 100);
  ledStates[index] = percent > 0;
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcWrite(ledPins[index], percentToDuty(percent));
#else
  ledcWrite(ledPwmChannel[index], percentToDuty(percent));
#endif
  mqttClient.publish(stateTopics[index], ledStates[index] ? "ON" : "OFF", true);
  Serial.printf("[ESP32 #4] LED %d: %d%% (%s)\n", index + 1, percent, ledStates[index] ? "ON" : "OFF");
}

void setLed(int index, bool state) {
  setLedBrightness(index, state ? 100 : 0);
}

// Gắn PWM cho 4 chân LED - tương thích core 2.x và 3.x
void setupLedPwm() {
  for (int i = 0; i < 4; i++) {
#if ESP_ARDUINO_VERSION_MAJOR >= 3
    ledcAttach(ledPins[i], LED_PWM_FREQ, LED_PWM_RES);
#else
    ledcSetup(ledPwmChannel[i], LED_PWM_FREQ, LED_PWM_RES);
    ledcAttachPin(ledPins[i], ledPwmChannel[i]);
#endif
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String msg = "";
  for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];
  msg.trim();
  Serial.printf("[MQTT RX] [%s]: %s\n", topic, msg.c_str());

  for (int i = 0; i < 4; i++) {
    if (String(topic) == cmdTopics[i]) {
      if (msg.equalsIgnoreCase("ON")) {
        setLedBrightness(i, 100);
      } else if (msg.equalsIgnoreCase("OFF")) {
        setLedBrightness(i, 0);
      } else if (msg.startsWith("SET:")) {
        setLedBrightness(i, msg.substring(4).toInt());
      }
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
  setupLedPwm();
  for (int i = 0; i < 4; i++) {
    setLedBrightness(i, 0);
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

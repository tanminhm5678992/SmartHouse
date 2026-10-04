/**
 * ============================================================
 * TEST QUẠT MINI 5V - ESP32-C3 SUPER MINI
 * ============================================================
 * Mục đích: Kiểm tra quạt mini hoạt động với chân 5V và GPIO5
 * KHÔNG cần WiFi, KHÔNG cần MQTT, KHÔNG cần Web Dashboard
 *
 * ĐẤU DÂY:
 *   Dây ĐỎ  (+) của quạt ──► Chân [ 5V  ] của ESP32-C3
 *   Dây ĐEN (-) của quạt ──► Chân [ GP5 ] (GPIO 5) của ESP32-C3
 *
 * CƠ CHẾ:
 *   GPIO5 = LOW  (0V)   → Quạt CHẠY  (chênh áp = 5V - 0V = 5V)
 *   GPIO5 = HIGH (3.3V) → Quạt DỪNG  (chênh áp = 5V - 3.3V ≈ 1.7V)
 *
 * CÁCH SỬ DỤNG:
 *   1. Nạp sketch này vào ESP32-C3
 *   2. Mở Serial Monitor ở tốc độ 115200 baud
 *   3. Quan sát quạt và đọc hướng dẫn trên Serial Monitor
 *   4. Gõ lệnh vào Serial Monitor để điều khiển:
 *        ON  → Bật quạt (GPIO5 = LOW)
 *        OFF → Tắt quạt (GPIO5 = HIGH)
 *        TEST → Tự động bật 2s rồi tắt 2s (lặp 5 lần)
 *        GND → Thử dùng chân G (GND thật) thay vì GPIO5
 * ============================================================
 */

#define PIN_FAN     5   // Dây ĐEN (-) cắm vào đây
#define PIN_LED     8   // LED onboard ESP32-C3 (báo trạng thái)

// LED onboard ESP32-C3: LOW = sáng, HIGH = tắt
#define LED_ON  LOW
#define LED_OFF HIGH

bool fanOn = false;

void setFan(bool state) {
  fanOn = state;
  if (state) {
    digitalWrite(PIN_FAN, LOW);   // GPIO5 = 0V → chênh 5V → quạt chạy
    digitalWrite(PIN_LED, LED_ON);
    Serial.println(">>> QUẠT: BẬT (GPIO5 = LOW = 0V) <<<");
    Serial.println("    Quạt phải đang CHẠY ngay bây giờ!");
  } else {
    digitalWrite(PIN_FAN, HIGH);  // GPIO5 = 3.3V → chênh ~1.7V → quạt dừng
    digitalWrite(PIN_LED, LED_OFF);
    Serial.println(">>> QUẠT: TẮT (GPIO5 = HIGH = 3.3V) <<<");
    Serial.println("    Quạt phải đã DỪNG ngay bây giờ!");
  }
}

void printMenu() {
  Serial.println("\n╔══════════════════════════════════════╗");
  Serial.println("║   TEST QUẠT MINI - ESP32-C3          ║");
  Serial.println("╠══════════════════════════════════════╣");
  Serial.println("║  Gõ lệnh vào Serial Monitor:         ║");
  Serial.println("║    ON   → Bật quạt (GPIO5 = LOW)     ║");
  Serial.println("║    OFF  → Tắt quạt (GPIO5 = HIGH)    ║");
  Serial.println("║    TEST → Tự test bật/tắt 5 lần      ║");
  Serial.println("║    GND  → Test với GND thật (chân G) ║");
  Serial.println("║    INFO → Hiển thị trạng thái        ║");
  Serial.println("╚══════════════════════════════════════╝");
  Serial.println();
}

void runAutoTest() {
  Serial.println("\n========== TỰ ĐỘNG TEST (5 lần bật/tắt) ==========");
  for (int i = 1; i <= 5; i++) {
    Serial.printf("\n--- Chu kỳ %d/5 ---\n", i);

    Serial.println("[BẬT] GPIO5 = LOW (0V) — Quạt phải CHẠY!");
    digitalWrite(PIN_FAN, LOW);
    digitalWrite(PIN_LED, LED_ON);
    delay(2000);

    Serial.println("[TẮT] GPIO5 = HIGH (3.3V) — Quạt phải DỪNG!");
    digitalWrite(PIN_FAN, HIGH);
    digitalWrite(PIN_LED, LED_OFF);
    delay(1500);
  }
  Serial.println("\n========== KẾT QUẢ KIỂM TRA ==========");
  Serial.println("Nếu quạt CHẠY khi BẬT và DỪNG khi TẮT → Mạch OK ✓");
  Serial.println("Nếu quạt KHÔNG CHẠY dù BẬT → Đọc hướng dẫn bên dưới:");
  Serial.println("  1. Kiểm tra dây ĐỎ cắm đúng chân 5V chưa?");
  Serial.println("  2. Kiểm tra dây ĐEN cắm đúng chân GP5 chưa?");
  Serial.println("  3. Quạt có thể cần dòng > 40mA → cần transistor");
  Serial.println("     Đo điện áp 2 đầu dây quạt khi BẬT = 5V là ổn");
  printMenu();
}

void runGndTest() {
  Serial.println("\n========== TEST VỚI CHÂN GND THẬT ==========");
  Serial.println("Chú ý: Bước này chỉ test phần nguồn, KHÔNG điều khiển được!");
  Serial.println("Hãy thử cắm dây ĐEN của quạt vào chân G (GND) của ESP32.");
  Serial.println("Nếu quạt CHẠY khi cắm vào G → Nguồn 5V OK, vấn đề ở GPIO5.");
  Serial.println("Nếu quạt KHÔNG CHẠY khi cắm vào G → Kiểm tra lại nguồn USB.");
  Serial.println();
  Serial.println("Sau khi test xong, cắm lại dây vào GP5 và gõ TEST.");
}

void setup() {
  Serial.begin(115200);
  delay(1500);

  // Cấu hình GPIO5: OUTPUT trước, rồi HIGH (quạt tắt)
  pinMode(PIN_FAN, OUTPUT);
  digitalWrite(PIN_FAN, HIGH);  // Quạt TẮT khi khởi động

  // Cấu hình LED onboard
  pinMode(PIN_LED, OUTPUT);
  digitalWrite(PIN_LED, LED_OFF);

  Serial.println("\n\n╔══════════════════════════════════════════╗");
  Serial.println("║   CHƯƠNG TRÌNH TEST QUẠT MINI 5V        ║");
  Serial.println("║   ESP32-C3 Super Mini - Không cần WiFi  ║");
  Serial.println("╚══════════════════════════════════════════╝");

  Serial.println("\n📌 ĐẤU DÂY:");
  Serial.println("   Dây ĐỎ  (+) quạt → chân [5V ] của ESP32");
  Serial.println("   Dây ĐEN (-) quạt → chân [GP5] của ESP32");

  // Tự động test ngay khi khởi động
  Serial.println("\n⏳ Tự động bật quạt sau 2 giây...");
  delay(2000);
  runAutoTest();
}

void loop() {
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    cmd.toUpperCase();

    if (cmd == "ON") {
      setFan(true);
    }
    else if (cmd == "OFF") {
      setFan(false);
    }
    else if (cmd == "TEST") {
      runAutoTest();
    }
    else if (cmd == "GND") {
      runGndTest();
    }
    else if (cmd == "INFO") {
      Serial.printf("\n[Trạng thái] Quạt: %s | GPIO5 = %s\n",
        fanOn ? "BẬT" : "TẮT",
        fanOn ? "LOW (0V)" : "HIGH (3.3V)");
      Serial.printf("[GPIO] Đang đọc GPIO5 = %d\n", digitalRead(PIN_FAN));
      printMenu();
    }
    else if (cmd.length() > 0) {
      Serial.printf("Lệnh không hợp lệ: '%s'\n", cmd.c_str());
      printMenu();
    }
  }
}

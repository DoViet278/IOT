#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <DHT.h>
#include <BH1750.h>

// ===== WIFI =====
const char* ssid = "Redmi Note 11";
const char* password = "12345679";

// ===== MQTT =====
const char* mqtt_server = "10.72.10.90";
const int mqtt_port = 1888;
const char* mqtt_user = "DoHuuViet";
const char* mqtt_pass = "viet123456";

const char* topic_control = "DeviceControl";
const char* topic_response = "DeviceResponse";
const char* topic_init = "DeviceInit";
const char* topic_sensor = "DataSensors";

WiFiClient espClient;
PubSubClient client(espClient);

// ===== LED GPIO =====
#define LED1 4
#define LED2 6
#define LED3 7

// ===== DHT11 =====
#define DHTPIN 10
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

// ===== BH1750 =====
#define SDA_PIN 8
#define SCL_PIN 9
BH1750 lightMeter;

// ===== Timer gửi sensor =====
unsigned long lastSend = 0;
const long interval = 2000; // 2 giây

// ================= WIFI =================
void setup_wifi() {
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
  }
}

// ================= GỬI INIT =================
void send_init_status() {
  Serial.println("init");
  for (int id = 1; id <= 3; id++) {
    StaticJsonDocument<100> doc;
    doc["DeviceID"] = id;
    doc["Status"] = "Success";
    doc["Action"] = "OFF";

    String payload;
    serializeJson(doc, payload);
    client.publish(topic_init, payload.c_str());
    delay(100);
  }

}

// ================= CALLBACK =================
void callback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Topic: ");
  Serial.println(topic);

  String message = "";
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }

  StaticJsonDocument<200> doc;
  if (deserializeJson(doc, message)) return;

  int deviceID = doc["DeviceID"];
  const char* action = doc["Action"];

  int targetPin = -1;

  if (deviceID == 1) targetPin = LED1;
  else if (deviceID == 2) targetPin = LED2;
  else if (deviceID == 3) targetPin = LED3;

  if (targetPin != -1) {

    digitalWrite(targetPin, (String(action) == "ON") ? HIGH : LOW);

    StaticJsonDocument<100> resDoc;
    resDoc["DeviceID"] = deviceID;
    resDoc["Status"] = "Success";
    resDoc["Action"] = action;

    String response;
    serializeJson(resDoc, response);
    client.publish(topic_response, response.c_str());
  }
}

// ================= RECONNECT =================
void reconnect() {
  while (!client.connected()) {
    if (client.connect("ESP32_FULLNODE", mqtt_user, mqtt_pass)) {
      Serial.println("connected");
      client.subscribe(topic_control);
      send_init_status();
    } else {
      delay(2000);
    }
  }
}

// ================= SETUP =================
void setup() {
  Serial.begin(115200);

  pinMode(LED1, OUTPUT);
  pinMode(LED2, OUTPUT);
  pinMode(LED3, OUTPUT);

  digitalWrite(LED1, LOW);
  digitalWrite(LED2, LOW);
  digitalWrite(LED3, LOW);

  Wire.begin(SDA_PIN, SCL_PIN);
  dht.begin();
  lightMeter.begin();

  setup_wifi();

  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
}

// ================= LOOP =================
void loop() {

  if (!client.connected()) {
    reconnect();
  }

  client.loop();

  unsigned long now = millis();

  if (now - lastSend >= interval) {
    lastSend = now;

    float temp = dht.readTemperature();
    float hum  = dht.readHumidity();
    float lux  = lightMeter.readLightLevel();

    if (isnan(temp) || isnan(hum)) {
      Serial.println("DHT error");
      return;
    }

    StaticJsonDocument<200> doc;
    doc["temperature"] = temp;
    doc["humidity"] = hum;
    doc["light"] = lux;

    String payload;
    serializeJson(doc, payload);

    client.publish(topic_sensor, payload.c_str());

    Serial.println("Sensor sent:");
    Serial.println(payload);
  }
}
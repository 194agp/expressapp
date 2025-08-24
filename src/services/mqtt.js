// src/services/mqtt.js
const mqtt = require("mqtt");
const { getDb } = require("../config/mongoDB"); // <-- seu db.js

const {
    MQTT_HOST,
    MQTT_PORT,
    MQTT_USER,
    MQTT_PASS,
    MQTT_DEVICE_ID,
    MQTT_TOPIC_BASE,
    PORTAO_MATCH_WINDOW_S,
} = process.env;

const TOPIC_CMD = `${MQTT_TOPIC_BASE}/${MQTT_DEVICE_ID}/cmd`;
const TOPIC_STAT = `${MQTT_TOPIC_BASE}/${MQTT_DEVICE_ID}/stat`;

const url = `mqtts://${MQTT_HOST}:${MQTT_PORT}`;
const client = mqtt.connect(url, {
    username: MQTT_USER,
    password: MQTT_PASS,
    reconnectPeriod: 2000,
});

function abrirPortao(ms = 300) {
  return new Promise((resolve, reject) => {
    const msClamped = Math.min(Math.max(Number(ms)||300, 100), 5000);
    const payload = JSON.stringify({ action: "press", ms: msClamped });
    client.publish(TOPIC_CMD, payload, { qos: 1, retain: false }, (err) => {
      if (err) return reject(err);
      resolve({ topic: TOPIC_CMD, payload: { action: "press", ms: msClamped } });
    });
  });
}

client.on("connect", () => {
  console.log("[MQTT] conectado");
  client.subscribe(TOPIC_STAT, { qos: 1 }, err => {
    if (err) console.error("[MQTT] subscribe erro:", err?.message);
  });
});

client.on("message", async (topic, buf) => {
  try {
    const data = JSON.parse(buf.toString("utf8"));

    // só fecha pendência com status final
    const allowed = ["done", "ignored"];
    if (!allowed.includes(data.status)) return;

    const db = getDb();
    const logs = db.collection("logs_portao");

    const deviceId = data.deviceId || MQTT_DEVICE_ID;
    const windowMs = Number(PORTAO_MATCH_WINDOW_S) * 1000 || 30000;
    const windowStart = new Date(Date.now() - windowMs);

    // pega o registro "sent" mais recente desse device dentro da janela e atualiza
    const upd = await logs.findOneAndUpdate(
      {
        deviceId,
        status: "sent",
        used: { $ne: true },
        requestedAt: { $gte: windowStart },
      },
      {
        $set: {
          used: true,
          status: data.status,          // done | ignored
          info: data.info || null,
          rssi: data.rssi ?? null,
          uptime_s: data.uptime_s ?? null,
          ip: data.ip || null,
          heap: data.heap ?? null,
          ts: data.ts ? new Date(data.ts * 1000) : new Date(),
          receivedAt: new Date(),
          topic,
        },
      },
      { sort: { requestedAt: -1 }, returnDocument: "after" }
    );

    if (!upd.value) {
      console.warn("[MQTT->DB] sem pendência compatível p/ fechar (janela)");
    }
  } catch (e) {
    console.error("[MQTT->DB] falha:", e?.message);
  }
});

module.exports = { client, abrirPortao, TOPIC_CMD, TOPIC_STAT };
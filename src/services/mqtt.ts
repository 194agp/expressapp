// src/services/mqtt.ts
import mqtt from 'mqtt';
import { EventEmitter } from 'events';
import { getDb } from '../config/mongoDB';

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

export interface MqttStatData {
  status: string;
  ts?: number;
  info?: string;
  rssi?: number;
  uptime_s?: number;
  ip?: string;
  heap?: number;
  deviceId?: string;
  online?: boolean;
}

export interface StatEvent {
  topic: string;
  data: MqttStatData;
  deviceId: string;
  receivedAt: Date;
}

export const statBus = new EventEmitter();
statBus.setMaxListeners(50);

/**
 * Publica o comando de abrir portão.
 */
export function abrirPortao(ms = 300): Promise<{ topic: string; payload: object }> {
  return new Promise((resolve, reject) => {
    const msClamped = Math.min(Math.max(Number(ms) || 300, 100), 5000);
    const payload = JSON.stringify({ action: 'press', ms: msClamped });
    client.publish(TOPIC_CMD, payload, { qos: 1, retain: false }, (err) => {
      if (err) return reject(err);
      resolve({ topic: TOPIC_CMD, payload: { action: 'press', ms: msClamped } });
    });
  });
}

interface WaitForAckParams {
  deviceId?: string;
  sinceDate?: Date;
  timeoutMs?: number;
}

/**
 * Aguarda uma mensagem de status final do ESP (done|ignored) após "sinceDate".
 */
export function waitForAck({ deviceId = MQTT_DEVICE_ID!, sinceDate, timeoutMs = 5000 }: WaitForAckParams): Promise<StatEvent> {
  return new Promise((resolve, reject) => {
    const allowed = new Set(['done', 'ignored']);
    const sinceTs = (sinceDate instanceof Date ? sinceDate : new Date()).getTime();

    const cleanup = () => {
      clearTimeout(timer);
      statBus.removeListener('stat', onStat);
    };

    const onStat = (evt: StatEvent) => {
      try {
        if (!evt || evt.deviceId !== deviceId) return;
        if (!allowed.has(evt.data?.status)) return;

        const msgTs = evt.data?.ts ? evt.data.ts * 1000 : evt.receivedAt.getTime();
        if (msgTs < sinceTs) return;

        cleanup();
        resolve(evt);
      } catch (e) {
        cleanup();
        reject(e);
      }
    };

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('no_ack'));
    }, Number(timeoutMs) || 5000);

    statBus.on('stat', onStat);
  });
}

client.on('connect', () => {
  console.log('[MQTT] conectado');
  client.subscribe(TOPIC_STAT, { qos: 1 }, (err) => {
    if (err) console.error('[MQTT] subscribe erro:', err?.message);
  });
});

client.on('message', async (topic, buf) => {
  try {
    const data: MqttStatData = JSON.parse(buf.toString('utf8'));
    const allowed = ['done', 'ignored'];

    statBus.emit('stat', {
      topic,
      data,
      deviceId: data.deviceId || MQTT_DEVICE_ID!,
      receivedAt: new Date(),
    } satisfies StatEvent);

    if (!allowed.includes(data.status)) return;

    const db = getDb();
    const logs = db.collection('logs_portao');

    const deviceId = data.deviceId || MQTT_DEVICE_ID!;
    const windowMs = Number(PORTAO_MATCH_WINDOW_S) * 1000 || 30000;
    const windowStart = new Date(Date.now() - windowMs);

    await logs.findOneAndUpdate(
      { deviceId, status: 'sent', used: { $ne: true }, requestedAt: { $gte: windowStart } },
      {
        $set: {
          used: true,
          status: data.status,
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
      { sort: { requestedAt: -1 }, returnDocument: 'after' }
    );
  } catch (e: any) {
    console.error('[MQTT->DB] falha:', e?.message);
  }
});

export { client, TOPIC_CMD, TOPIC_STAT };

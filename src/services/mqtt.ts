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

const DEBUG_EVENT_LIMIT = 200;

type MqttDebugEventType =
  | 'connect'
  | 'reconnect'
  | 'close'
  | 'offline'
  | 'end'
  | 'error'
  | 'subscribe'
  | 'publish'
  | 'message';

export interface MqttDebugEvent {
  type: MqttDebugEventType;
  at: string;
  topic?: string;
  payload?: string;
  qos?: number;
  retain?: boolean;
  detail?: string;
}

export interface MqttDebugSnapshot {
  connected: boolean;
  disconnected: boolean;
  reconnecting: boolean;
  endpoint: string;
  topics: { cmd: string; stat: string };
  counters: {
    connects: number;
    reconnects: number;
    publishes: number;
    messages: number;
  };
  last: {
    connectAt: string | null;
    messageAt: string | null;
    messageTopic: string | null;
    messagePayload: string | null;
    errorAt: string | null;
    error: string | null;
  };
}

export interface MqttReceivedMessage {
  topic: string;
  payload: string;
  receivedAt: string;
  qos: number | null;
  retain: boolean | null;
}

interface WaitForMessageParams {
  topic: string;
  timeoutMs?: number;
  qos?: number;
}

interface PublishDebugParams {
  topic?: string;
  payload?: unknown;
  qos?: number;
  retain?: boolean;
}

interface PublishRawParams {
  topic: string;
  payload: string;
  qos: 0 | 1 | 2;
  retain: boolean;
}

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

const debugEvents: MqttDebugEvent[] = [];
let connectCount = 0;
let reconnectCount = 0;
let publishCount = 0;
let messageCount = 0;
let lastConnectAt: Date | null = null;
let lastMessageAt: Date | null = null;
let lastMessageTopic: string | null = null;
let lastMessagePayload: string | null = null;
let lastErrorAt: Date | null = null;
let lastErrorMessage: string | null = null;

function clampQos(value: unknown, fallback: 0 | 1 | 2 = 1): 0 | 1 | 2 {
  const n = Number(value);
  if (n === 0 || n === 1 || n === 2) return n;
  return fallback;
}

function toIsoOrNull(date: Date | null): string | null {
  return date instanceof Date ? date.toISOString() : null;
}

function truncate(value: string, max = 600): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}...`;
}

function addDebugEvent(evt: Omit<MqttDebugEvent, 'at'>): void {
  debugEvents.push({ ...evt, at: new Date().toISOString() });
  if (debugEvents.length > DEBUG_EVENT_LIMIT) {
    debugEvents.splice(0, debugEvents.length - DEBUG_EVENT_LIMIT);
  }
}

function payloadToString(payload: unknown): string {
  if (typeof payload === 'string') return payload;
  if (Buffer.isBuffer(payload)) return payload.toString('utf8');
  try {
    return JSON.stringify(payload ?? {});
  } catch {
    return String(payload);
  }
}

function publishRaw({ topic, payload, qos, retain }: PublishRawParams): Promise<void> {
  return new Promise((resolve, reject) => {
    client.publish(topic, payload, { qos, retain }, (err) => {
      if (err) {
        lastErrorAt = new Date();
        lastErrorMessage = err.message;
        addDebugEvent({ type: 'error', detail: `publish:${err.message}`, topic });
        reject(err);
        return;
      }

      publishCount += 1;
      addDebugEvent({ type: 'publish', topic, payload: truncate(payload), qos, retain });
      resolve();
    });
  });
}

/**
 * Publica o comando de abrir portao.
 */
export function abrirPortao(ms = 300): Promise<{ topic: string; payload: object }> {
  return new Promise((resolve, reject) => {
    const msClamped = Math.min(Math.max(Number(ms) || 300, 100), 5000);
    const payloadObj = { action: 'press', ms: msClamped };
    const payload = JSON.stringify(payloadObj);

    publishRaw({ topic: TOPIC_CMD, payload, qos: 1, retain: false })
      .then(() => resolve({ topic: TOPIC_CMD, payload: payloadObj }))
      .catch(reject);
  });
}

interface WaitForAckParams {
  deviceId?: string;
  sinceDate?: Date;
  timeoutMs?: number;
}

/**
 * Aguarda uma mensagem de status final do ESP (done|ignored) apos "sinceDate".
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

export function getMqttDebugSnapshot(): MqttDebugSnapshot {
  return {
    connected: client.connected,
    disconnected: client.disconnected,
    reconnecting: Boolean((client as { reconnecting?: boolean }).reconnecting),
    endpoint: url,
    topics: { cmd: TOPIC_CMD, stat: TOPIC_STAT },
    counters: {
      connects: connectCount,
      reconnects: reconnectCount,
      publishes: publishCount,
      messages: messageCount,
    },
    last: {
      connectAt: toIsoOrNull(lastConnectAt),
      messageAt: toIsoOrNull(lastMessageAt),
      messageTopic: lastMessageTopic,
      messagePayload: lastMessagePayload,
      errorAt: toIsoOrNull(lastErrorAt),
      error: lastErrorMessage,
    },
  };
}

export function getRecentMqttDebugEvents(limit = 50): MqttDebugEvent[] {
  const n = Math.min(Math.max(Number(limit) || 50, 1), DEBUG_EVENT_LIMIT);
  return debugEvents.slice(-n);
}

export async function publishDebugMessage({
  topic = TOPIC_CMD,
  payload = { action: 'press', ms: 300 },
  qos = 1,
  retain = false,
}: PublishDebugParams): Promise<{ topic: string; payload: string; qos: 0 | 1 | 2; retain: boolean }> {
  const topicClean = String(topic || '').trim() || TOPIC_CMD;
  const qosClean = clampQos(qos, 1);
  const retainClean = Boolean(retain);
  const payloadStr = payloadToString(payload);

  await publishRaw({ topic: topicClean, payload: payloadStr, qos: qosClean, retain: retainClean });

  return { topic: topicClean, payload: payloadStr, qos: qosClean, retain: retainClean };
}

export function waitForNextMessage({
  topic,
  timeoutMs = 15000,
  qos = 1,
}: WaitForMessageParams): Promise<MqttReceivedMessage> {
  return new Promise((resolve, reject) => {
    const topicClean = String(topic || '').trim();
    if (!topicClean) {
      reject(new Error('topic_required'));
      return;
    }

    const timeout = Math.min(Math.max(Number(timeoutMs) || 15000, 100), 60000);
    const qosClean = clampQos(qos, 1);
    const shouldUnsubscribe = topicClean !== TOPIC_STAT;

    let timer: NodeJS.Timeout;
    let settled = false;

    const cleanup = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      client.removeListener('message', onMessage);
      if (shouldUnsubscribe) {
        client.unsubscribe(topicClean, (err) => {
          if (!err) return;
          addDebugEvent({ type: 'error', detail: `unsubscribe:${err.message}`, topic: topicClean });
        });
      }
    };

    const onMessage = (incomingTopic: string, payloadBuf: Buffer, packet: any) => {
      if (incomingTopic !== topicClean) return;
      const payload = payloadBuf.toString('utf8');

      cleanup();
      resolve({
        topic: incomingTopic,
        payload,
        receivedAt: new Date().toISOString(),
        qos: typeof packet?.qos === 'number' ? packet.qos : null,
        retain: typeof packet?.retain === 'boolean' ? packet.retain : null,
      });
    };

    timer = setTimeout(() => {
      cleanup();
      reject(new Error('timeout_waiting_message'));
    }, timeout);

    client.on('message', onMessage);
    client.subscribe(topicClean, { qos: qosClean }, (err) => {
      if (err) {
        cleanup();
        reject(err);
        return;
      }

      addDebugEvent({ type: 'subscribe', topic: topicClean, qos: qosClean });
    });
  });
}

client.on('connect', () => {
  connectCount += 1;
  lastConnectAt = new Date();
  addDebugEvent({ type: 'connect', detail: 'connected' });

  console.log('[MQTT] conectado');
  client.subscribe(TOPIC_STAT, { qos: 1 }, (err) => {
    if (err) {
      lastErrorAt = new Date();
      lastErrorMessage = err.message;
      addDebugEvent({ type: 'error', detail: `subscribe:${err.message}`, topic: TOPIC_STAT });
      console.error('[MQTT] subscribe erro:', err.message);
      return;
    }

    addDebugEvent({ type: 'subscribe', topic: TOPIC_STAT, qos: 1 });
  });
});

client.on('reconnect', () => {
  reconnectCount += 1;
  addDebugEvent({ type: 'reconnect', detail: 'reconnecting' });
});

client.on('close', () => {
  addDebugEvent({ type: 'close', detail: 'connection_closed' });
});

client.on('offline', () => {
  addDebugEvent({ type: 'offline', detail: 'offline' });
});

client.on('end', () => {
  addDebugEvent({ type: 'end', detail: 'ended' });
});

client.on('error', (err) => {
  lastErrorAt = new Date();
  lastErrorMessage = err.message;
  addDebugEvent({ type: 'error', detail: err.message });
  console.error('[MQTT] erro:', err.message);
});

client.on('message', async (topic, buf) => {
  const rawPayload = buf.toString('utf8');
  messageCount += 1;
  lastMessageAt = new Date();
  lastMessageTopic = topic;
  lastMessagePayload = truncate(rawPayload);
  addDebugEvent({ type: 'message', topic, payload: truncate(rawPayload) });

  try {
    const data: MqttStatData = JSON.parse(rawPayload);
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
    lastErrorAt = new Date();
    lastErrorMessage = e?.message || 'unknown_error';
    addDebugEvent({ type: 'error', detail: `message:${lastErrorMessage}`, topic });
    console.error('[MQTT->DB] falha:', e?.message);
  }
});

export { client, TOPIC_CMD, TOPIC_STAT };

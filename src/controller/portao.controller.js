// src/controller/portao.controller.js
const { abrirPortao, waitForAck } = require("../services/mqtt");
const { getDb } = require("../config/mongoDB");
const { sendMessage } = require("../api/Whatsapp.js");
const { getUserName } = require("./mongo.controller.js");

// Helpers de horário
function getLocalHour(tz) {
  const s = new Date().toLocaleString("pt-BR", {
    timeZone: tz,
    hour: "2-digit",
    hour12: false,
  });
  return Number(s);
}
function isHorarioBloqueado(tz, inicio, fim) {
  const h = getLocalHour(tz);
  if (inicio < fim) return h >= inicio && h < fim;
  return h >= inicio || h < fim;
}
function getLocalTimeStr(tz) {
  return new Date().toLocaleString("pt-BR", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

module.exports = {
  async abrir(req, res) {
    try {
      const { userId, ms = 300 } = req.body;
      if (!userId) {
        return res.status(400).json({ ok: false, error: "userId obrigatório" });
      }

      const db = getDb();
      const logs = db.collection("logs_portao");
      const deviceId = process.env.MQTT_DEVICE_ID || "portao01";

      const TZ = process.env.PORTAO_TZ || process.env.TZ || "America/Sao_Paulo";
      const BLOQ_INICIO = Number(process.env.PORTAO_BLOQUEIO_INICIO ?? 22);
      const BLOQ_FIM = Number(process.env.PORTAO_BLOQUEIO_FIM ?? 6);
      const horaAtual = getLocalTimeStr(TZ);
      const bloqueado = isHorarioBloqueado(TZ, BLOQ_INICIO, BLOQ_FIM);

      let userName = String(userId);
      try { userName = await getUserName(userId); } catch (_) { }

      const requestedMs = Math.min(Math.max(Number(ms) || 300, 100), 5000);
      const now = new Date();

      if (bloqueado) {
        await logs.insertOne({
          userId: String(userId),
          userName,
          deviceId,
          status: "blocked_time",
          requestedMs,
          requestedAt: now,
          tz: TZ,
          hour: horaAtual,
          window: { start: BLOQ_INICIO, end: BLOQ_FIM },
        });

        try {
          await sendMessage(
            process.env.WPP_CELLAR,
            `🚫 Tentativa de abertura **fora do horário** (janela ${BLOQ_INICIO}h–${BLOQ_FIM}h).\n👤 Usuário: *${userName}*\n🕒 ${horaAtual}`
          );
        } catch (e) {
          console.error("[WPP] falha ao enviar aviso:", e?.message);
        }

        return res.status(403).json({
          ok: false,
          error: "bloqueado_horario",
          detail: `Abertura não permitida entre ${BLOQ_INICIO}h e ${BLOQ_FIM}h (${TZ}).`,
        });
      }

      // 1) registra pendência "sent"
      const ins = await logs.insertOne({
        userId: String(userId),
        userName,
        deviceId,
        status: "sent",
        requestedMs,
        requestedAt: now,
        used: false,
        tz: TZ,
        hour: horaAtual,
      });
      const corrId = ins.insertedId?.toString();

      // 2) WhatsApp: etapa 1 (comando enviado, aguardando confirmação)
      try {
        await sendMessage(process.env.WPP_CELLAR, `🔔 *${userName}* solicitou abertura.\n📤 Comando enviado ao portão (ms=${requestedMs}).\n⏳ Aguardando confirmação...`
        );
      } catch (e) {
        console.error("[WPP] falha ao enviar aviso inicial:", e?.message);
      }

      // 3) publica comando
      const sent = await abrirPortao(requestedMs); // <-- envia para o broker:contentReference[oaicite:3]{index=3}

      // 4) aguarda ACK do ESP (done|ignored) até timeout
      const timeoutMs = Number(process.env.PORTAO_ACK_TIMEOUT_MS) || 5000;

      try {
        const ackEvt = await waitForAck({ deviceId, sinceDate: now, timeoutMs, });

        // 5) WhatsApp: etapa 2 (confirmado)
        try {
          await sendMessage(process.env.WPP_CELLAR, `🔔 Portão aberto por *${userName}*.\n🕒 ${getLocalTimeStr(TZ)}`
          );
        } catch (e) {
          console.error("[WPP] falha ao enviar confirmação:", e?.message);
        }

        return res.json({
          ok: true,
          sent,
          ack: {
            status: ackEvt.data?.status,
            ts: ackEvt.data?.ts || null,
            info: ackEvt.data?.info || null,
          },
          correlationId: corrId,
        });
      } catch (ackErr) {
        // 6) sem ACK dentro do timeout
        try {
          await sendMessage(process.env.WPP_CELLAR, `❌ Sem confirmação do dispositivo em ${timeoutMs} ms.\n🔎 Verifique energia/Wi-Fi do ESP.`);
        } catch (e) {
          console.error("[WPP] falha ao enviar falha:", e?.message);
        }

        // HTTP 504 (gateway timeout) é semântico aqui
        return res.status(504).json({
          ok: false,
          error: "no_ack",
          detail: "Comando publicado no broker, mas o dispositivo não confirmou a execução dentro do prazo.",
          sent,
          correlationId: corrId,
        });
      }
    } catch (e) {
      return res.status(500).json({ ok: false, error: "publish_failed", detail: e.message });
    }
  },

  async logs(req, res) {
    try {
      const db = getDb();
      const col = db.collection("logs_portao");
      const { deviceId = "portao01", limit = 50 } = req.query;

      const docs = await col
        .find({ deviceId })
        .sort({ receivedAt: -1 })
        .limit(Math.min(Number(limit), 500))
        .toArray();

      return res.json(docs);
    } catch (e) {
      return res.status(500).json({ ok: false, error: "db_failed", detail: e?.message });
    }
  },
};

// src/controller/portao.controller.js
const { abrirPortao } = require("../services/mqtt");
const { getDb } = require("../config/mongoDB");
const { sendMessage } = require("../api/Whatsapp.js");
const { getUserName } = require("./mongo.controller.js");
const { utcToZonedTime } = require('date-fns-tz');

// Helpers de horário (sem libs externas)
function getLocalHour(tz) {
    // retorna a hora local 0..23 no fuso desejado
    const s = new Date().toLocaleString('pt-BR', {
        timeZone: tz,
        hour: '2-digit',
        hour12: false,
    });
    return Number(s); // "05" -> 5, "22" -> 22
}

function isHorarioBloqueado(tz, inicio, fim) {
    // bloqueia [22..23] U [0..5] por padrão (inicio=22, fim=6)
    const h = getLocalHour(tz);
    if (inicio < fim) {
        // janela “normal” (ex.: 8..18)
        return h >= inicio && h < fim;
    }
    // janela que cruza meia-noite (ex.: 22..06)
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

            // config de bloqueio (com defaults)
            const TZ = process.env.PORTAO_TZ || process.env.TZ || "America/Sao_Paulo";
            const BLOQ_INICIO = Number(process.env.PORTAO_BLOQUEIO_INICIO ?? 22); // 22h
            const BLOQ_FIM = Number(process.env.PORTAO_BLOQUEIO_FIM ?? 6);     // 06h
            const horaAtual = getLocalTimeStr(TZ);
            const bloqueado = isHorarioBloqueado(TZ, BLOQ_INICIO, BLOQ_FIM);

            // pega o nome do usuário (para a mensagem do WhatsApp / log)
            let userName = String(userId);
            try {
                userName = await getUserName(userId);
            } catch (_) {
                // mantém o fallback no próprio userId
            }

            const requestedMs = Math.min(Math.max(Number(ms) || 300, 100), 5000);
            const now = new Date();

            if (bloqueado) {
                // 1) loga tentativa bloqueada
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

                // 2) avisa no WhatsApp
                try {
                    await sendMessage(
                        process.env.WPP_CELLAR,
                        `🚫 Tentativa de abertura **fora do horário** (janela ${BLOQ_INICIO}h–${BLOQ_FIM}h).\n👤 Usuário: *${userName}*\n🕒 ${horaAtual}`
                    );
                } catch (e) {
                    // não quebra o fluxo por falha no WhatsApp
                    console.error("[WPP] falha ao enviar aviso:", e?.message);
                }

                return res.status(403).json({
                    ok: false,
                    error: "bloqueado_horario",
                    detail: `Abertura não permitida entre ${BLOQ_INICIO}h e ${BLOQ_FIM}h (${TZ}).`,
                });
            }

            // janela liberada → registra pendente "sent"
            await logs.insertOne({
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

            // WhatsApp informando que vai abrir
            try {
                await sendMessage(
                    process.env.WPP_CELLAR,
                    `🔔 O portão foi solicitado por *${userName}* e **vai abrir agora**.\n🕒 Hora local (${TZ}): ${String(horaAtual).padStart(2, "0")}:00`
                );
            } catch (e) {
                console.error("[WPP] falha ao enviar aviso:", e?.message);
            }

            // publica (SEM userId — não passa pelo ESP)
            const sent = await abrirPortao(requestedMs);
            return res.json({ ok: true, sent });

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

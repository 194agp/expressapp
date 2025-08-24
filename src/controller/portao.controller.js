// src/controller/portao.controller.js
const { abrirPortao } = require("../services/mqtt");
const { getDb } = require("../config/mongoDB");

module.exports = {
    async abrir(req, res) {
        try {
            const { userId, ms = 300 } = req.body;
            if (!userId) return res.status(400).json({ ok: false, error: "userId obrigatório" });

            const db = getDb();
            const logs = db.collection("logs_portao");
            const deviceId = process.env.MQTT_DEVICE_ID || "portao01";

            // 1) cria registro pendente (status "sent")
            await logs.insertOne({
                userId: String(userId),          // id vindo do front
                deviceId,
                status: "sent",            // pendente
                requestedMs: Math.min(Math.max(Number(ms) || 300, 100), 5000),
                requestedAt: new Date(),
                used: false,               // marcador p/ casamento
            });

            // 2) publica comando (SEM userId – não passa pelo ESP)
            const sent = await abrirPortao(ms);

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

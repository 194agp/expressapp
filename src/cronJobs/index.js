// src/cronJobs/index.js
require('dotenv').config();
const cron = require('node-cron');
const { sendMessage, sendSurvey } = require('../api/Whatsapp.js');
const { findElimAusenteService } = require('../services/ElimAusenteService.js');

/**
 * Inicializa todos os cron jobs, usando o `db` que foi
 * armazenado em `app.locals.db` lá no server.js.
 *
 * @param {import('express').Application} app
 */
function initCronJobs(app) {
    const db = app.locals.db;
    if (!db) throw new Error('Você precisa chamar connect() e atribuir app.locals.db antes de initCronJobs');

    // 1) Survey de poker toda quinta-feira às 10h (horário de SP)
    cron.schedule(
        '0 10 * * 4',
        async () => {
            try {
                await sendSurvey(
                    process.env.POKERGROUP,
                    'Hoje tem poker??',
                    ['Sim', 'Não']
                );
                console.log('📋 [Survey] Enviado com sucesso');
            } catch (err) {
                console.error('❌ Erro ao enviar survey:', err);
            }
        },
        { timezone: 'America/Sao_Paulo' }
    );

    // 2) Consulta de residentes às 08:00 (horário de SP)
    cron.schedule(
        '0 8 * * *',
        async () => {
            try {
                const resultados = await findElimAusenteService(db);
                console.log('📋 [08:00] Residentes com eliminações ausentes:', resultados);
            } catch (err) {
                console.error('❌ Erro no cronjob residentes (08:00):', err);
            }
        },
        { timezone: 'America/Sao_Paulo' }
    );

    // 3) Execução de teste às 08:05 (horário de SP)
    cron.schedule(
        '20 08 * * *',
        async () => {
            try {
                const resultados = await findElimAusenteService(db);

                const wppGroupId = process.env.WPP_GROUP_TECNICOS;

                if (resultados.length > 0) {
                    const linha = resultados.map(resultado => {
                        const datas = resultado.ultimasAnotacoes
                            .map(data => `  • ${data}`)
                            .join('\n');
                        return `👴👵 ${resultado.nome}:\n${datas}`;
                    }).join('\n\n');

                    const mensagem = [
                        '🤖 *Alerta de Saúde*',
                        '',
                        'O robô identificou que estes idosos têm 4 registros seguidos',
                        'com *eliminação intestinal ausente*:',
                        '',
                        linha,
                        '',
                        'Por favor, verifique o atendimento de cada um.',
                        '👍'
                    ].join('\n');

                    // Envia via WhatsApp
                    await sendMessage(wppGroupId, mensagem);
                    console.log('✅ Alerta enviado ao WhatsApp');
                } else {
                    console.log('🔍 Nenhum residente com 4 registros ausentes hoje.');
                }

            } catch (err) {
                console.error('❌ Erro no cronjob residentes (22:58):', err);
            }
        },
        { timezone: 'America/Sao_Paulo' }
    );
}

module.exports = initCronJobs;

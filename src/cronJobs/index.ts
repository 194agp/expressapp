import cron from 'node-cron';
import type { Application } from 'express';
import { sendMessage, sendSurvey } from '../api/Whatsapp.js';
import { findElimAusenteService } from '../services/ElimAusenteService';
import { findSemEvolucao7dService } from '../services/FindSemEvolucao7dService';
import formatarData from '../utils/funcoes/formatarData';
import formatarNome from '../utils/funcoes/formatarNome';

/**
 * Inicializa todos os cron jobs.
 * Requer que app.locals.db esteja definido antes de chamar.
 */
export default function initCronJobs(app: Application): void {
  const db = app.locals['db'];
  if (!db) throw new Error('Você precisa chamar connect() e atribuir app.locals.db antes de initCronJobs');

  // 1) Survey de poker toda quinta-feira às 10h (horário de SP)
  cron.schedule(
    '0 10 * * 4',
    async () => {
      try {
        await sendSurvey(process.env.POKERGROUP!, 'Hoje tem poker??', ['Sim', 'Não']);
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

  // 3) Alerta de eliminação intestinal ausente às 08:35 (horário de SP)
  cron.schedule(
    '35 08 * * *',
    async () => {
      try {
        const resultados = await findElimAusenteService(db);
        const wppGroupId = process.env.WPP_GROUP_TECNICOS!;

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
            '👍',
          ].join('\n');

          await sendMessage(wppGroupId, mensagem);
          console.log('✅ Alerta enviado ao WhatsApp');
        } else {
          console.log('🔍 Nenhum residente com 4 registros ausentes hoje.');
        }
      } catch (err) {
        console.error('❌ Erro no cronjob residentes (08:35):', err);
      }
    },
    { timezone: 'America/Sao_Paulo' }
  );

  // 4) Alerta de evolução >7 dias às 09:00 (horário de SP)
  cron.schedule(
    '0 9 * * *',
    async () => {
      try {
        const resultados = await findSemEvolucao7dService(db);
        const wppGroupId = process.env.WPP_GROUP_MULTIDISCIPLINAR!;

        if (!resultados || resultados.length === 0) {
          console.log('🔍 Nenhuma área com residentes >7 dias sem evolução.');
          return;
        }

        const blocos = resultados.map(({ area, residentes }) => {
          const linhas = residentes.map(r =>
            `  • ${formatarNome(r.nome)} — últ.: ${formatarData(r.ultimaEvolucao)} (${r.daysSince}d)`
          ).join('\n');
          return `*${area}*\n${linhas}`;
        }).join('\n\n');

        const mensagem = [
          '🤖 *Alerta de Evolução*',
          '',
          'Idosos sem evolução há *mais de 7 dias* (por área):',
          '',
          blocos,
          '',
          'Por favor, realizar as evoluções pendentes. 👍',
        ].join('\n');

        await sendMessage(wppGroupId, mensagem);
        console.log('✅ Alerta sem evolução enviado ao WhatsApp');
      } catch (err) {
        console.error('❌ Erro no cronjob de evolução (>7d):', err);
      }
    },
    { timezone: 'America/Sao_Paulo' }
  );
}

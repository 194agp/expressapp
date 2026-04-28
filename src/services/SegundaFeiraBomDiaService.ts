import type { Db } from 'mongodb';
import frases from '../utils/frasesMotivacionais.json';

interface DataImportante {
  titulo: string;
  tipo: string;
  dia: number;
  mes: number;
  horario?: string;
}

interface Aniversariante {
  nome: string;
  tipo: 'Residente' | 'Colaborador';
  dia: number;
  mes: number;
}

function parseDDMMYYYY(s: string): { dia: number; mes: number } | null {
  if (!s) return null;
  // YYYY-MM-DD
  if (s.includes('-')) {
    const parts = s.split('-');
    const mes = parseInt(parts[1], 10);
    const dia = parseInt(parts[2], 10);
    if (isNaN(dia) || isNaN(mes)) return null;
    return { dia, mes };
  }
  // DD/MM/YYYY
  const [d, m] = s.split('/');
  const dia = parseInt(d, 10);
  const mes = parseInt(m, 10);
  if (isNaN(dia) || isNaN(mes)) return null;
  return { dia, mes };
}

function parseYYYYMMDD(s: string): { dia: number; mes: number } | null {
  const parts = s.split('-');
  if (parts.length < 3) return null;
  const mes = parseInt(parts[1], 10);
  const dia = parseInt(parts[2], 10);
  if (isNaN(dia) || isNaN(mes)) return null;
  return { dia, mes };
}

function dentroProximos15Dias(dia: number, mes: number, hoje: Date): boolean {
  const hojeZerado = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  let alvo = new Date(hojeZerado.getFullYear(), mes - 1, dia);
  if (alvo < hojeZerado) alvo = new Date(hojeZerado.getFullYear() + 1, mes - 1, dia);
  const limite = new Date(hojeZerado);
  limite.setDate(hojeZerado.getDate() + 15);
  return alvo >= hojeZerado && alvo <= limite;
}

function formatDiaMes(dia: number, mes: number): string {
  return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}`;
}

export async function buildSegundaFeiraMensagem(db: Db): Promise<string> {
  const agora = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })
  );

  // --- Datas importantes ---
  const todasDatas = await db.collection('datas_importantes').find({}).toArray();
  const datasProximas: DataImportante[] = [];

  for (const d of todasDatas) {
    const parsed = parseDDMMYYYY(d.data);
    if (!parsed) continue;
    if (!dentroProximos15Dias(parsed.dia, parsed.mes, agora)) continue;
    datasProximas.push({
      titulo: d.titulo,
      tipo: d.tipo,
      dia: parsed.dia,
      mes: parsed.mes,
      horario: d.horario || '',
    });
  }

  datasProximas.sort((a, b) => {
    if (a.mes !== b.mes) return a.mes - b.mes;
    return a.dia - b.dia;
  });

  // --- Aniversariantes ---
  const aniversariantes: Aniversariante[] = [];

  const residentes = await db
    .collection('residentes')
    .find({ is_ativo: 'S', data_nascimento: { $exists: true, $ne: null } })
    .project({ nome: 1, data_nascimento: 1 })
    .toArray();

  for (const r of residentes) {
    const parsed = parseYYYYMMDD(r.data_nascimento);
    if (!parsed) continue;
    if (!dentroProximos15Dias(parsed.dia, parsed.mes, agora)) continue;
    aniversariantes.push({ nome: r.nome, tipo: 'Residente', ...parsed });
  }

  const usuarios = await db
    .collection('usuario')
    .find({ dataNascimento: { $exists: true, $ne: null }, ativo: true })
    .project({ nome: 1, sobrenome: 1, dataNascimento: 1 })
    .toArray();

  for (const u of usuarios) {
    const parsed = parseDDMMYYYY(u.dataNascimento);
    if (!parsed) continue;
    if (!dentroProximos15Dias(parsed.dia, parsed.mes, agora)) continue;
    const nomeCompleto = [u.nome, u.sobrenome].filter(Boolean).join(' ');
    aniversariantes.push({ nome: nomeCompleto, tipo: 'Colaborador', ...parsed });
  }

  aniversariantes.sort((a, b) => {
    if (a.mes !== b.mes) return a.mes - b.mes;
    return a.dia - b.dia;
  });

  // --- Frase motivacional aleatória ---
  const frase = frases[Math.floor(Math.random() * frases.length)];

  // --- Montar mensagem ---
  const linhas: string[] = [
    '🌅 *Bom dia a todos!*',
    '',
    'Que essa semana seja repleta de bênçãos, dedicação e muito cuidado! 💙',
  ];

  if (datasProximas.length > 0) {
    linhas.push('', '━━━━━━━━━━━━━━', '📅 *Datas Importantes — próximos 15 dias:*', '');
    for (const d of datasProximas) {
      const horario = d.horario ? ` às ${d.horario}` : '';
      const tipo = d.tipo ? ` _(${d.tipo})_` : '';
      linhas.push(`• ${formatDiaMes(d.dia, d.mes)} — ${d.titulo}${tipo}${horario}`);
    }
  }

  if (aniversariantes.length > 0) {
    linhas.push('', '━━━━━━━━━━━━━━', '🎂 *Aniversários — próximos 15 dias:*', '');
    for (const a of aniversariantes) {
      linhas.push(`• ${formatDiaMes(a.dia, a.mes)} — ${a.nome} _(${a.tipo})_`);
    }
  }

  linhas.push(
    '',
    '━━━━━━━━━━━━━━',
    `💬 _"${frase.frase}"_`,
    `— ${frase.referencia}`,
  );

  return linhas.join('\n');
}

import type { Db } from 'mongodb';

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined || v === '') return true;
  if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0) return true;
  return false;
}

function primeiroNome(nome: string): string {
  return nome?.split(' ')[0] ?? nome;
}

export async function buildPendenciasAdmMensagem(db: Db): Promise<string> {
  const linhas: string[] = ['📋 *Pendências Administrativas*', ''];

  // --- Residentes sem foto ---
  const resSemFoto = await db
    .collection('residentes')
    .find({
      is_ativo: 'S',
      $or: [
        { foto_base64: { $exists: false } },
        { foto_base64: null },
        { foto_base64: '' },
      ],
    })
    .project({ nome: 1 })
    .sort({ nome: 1 })
    .toArray();

  if (resSemFoto.length > 0) {
    linhas.push(`*Residentes sem foto* (${resSemFoto.length}):`);
    for (const r of resSemFoto) linhas.push(`  • ${r.nome}`);
  } else {
    linhas.push('✅ Todos os residentes têm foto.');
  }

  // --- Funcionários CLT com dados incompletos ---
  const clts = await db
    .collection('funcionarios_clt')
    .find({ status: 'ativo' })
    .toArray();

  if (clts.length === 0) {
    linhas.push('', '✅ Nenhum funcionário CLT ativo cadastrado.');
    return linhas.join('\n');
  }

  // Buscar usuarios para nome + foto
  const userIds = clts.map(c => c.usuarioId?.toString()).filter(Boolean);
  const usuarios = await db
    .collection('usuario')
    .find({ _id: { $in: userIds.map(id => { try { const { ObjectId } = require('mongodb'); return new ObjectId(id); } catch { return id; } }) } })
    .project({ _id: 1, nome: 1, sobrenome: 1, foto_base64: 1 })
    .toArray();

  const usuarioMap = new Map(usuarios.map(u => [u._id.toString(), u]));

  const pendentes: string[] = [];

  for (const c of clts) {
    const usr = usuarioMap.get(c.usuarioId?.toString());
    const nomeCompleto = usr ? [usr.nome, usr.sobrenome].filter(Boolean).join(' ') : `(id: ${c.usuarioId})`;

    const faltando: string[] = [];

    if (isEmpty(c.contrato?.dataAdmissao))  faltando.push('Data admissão');
    if (isEmpty(c.contrato?.salarioBase))   faltando.push('Salário');
    if (isEmpty(c.dadosPessoais?.cpf))      faltando.push('CPF');
    if (isEmpty(c.pisPasep))                faltando.push('PIS/PASEP');
    if (isEmpty(c.ctps))                    faltando.push('CTPS');
    if (isEmpty(c.dadosBancarios))          faltando.push('Dados bancários');
    if (isEmpty(c.endereco))                faltando.push('Endereço');
    if (isEmpty(c.contatoEmergencia))       faltando.push('Contato emergência');
    if (!usr || isEmpty(usr.foto_base64))   faltando.push('Foto');

    if (faltando.length > 0) {
      pendentes.push(`  • ${nomeCompleto}\n    ↳ ${faltando.join(', ')}`);
    }
  }

  linhas.push('');
  if (pendentes.length > 0) {
    linhas.push(`*Funcionários CLT com dados incompletos* (${pendentes.length}):`);
    linhas.push(...pendentes);
  } else {
    linhas.push('✅ Todos os funcionários CLT estão com dados completos.');
  }

  return linhas.join('\n');
}

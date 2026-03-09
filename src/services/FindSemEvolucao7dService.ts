import type { Db } from 'mongodb';

export interface ResidenteSemEvolucao {
  id: string;
  nome: string;
  apelido?: string;
  ultimaEvolucao: Date;
  ultimaEvolucao_fmt: string;
  daysSince: number;
}

export interface AreaSemEvolucao {
  area: string;
  residentes: ResidenteSemEvolucao[];
}

export async function findSemEvolucao7dService(db: Db): Promise<AreaSemEvolucao[]> {
  const pipeline = [
    { $match: { $or: [{ is_ativo: 'S' }, { is_ativo: true }] } },
    { $match: { $or: [{ tipo_contrato: 'Residência Fixa' }, { tipo_contrato: 'Centro Dia' }] } },
    { $addFields: { ridStr: { $toString: '$_id' } } },
    {
      $lookup: {
        from: 'evolucao',
        let: { rid: '$ridStr' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$residente_id', '$$rid'] },
                  { $eq: ['$categoria', 'Evolução'] },
                ],
              },
            },
          },
          {
            $addFields: {
              dataEvolucaoDate: {
                $cond: [
                  { $eq: [{ $type: '$dataEvolucao' }, 'date'] },
                  '$dataEvolucao',
                  { $convert: { input: '$dataEvolucao', to: 'date', onError: null, onNull: null } },
                ],
              },
            },
          },
          { $group: { _id: '$area', ultimaEvolucao: { $max: '$dataEvolucaoDate' } } },
        ],
        as: 'evols',
      },
    },
    { $unwind: { path: '$evols', preserveNullAndEmptyArrays: false } },
    {
      $addFields: {
        corte7d: { $dateSubtract: { startDate: '$$NOW', unit: 'day', amount: 7 } },
        ultimaEvolucao: '$evols.ultimaEvolucao',
        area: '$evols._id',
      },
    },
    { $match: { $expr: { $lt: ['$ultimaEvolucao', '$corte7d'] } } },
    {
      $match: {
        area: {
          $nin: [
            'Cuidador de Idosos',
            'Téc. de Enfermagem',
            'Téc de Enfermagem',
            'Responsável Técnico(a)',
          ],
        },
      },
    },
    {
      $addFields: {
        daysSince: { $dateDiff: { startDate: '$ultimaEvolucao', endDate: '$$NOW', unit: 'day' } },
        ultimaEvolucao_fmt: {
          $dateToString: { date: '$ultimaEvolucao', format: '%Y-%m-%d %H:%M', timezone: 'America/Sao_Paulo' },
        },
        sortKey: { $toUpper: '$nome' },
      },
    },
    {
      $project: {
        _id: 0,
        area: 1,
        id: '$ridStr',
        nome: '$nome',
        apelido: '$apelido',
        ultimaEvolucao: 1,
        ultimaEvolucao_fmt: 1,
        daysSince: 1,
        sortKey: 1,
      },
    },
    { $sort: { area: 1, sortKey: 1 } },
    {
      $group: {
        _id: '$area',
        residentes: {
          $push: { id: '$id', nome: '$nome', apelido: '$apelido', ultimaEvolucao: '$ultimaEvolucao', ultimaEvolucao_fmt: '$ultimaEvolucao_fmt', daysSince: '$daysSince' },
        },
      },
    },
    { $project: { _id: 0, area: '$_id', residentes: 1 } },
    { $sort: { area: 1 } },
  ];

  return db.collection('residentes').aggregate<AreaSemEvolucao>(pipeline).toArray();
}

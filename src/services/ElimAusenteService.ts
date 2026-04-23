import type { Db, ObjectId } from 'mongodb';

export interface ResidenteAusenteIntestinal {
  _id: ObjectId;
  nome: string;
  consecutiveCount: number;
  ultimasAnotacoes: Date[];
}

export async function findElimAusenteService(db: Db): Promise<ResidenteAusenteIntestinal[]> {
  const pipeline = [
    { $match: { is_ativo: 'S' } },
    {
      $lookup: {
        from: 'anotacoesenfermagem',
        let: { rid_str: { $toString: '$_id' } },
        pipeline: [
          { $match: { $expr: { $eq: ['$residente_id', '$$rid_str'] } } },
          { $sort: { createdAt: -1 } },
          { $limit: 20 },
        ],
        as: 'ultimasAnotacoes',
      },
    },
    {
      $addFields: {
        consecutiveCount: {
          $let: {
            vars: {
              result: {
                $reduce: {
                  input: '$ultimasAnotacoes.eliminacoesintestinais',
                  initialValue: { count: 0, broken: false },
                  in: {
                    count: {
                      $cond: [
                        '$$value.broken',
                        '$$value.count',
                        {
                          $cond: [
                            { $eq: ['$$this', 'Ausente'] },
                            { $add: ['$$value.count', 1] },
                            '$$value.count',
                          ],
                        },
                      ],
                    },
                    broken: {
                      $cond: [
                        '$$value.broken',
                        true,
                        { $ne: ['$$this', 'Ausente'] },
                      ],
                    },
                  },
                },
              },
            },
            in: '$$result.count',
          },
        },
      },
    },
    { $match: { consecutiveCount: { $gte: 4 } } },
    {
      $project: {
        _id: 1,
        nome: 1,
        consecutiveCount: 1,
        ultimasAnotacoes: {
          $slice: [
            { $map: { input: '$ultimasAnotacoes', as: 'a', in: '$$a.createdAt' } },
            '$consecutiveCount',
          ],
        },
      },
    },
  ];

  return db.collection('residentes').aggregate<ResidenteAusenteIntestinal>(pipeline).toArray();
}

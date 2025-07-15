
/**
 * @param {import('mongodb').Db} db
 * @returns {Promise<Array>}
 */
async function findElimAusenteService(db) {
  const pipeline = [
    { $match: { is_ativo: "S" } },
    {
      $lookup: {
        from: "anotacoesenfermagem",
        let: { rid_str: { $toString: "$_id" } },
        pipeline: [
          { $match: { $expr: { $eq: ["$residente_id", "$$rid_str"] } } },
          { $sort: { createdAt: -1 } },
          { $limit: 4 }
        ],
        as: "ultimasAnotacoes"
      }
    },
    {
      $addFields: {
        todosAusentesIntestinais: {
          $cond: [
            {
              $and: [
                { $eq: [{ $size: "$ultimasAnotacoes" }, 4] },
                {
                  $reduce: {
                    input: "$ultimasAnotacoes.eliminacoesintestinais",
                    initialValue: true,
                    in: {
                      $and: [
                        "$$value",
                        { $eq: ["$$this", "Ausente"] }
                      ]
                    }
                  }
                }
              ]
            },
            true,
            false
          ]
        }
      }
    },
    { $match: { todosAusentesIntestinais: true } },
    {
      $project: {
        _id: 1,
        nome: 1,
        todosAusentesIntestinais: 1,
        ultimasAnotacoes: {
          $map: {
            input: "$ultimasAnotacoes",
            as: "a",
            in: "$$a.createdAt"
          }
        }
      }
    }
  ];

  return db
    .collection('residentes')
    .aggregate(pipeline)
    .toArray();
}

module.exports = {
  findElimAusenteService,
};

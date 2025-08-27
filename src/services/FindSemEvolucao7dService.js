/**
 * @param {import('mongodb').Db} db
 * @returns {Promise<Array<{ area: string, residentes: Array<{id:string, nome:string, ultimaEvolucao: Date, ultimaEvolucao_fmt: string, daysSince: number}> }>>}
 */
async function findSemEvolucao7dService(db) {
    const pipeline = [
        // 1) Filtra apenas residentes ativos ("S" ou booleano true)
        { "$match": { "$or": [{ "is_ativo": "S" }, { "is_ativo": true }] } },

        // 2) Converte o _id do residente (ObjectId) em string
        //    porque em "evolucao" o campo residente_id está salvo como string
        { "$addFields": { "ridStr": { "$toString": "$_id" } } },

        // 3) Faz lookup na collection "evolucao" para buscar evoluções desse residente
        {
            "$lookup": {
                "from": "evolucao",
                "let": { "rid": "$ridStr" },
                "pipeline": [
                    // 3.1) Pega apenas evoluções do residente com categoria "Evolução"
                    {
                        "$match": {
                            "$expr": {
                                "$and": [
                                    { "$eq": ["$residente_id", "$$rid"] },
                                    { "$eq": ["$categoria", "Evolução"] }
                                ]
                            }
                        }
                    },
                    // 3.2) Garante que a data esteja em formato Date (conversão segura)
                    {
                        "$addFields": {
                            "dataEvolucaoDate": {
                                "$cond": [
                                    { "$eq": [{ "$type": "$dataEvolucao" }, "date"] },
                                    "$dataEvolucao",
                                    { "$convert": { "input": "$dataEvolucao", "to": "date", "onError": null, "onNull": null } }
                                ]
                            }
                        }
                    },
                    // 3.3) Agrupa por área para pegar a última evolução (máxima data) de cada área
                    { "$group": { "_id": "$area", "ultimaEvolucao": { "$max": "$dataEvolucaoDate" } } }
                ],
                "as": "evols"
            }
        },

        // 4) "Explode" o array de áreas em linhas separadas (um doc por residente+área)
        { "$unwind": { "path": "$evols", "preserveNullAndEmptyArrays": false } },

        // 5) Cria campos auxiliares:
        //    - corte7d = data limite (hoje - 7 dias)
        //    - ultimaEvolucao = data da última evolução encontrada
        //    - area = nome da área
        {
            "$addFields": {
                "corte7d": { "$dateSubtract": { "startDate": "$$NOW", "unit": "day", "amount": 7 } },
                "ultimaEvolucao": "$evols.ultimaEvolucao",
                "area": "$evols._id"
            }
        },

        // 6) Mantém apenas residentes cuja última evolução é ANTES do corte de 7 dias
        { "$match": { "$expr": { "$lt": ["$ultimaEvolucao", "$corte7d"] } } },

        // 7) Remove áreas que não interessam no alerta
        {
            "$match": {
                "area": {
                    "$nin": [
                        "Cuidador de Idosos",
                        "Téc. de Enfermagem",
                        "Téc de Enfermagem",
                        "Responsável Técnico(a)"
                    ]
                }
            }
        },

        // 8) Calcula:
        //    - daysSince: diferença em dias entre a última evolução e hoje
        //    - ultimaEvolucao_fmt: data formatada como "yyyy-MM-dd HH:mm" (timezone São Paulo)
        //    - sortKey: versão do nome em maiúsculas para ordenar alfabeticamente
        {
            "$addFields": {
                "daysSince": { "$dateDiff": { "startDate": "$ultimaEvolucao", "endDate": "$$NOW", "unit": "day" } },
                "ultimaEvolucao_fmt": {
                    "$dateToString": { "date": "$ultimaEvolucao", "format": "%Y-%m-%d %H:%M", "timezone": "America/Sao_Paulo" }
                },
                "sortKey": { "$toUpper": "$nome" }
            }
        },

        // 9) Mantém apenas os campos necessários (descarta intermediários)
        {
            "$project": {
                "_id": 0,
                "area": 1,
                "id": "$ridStr",
                "nome": "$nome",
                "ultimaEvolucao": 1,
                "ultimaEvolucao_fmt": 1,
                "daysSince": 1,
                "sortKey": 1
            }
        },

        // 10) Ordena primeiro por área e depois por nome (alfabético)
        { "$sort": { "area": 1, "sortKey": 1 } },

        // 11) Agrupa novamente por área, juntando os residentes em um array
        {
            "$group": {
                "_id": "$area",
                "residentes": {
                    "$push": {
                        "id": "$id",
                        "nome": "$nome",
                        "ultimaEvolucao": "$ultimaEvolucao",
                        "ultimaEvolucao_fmt": "$ultimaEvolucao_fmt",
                        "daysSince": "$daysSince"
                    }
                }
            }
        },

        // 12) Ajusta saída final (remove _id e renomeia área)
        { "$project": { "_id": 0, "area": "$_id", "residentes": 1 } },

        // 13) Ordena a lista final das áreas alfabeticamente
        { "$sort": { "area": 1 } }
    ]

    return db.collection("residentes").aggregate(pipeline).toArray();
}

module.exports = {
    findSemEvolucao7dService,
};

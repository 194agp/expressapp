// src/controller/mongo.controller.js
const { getDb } = require("../config/mongoDB");
const { ObjectId } = require("mongodb");

async function getUserName(_id) {
    if (!_id) throw new Error("_id obrigatório");

    let objectId;
    try {
        objectId = new ObjectId(_id); // converte string -> ObjectId
    } catch (e) {
        throw new Error("Formato de _id inválido");
    }

    const db = getDb();
    const usuario = await db.collection("usuario").findOne(
        { _id: objectId },
        { projection: { nome: 1 } }
    );

    if (!usuario) {
        throw new Error("Usuário não encontrado");
    }

    return usuario.nome;
}

module.exports = {
    getUserName,
};

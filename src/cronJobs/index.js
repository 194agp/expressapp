require('dotenv').config();

const cron = require('node-cron');
const { sendMessage, sendSurvey } = require('../api/Whatsapp.js');

//  # ┌────────────── second (optional) - 0-59
//  # │ ┌──────────── minute - 0-59
//  # │ │ ┌────────── hour - 0-23
//  # │ │ │ ┌──────── day of month - 1-31
//  # │ │ │ │ ┌────── month - 1-12 (or names)
//  # │ │ │ │ │ ┌──── day of week - 0-7 (or names, 0 or 7 are sunday)
//  # │ │ │ │ │ │
//  # │ │ │ │ │ │
//  # * * * * * *


// cron.schedule('*/1 * * * *', () => {
//     console.log('rodei')
// });

// cron.schedule('*/2 * * * *', () => {
//     console.log('Executando tarefa a cada 2 minutos');
//     async function cronJobs() {
//         await sendMessage(process.env.POKERGROUP, 'Mensagem de cron jobs, hora: ' + new Date())
//     };

//     cronJobs();
// });

// TODA QUINTA FEIRA ÀS 08H DA MANHÃ
cron.schedule('0 10 * * 4', () => {
    async function cronJobs() {
        const result = await sendSurvey(process.env.POKERGROUP, 'Hoje tem poker?', ['Sim', 'Não'])
    };

    cronJobs();
});

// TODA QUINTA FEIRA ÀS 08H DA MANHÃ
cron.schedule('0 13 * * 4', () => {
    async function cronJobs() {
        const result = await sendSurvey(process.env.POKERGROUP, 'Hoje tem poker??', ['Sim', 'Não'])
    };

    cronJobs();
});

module.exports = {}; 

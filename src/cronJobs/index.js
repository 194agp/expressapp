require('dotenv').config();

const cron = require('node-cron');
const { sendMessage, sendSurvey } = require('../api/Whatsapp.js');


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
cron.schedule('40 9 * * 4', () => {
    async function cronJobs() {
        const result = await sendSurvey(process.env.POKERGROUP, 'Hoje 9 tem poker?', ['Sim', 'Não'])
    };

    cronJobs();
});

// TODA QUINTA FEIRA ÀS 08H DA MANHÃ
cron.schedule('40 6 * * 4', () => {
    async function cronJobs() {
        const result = await sendSurvey(process.env.POKERGROUP, 'Hoje 6 tem poker?', ['Sim', 'Não'])
    };

    cronJobs();
});

// TODA QUINTA FEIRA ÀS 08H DA MANHÃ
cron.schedule('40 12 * * 4', () => {
    async function cronJobs() {
        const result = await sendSurvey(process.env.POKERGROUP, 'Hoje 12 tem poker?', ['Sim', 'Não'])
    };

    cronJobs();
});

module.exports = {}; 

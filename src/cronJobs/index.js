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
cron.schedule('0 8 * * 4', () => {
    async function cronJobs() {
        const result = await sendSurvey(process.env.POKERGROUP, 'Hoje tem poker?', ['Sim', 'Não'])
    };

    cronJobs();
});

module.exports = {}; 

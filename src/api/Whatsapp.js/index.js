require('dotenv').config();

const server = process.env.APIWA_SERVER
const key = process.env.APIWA_KEY


async function sendMessage(to, text) {
    const url = `${server}/${key}/message/text`
    const body = { to, text }
    const method = 'POST'
    const headers = { 'Content-Type': 'application/json', }
    const options = { method, headers, body: JSON.stringify(body), }


    const sendMessage = await fetch(url, options)
    const result = await sendMessage.json()
    return result
}

async function sendImage(to, text, caption) {
    const url = `${server}/${key}/message/base64/image`
    const body = { to, base64: text, caption }
    const method = 'POST'
    const headers = { 'Content-Type': 'application/json', }
    const options = { method, headers, body: JSON.stringify(body), }


    const sendMessage = await fetch(url, options)
    const result = await sendMessage.json()
    return result
}

async function sendSurvey(to, name, opts) {
    const url = `${server}/${key}/message/survey`
    const body = { to, name, options: opts }
    const method = 'POST'
    const headers = { 'Content-Type': 'application/json', }
    const options = { method, headers, body: JSON.stringify(body), }


    const sendMessage = await fetch(url, options)
    const result = await sendMessage.json()
    return result
}

module.exports = {
    sendMessage,
    sendImage,
    sendSurvey,
}

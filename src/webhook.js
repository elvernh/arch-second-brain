const express = require('express');

const app = express();
app.use(express.json());

// In-memory store: chatId -> { name, messages[] }
const messageStore = new Map();
const MAX_PER_CHAT = 50;

function storeMessage(chatId, chatName, sender, text, timestamp) {
    if (!messageStore.has(chatId)) {
        messageStore.set(chatId, { name: chatName, messages: [] });
    }
    const chat = messageStore.get(chatId);
    chat.messages.push({ sender, text, timestamp });
    if (chat.messages.length > MAX_PER_CHAT) chat.messages.shift();
}

function getStoredChats() {
    const chats = [];
    for (const [, chat] of messageStore.entries()) {
        chats.push(chat);
    }
    return chats
        .filter(c => c.messages.length > 0)
        .sort((a, b) => {
            const lastA = a.messages.at(-1)?.timestamp || 0;
            const lastB = b.messages.at(-1)?.timestamp || 0;
            return lastB - lastA;
        });
}

app.post('/webhook', (req, res) => {
    const body = req.body;
    if (body.typeWebhook !== 'incomingMessageReceived') return res.sendStatus(200);

    const { senderData, messageData } = body;
    if (!senderData || !messageData) return res.sendStatus(200);

    const chatId = senderData.chatId;
    const chatName = senderData.chatName || senderData.chatId;
    const sender = senderData.senderName || senderData.sender || 'unknown';
    const text = messageData.textMessageData?.textMessage
        || messageData.extendedTextMessageData?.text
        || messageData.imageMessageData?.caption
        || '[non-text message]';
    const timestamp = body.timestamp || Math.floor(Date.now() / 1000);

    storeMessage(chatId, chatName, sender, text, timestamp);
    res.sendStatus(200);
});

app.get('/health', (req, res) => res.json({ ok: true }));

function startWebhookServer() {
    const port = process.env.PORT || 3000;
    app.listen(port, () => console.log(`Webhook server listening on port ${port}`));
}

module.exports = { startWebhookServer, getStoredChats };

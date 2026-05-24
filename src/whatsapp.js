const axios = require('axios');

function _base() {
    const instanceId = process.env.WHATSAPP_INSTANCE_ID;
    const token = process.env.WHATSAPP_TOKEN;
    if (!instanceId || !token) throw new Error('WHATSAPP_INSTANCE_ID and WHATSAPP_TOKEN must be set in .env');
    return { base: `https://api.green-api.com/waInstance${instanceId}`, token };
}

function greenApiError(err) {
    // Prevent the raw URL (which contains the token) from leaking into error messages
    const code = err.code || (err.response ? `HTTP ${err.response.status}` : 'network error');
    return new Error(`GREEN-API request failed (${code})`);
}

async function getChats() {
    const { base, token } = _base();
    try {
        const res = await axios.get(`${base}/getChats/${token}`, { timeout: 10000 });
        return res.data.map(c => ({
            id: c.id,
            name: c.name || c.id,
            unread: c.unreadCount || 0,
        }));
    } catch (err) { throw greenApiError(err); }
}

async function getRecentMessages(chatId, count = 20) {
    const { base, token } = _base();
    try {
        const res = await axios.post(`${base}/getChatHistory/${token}`, { chatId, count }, { timeout: 15000 });
        return res.data
            .filter(m => m.type === 'incoming' || m.type === 'outgoing')
            .map(m => ({
                sender: m.senderName || m.senderId || 'unknown',
                text: m.textMessage || m.caption || '[non-text]',
                timestamp: m.timestamp || 0,
                type: m.type,
            }));
    } catch (err) { throw greenApiError(err); }
}

async function getInstanceState() {
    const { base, token } = _base();
    try {
        const res = await axios.get(`${base}/getStateInstance/${token}`, { timeout: 5000 });
        return res.data.stateInstance;
    } catch (err) { throw greenApiError(err); }
}

async function getUrgentMessages() {
    const state = await getInstanceState();
    if (state !== 'authorized') {
        throw new Error(`WhatsApp instance is not connected (state: ${state}). Please re-scan the QR code in your GREEN-API dashboard.`);
    }

    const chats = await getChats();
    // Sort by unread count descending, cap at 5 chats to keep latency low
    const unreadChats = chats
        .filter(c => c.unread > 0)
        .sort((a, b) => b.unread - a.unread)
        .slice(0, 5);

    const results = await Promise.all(
        unreadChats.map(async chat => {
            try {
                const messages = await getRecentMessages(chat.id, 10);
                return { chat: chat.name, unread: chat.unread, messages };
            } catch {
                return { chat: chat.name, unread: chat.unread, messages: [] };
            }
        })
    );
    return { unreadChats, results };
}

module.exports = { getChats, getRecentMessages, getUrgentMessages, getInstanceState };

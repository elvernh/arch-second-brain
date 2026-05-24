const axios = require('axios');

function extractVideoId(url) {
    const match = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    return match ? match[1] : null;
}

async function getVideoTitle(url) {
    try {
        const res = await axios.get(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
        return res.data.title;
    } catch {
        return 'YouTube Video';
    }
}

async function getTranscript(url) {
    const { YoutubeTranscript } = require('youtube-transcript');
    const chunks = await YoutubeTranscript.fetchTranscript(url);
    return chunks.map(c => c.text).join(' ');
}

module.exports = { extractVideoId, getVideoTitle, getTranscript };

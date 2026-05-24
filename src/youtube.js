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
    const videoId = extractVideoId(url);
    if (!videoId) throw new Error('Invalid YouTube URL');

    // Use YouTube InnerTube API — avoids HTML scraping and rate limits
    const playerRes = await axios.post(
        'https://www.youtube.com/youtubei/v1/player',
        {
            videoId,
            context: {
                client: {
                    clientName: 'WEB',
                    clientVersion: '2.20240101',
                    hl: 'en',
                    gl: 'US'
                }
            }
        },
        {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 15000
        }
    );

    const tracks = playerRes.data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!tracks || tracks.length === 0) throw new Error('Transcript is disabled on this video');

    // Prefer auto-generated English, then Indonesian, then first available
    const track = tracks.find(t => t.languageCode === 'en' && t.kind === 'asr')
        || tracks.find(t => t.kind === 'asr')
        || tracks.find(t => t.languageCode === 'id')
        || tracks[0];

    const captionRes = await axios.get(`${track.baseUrl}&fmt=json3`, { timeout: 10000 });
    const events = captionRes.data?.events || [];

    const text = events
        .filter(e => e.segs)
        .flatMap(e => e.segs)
        .map(s => s.utf8 || '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (!text) throw new Error('Transcript is empty for this video');
    return text;
}

module.exports = { extractVideoId, getVideoTitle, getTranscript };

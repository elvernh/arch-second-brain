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

    // Fetch video page to find caption tracks
    const pageRes = await axios.get(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept-Language': 'en-US,en;q=0.9'
        },
        timeout: 15000
    });

    const html = pageRes.data;
    const parts = html.split('"captions":');
    if (parts.length < 2) throw new Error('Transcript is disabled on this video');

    let captions;
    try {
        const raw = parts[1].split(',"videoDetails')[0];
        captions = JSON.parse(raw).playerCaptionsTracklistRenderer;
    } catch {
        throw new Error('Transcript is disabled on this video');
    }

    const tracks = captions?.captionTracks;
    if (!tracks || tracks.length === 0) throw new Error('No transcript available for this video');

    // Prefer auto-generated English, then any auto-generated, then first available
    const track = tracks.find(t => t.languageCode === 'en' && t.kind === 'asr')
        || tracks.find(t => t.kind === 'asr')
        || tracks.find(t => t.languageCode === 'id')
        || tracks[0];

    // Fetch as JSON3 for easy parsing
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

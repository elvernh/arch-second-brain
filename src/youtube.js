const axios = require('axios');
const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');


const execFileAsync = promisify(execFile);

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

    const scriptPath = path.join(__dirname, 'fetch_content.py');
    const python = fs.existsSync('/opt/venv/bin/python3') ? '/opt/venv/bin/python3' : 'python3';

    const env = { ...process.env };
    if (process.env.WEBSHARE_USERNAME && process.env.WEBSHARE_PASSWORD) {
        const proxyUrl = `http://${process.env.WEBSHARE_USERNAME}:${process.env.WEBSHARE_PASSWORD}@p.webshare.io:80`;
        env.HTTP_PROXY = proxyUrl;
        env.HTTPS_PROXY = proxyUrl;
    }

    const { stdout } = await execFileAsync(python, [scriptPath, url], { timeout: 30000, env });
    return stdout;
}

module.exports = { extractVideoId, getVideoTitle, getTranscript };

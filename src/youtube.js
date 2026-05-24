const axios = require('axios');
const { execFile } = require('child_process');
const { promisify } = require('util');

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
    const scriptPath = require('path').join(__dirname, 'fetch_content.py');
    const { stdout } = await execFileAsync('python3', [scriptPath, url]);
    return stdout;
}

module.exports = { extractVideoId, getVideoTitle, getTranscript };

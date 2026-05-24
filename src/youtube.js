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
    const fs = require('fs');
    const scriptPath = require('path').join(__dirname, 'fetch_content.py');
    // Use Railway venv python if available, fall back to system python3
    const python = fs.existsSync('/opt/venv/bin/python3') ? '/opt/venv/bin/python3' : 'python3';
    const { stdout } = await execFileAsync(python, [scriptPath, url], { timeout: 30000 });
    return stdout;
}

module.exports = { extractVideoId, getVideoTitle, getTranscript };

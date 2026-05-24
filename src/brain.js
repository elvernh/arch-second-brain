const fs = require('fs');
const path = require('path');

const VAULT = path.join(process.env.HOME, 'Second-Brain');

function readVaultFile(relPath) {
    try {
        return fs.readFileSync(path.join(VAULT, relPath), 'utf8');
    } catch {
        return '';
    }
}

function getContext() {
    const today = todayWIB();
    const yesterday = new Date(Date.now() - 864e5).toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
    return [
        '# SOUL\n' + readVaultFile('SOUL.md'),
        '# USER\n' + readVaultFile('USER.md'),
        '# MEMORY\n' + readVaultFile('MEMORY.md'),
        '# HABITS\n' + readVaultFile('HABITS.md'),
        '# TODAY LOG\n' + readVaultFile(`daily/${today}.md`),
        '# YESTERDAY LOG\n' + readVaultFile(`daily/${yesterday}.md`),
    ].filter(s => !s.endsWith('\n')).join('\n\n---\n\n');
}

function appendToVaultFile(relPath, content) {
    const full = path.join(VAULT, relPath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.appendFileSync(full, content + '\n');
}

function todayWIB() {
    return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
}

function nowWIB() {
    return new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
}

module.exports = { getContext, appendToVaultFile, readVaultFile, todayWIB, nowWIB, VAULT };

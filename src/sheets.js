const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

// Sheet layout — cols C–G (3–7), per-section row ranges
const SECTIONS = {
    Pemasukan:   { rowStart: 5,  rowEnd: 14 },
    Tabungan:    { rowStart: 20, rowEnd: 24 },
    Pengeluaran: { rowStart: 30, rowEnd: 49 },
};

const PENGELUARAN_CATEGORIES = ['Makanan', 'Transport', 'Kesehatan', 'Hiburan', 'Belanja', 'Tagihan', 'Investasi', 'Lainnya'];

function getAuth() {
    // On Fly.io, credentials are injected as a JSON string via GOOGLE_SERVICE_ACCOUNT_JSON.
    // Locally, fall back to the key file path.
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
        const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
        return new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    }
    const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_PATH
        || path.join(process.env.HOME, '.config/second-brain/google_service_account.json');
    return new google.auth.GoogleAuth({ keyFile, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
}

function monthSheetName() {
    return new Date().toLocaleDateString('en-US', {
        month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta'
    }); // e.g. "May 2026"
}

function todayID() {
    return new Date().toLocaleDateString('id-ID', {
        day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Jakarta'
    }); // e.g. "23/05/2026"
}

/**
 * Log a transaction to the current month's sheet.
 * @param {object} opts
 * @param {'Pemasukan'|'Pengeluaran'|'Tabungan'} opts.kategori
 * @param {string} opts.nama        item name
 * @param {string} opts.deskripsi   short description
 * @param {number|string} opts.jumlah  amount (will be parsed to a number)
 * @param {string} [opts.subKategori] expense sub-category (Pengeluaran only)
 * @param {string} [opts.tanggal]   DD/MM/YYYY date, defaults to today WIB
 */
async function logTransaction({ kategori, nama, deskripsi, jumlah, subKategori, tanggal }) {
    const section = SECTIONS[kategori];
    if (!section) throw new Error(`Unknown kategori "${kategori}". Use: Pemasukan, Pengeluaran, or Tabungan.`);

    const auth = getAuth();
    const sheetsApi = google.sheets({ version: 'v4', auth });
    const sheetName = monthSheetName();

    // Find first empty row (col C = nama) in the section
    const readRange = `${sheetName}!C${section.rowStart}:C${section.rowEnd}`;
    const readResp = await sheetsApi.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: readRange });
    const rows = readResp.data.values || [];

    // Find first row where col C is empty
    let targetIdx = rows.findIndex(r => !r[0] || !r[0].trim());
    if (targetIdx < 0) targetIdx = rows.length; // append after existing data
    if (targetIdx >= section.rowEnd - section.rowStart + 1) {
        throw new Error(`${kategori} section is full (max ${section.rowEnd - section.rowStart + 1} rows).`);
    }
    const targetRow = section.rowStart + targetIdx;

    const amount = parseFloat(String(jumlah).replace(/[^0-9.]/g, '')) || 0;
    const dateStr = tanggal || todayID();

    // Normalize sub-category casing for Pengeluaran
    let cat = '';
    if (kategori === 'Pengeluaran' && subKategori) {
        cat = PENGELUARAN_CATEGORIES.find(c => c.toLowerCase() === subKategori.toLowerCase()) || subKategori;
    }

    const values = [[nama, deskripsi, dateStr, cat, amount]];
    await sheetsApi.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!C${targetRow}:G${targetRow}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values },
    });

    return { ok: true, sheet: sheetName, row: targetRow, kategori, nama, jumlah: amount };
}

/**
 * Set the monthly budget in cell J7 of the current month's sheet.
 */
async function setBudget(amount) {
    const auth = getAuth();
    const sheetsApi = google.sheets({ version: 'v4', auth });
    const sheetName = monthSheetName();

    await sheetsApi.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!J7`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[amount]] },
    });

    return { ok: true, sheet: sheetName, budget: amount };
}

/**
 * Read the monthly summary cells (income, expenses, savings, budget, sisa).
 */
async function getFinanceSummary() {
    const auth = getAuth();
    const sheetsApi = google.sheets({ version: 'v4', auth });
    const sheetName = monthSheetName();

    const summaryRange = `${sheetName}!J4:J9`;
    const resp = await sheetsApi.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: summaryRange });
    const vals = resp.data.values || [];
    const [income, savings, expenses, budget, sisa, net] = vals.map(r => r[0] || 'IDR0');

    return { month: sheetName, income, savings, expenses, budget, sisa, net };
}

module.exports = { logTransaction, getFinanceSummary, monthSheetName };

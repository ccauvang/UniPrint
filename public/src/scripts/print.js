const API = '/api';
const token = localStorage.getItem('token');
const fileId = new URLSearchParams(location.search).get('file');

const MIN_COPIES = 1;
const MAX_COPIES = 100;
const QUOTE_DELAY = 250;

const $ = (id) => document.getElementById(id);
const form = $('printForm');
const fileNameEl = $('fileName');
const fileMetaEl = $('fileMeta');
const copiesEl = $('copies');
const minusBtn = $('minusBtn');
const plusBtn = $('plusBtn');
const noteEl = $('note');
const msgEl = $('msg');
const totalEl = $('total');
const addBtn = $('addBtn');

const state = { pageCount: 0, copies: 1, ready: false, busy: false };
let quoteSeq = 0;
let quoteTimer;

const money = (n) => Number(n).toLocaleString('vi-VN') + ' VND';

const formatSize = (b) => (b >= 1048576
    ? (b / 1048576).toFixed(1) + ' MB'
    : Math.max(1, Math.round(b / 1024)) + ' KB');

// server key name for the price is not confirmed - first number found wins
const pickTotal = (d) => [d.totalPrice, d.total, d.price].find((v) => typeof v === 'number');

function toLogin() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    location.replace('/login.html');
}

async function api(path, method = 'GET', body) {
    const res = await fetch(API + path, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: body ? JSON.stringify(body) : undefined
    });
    // expired token - drop the session so login page does not bounce back here
    if (res.status === 401) {
        toLogin();
        throw new Error('Session expired');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
}

function showMsg(text, kind) {
    msgEl.textContent = text;
    msgEl.className = 'msg ' + (kind || '');
    msgEl.hidden = !text;
}

function syncBtn() {
    addBtn.disabled = !state.ready || state.busy;
}

// one place that maps ui values to server field names - fix here if the print API names differ
function specs() {
    const f = form.elements;
    return {
        paperSize: f.paperSize.value,
        colorMode: f.colorMode.value,
        printSide: f.printSide.value,
        binding: f.binding.value,
        copies: state.copies
    };
}

async function refreshQuote() {
    const seq = ++quoteSeq;
    state.ready = false;
    syncBtn();
    totalEl.textContent = '...';
    try {
        const data = await api('/print/quote', 'POST', { pageCount: state.pageCount, ...specs() });
        // slow reply for old options must not overwrite the newer price
        if (seq !== quoteSeq) return;
        const total = pickTotal(data);
        if (total === undefined) throw new Error('No price from server');
        totalEl.textContent = money(total);
        state.ready = true;
    } catch (err) {
        if (seq !== quoteSeq) return;
        totalEl.textContent = '-';
        showMsg(err.message, 'err');
    }
    syncBtn();
}

function scheduleQuote() {
    // bump seq now so an in-flight quote for old options cannot enable the button during the debounce
    quoteSeq++;
    state.ready = false;
    syncBtn();
    totalEl.textContent = '...';
    showMsg('');
    clearTimeout(quoteTimer);
    quoteTimer = setTimeout(refreshQuote, QUOTE_DELAY);
}

function setCopies(n) {
    state.copies = Math.min(MAX_COPIES, Math.max(MIN_COPIES, n));
    copiesEl.textContent = state.copies;
    minusBtn.disabled = state.copies <= MIN_COPIES;
    plusBtn.disabled = state.copies >= MAX_COPIES;
}

// files route has no get-by-id, so pick from the list
async function loadFile() {
    const files = await api('/files');
    const f = files.find((x) => x._id === fileId);
    if (!f) throw new Error('File not found. Upload it again.');
    state.pageCount = f.pageCount;
    fileNameEl.textContent = f.fileName;
    fileMetaEl.textContent = `${f.pageCount} page${f.pageCount === 1 ? '' : 's'} - ${formatSize(f.fileSize)}`;
}

form.addEventListener('change', (e) => {
    if (e.target.type === 'radio') scheduleQuote();
});

minusBtn.addEventListener('click', () => { setCopies(state.copies - 1); scheduleQuote(); });
plusBtn.addEventListener('click', () => { setCopies(state.copies + 1); scheduleQuote(); });

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (addBtn.disabled) return;
    state.busy = true;
    syncBtn();
    // blank note dropped, same as auth.js clean() - no empty strings in mongo
    const note = noteEl.value.trim();
    try {
        await api('/cart/print-items', 'POST', { fileId, ...specs(), ...(note ? { note } : {}) });
        const old = new URLSearchParams(location.search).get('replace');
        if (old) {
            await api('/cart/items/' + old, 'DELETE');
        }
        showMsg('Added to cart.', 'ok');
        location.href = '/cart.html';
        return;
    } catch (err) {
        showMsg(err.message, 'err');
    }
    state.busy = false;
    syncBtn();
});

async function init() {
    try {
        await loadFile();
    } catch (err) {
        fileNameEl.textContent = 'File unavailable';
        totalEl.textContent = '-';
        showMsg(err.message, 'err');
        return;
    }
    setCopies(1);
    refreshQuote();
}

if (!token) toLogin();
else if (!fileId) location.replace('/#print');
else init();

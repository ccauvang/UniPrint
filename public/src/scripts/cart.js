const API = '/api';
const token = localStorage.getItem('token');
// same cap as routes/cart.js MAX_QTY - server is the real gate, this only greys the + button
const MAX_QTY = 200;

const $ = (id) => document.getElementById(id);
const list = $('items');
const msgEl = $('msg');
const checkoutBtn = $('checkoutBtn');

// static markup only, no user data goes through innerHTML
const TRASH = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>';
const FILE = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/></svg>';

let items = [];
let busy = false;

const money = (n) => Number(n).toLocaleString('vi-VN') + ' VND';
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function el(tag, text, cls) {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    if (cls) n.className = cls;
    return n;
}

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

// every cart route returns the whole cart, so one helper covers qty change and remove
async function run(call) {
    if (busy) return;
    busy = true;
    showMsg('');
    try {
        items = (await call()).items || [];
        render();
    } catch (err) {
        showMsg(err.message, 'err');
    }
    busy = false;
}

const change = (it, quantity) => run(() => api('/cart/items/' + it._id, 'PATCH', { quantity }));

function remove(it) {
    const label = it.kind === 'print' ? it.fileName : it.name;
    if (!confirm('Remove ' + label + '?')) return;
    run(() => api('/cart/items/' + it._id, 'DELETE'));
}

// specs shape is owned by the pricing service, so list its plain values instead of naming keys
function specText(specs) {
    return Object.entries(specs || {})
        .filter(([k, v]) => k !== 'note' && k !== 'copies' && ['string', 'number'].includes(typeof v))
        .map(([, v]) => v)
        .join(' / ');
}

function meta(it) {
    if (it.kind !== 'print') return it.sku || '';
    return [plural(it.pageCount, 'page'), specText(it.specs), `${it.quantity} ${it.quantity === 1 ? 'copy' : 'copies'}`]
        .filter(Boolean)
        .join(' - ');
}

function stepper(it) {
    const box = el('div', undefined, 'stepper');
    const minus = el('button', '-', 'step');
    minus.type = 'button';
    minus.setAttribute('aria-label', 'Fewer ' + it.name);
    minus.disabled = it.quantity <= 1;
    minus.onclick = () => change(it, it.quantity - 1);
    const plus = el('button', '+', 'step');
    plus.type = 'button';
    plus.setAttribute('aria-label', 'More ' + it.name);
    plus.disabled = it.quantity >= MAX_QTY;
    plus.onclick = () => change(it, it.quantity + 1);
    box.append(minus, el('output', String(it.quantity), 'copies'), plus);
    return box;
}

function row(it) {
    const isPrint = it.kind === 'print';
    const li = el('li', undefined, 'item');

    const thumb = el('div', undefined, 'item-thumb');
    if (isPrint) {
        thumb.innerHTML = FILE;
        thumb.alt = it.fileName;
    } else if (it.imageUrl) {
        const img = el('img');
        img.src = it.imageUrl;
        img.alt = it.name;
        thumb.appendChild(img);
    }

    const main = el('div', undefined, 'item-main');
    let name;
    if (isPrint) {
        name = el('div', it.fileName, 'item-name');
    } else {
        name = el('a', it.name, 'item-name');
        name.href = '/product.html?id=' + it.productId;
    }
    main.appendChild(name);
    const m = meta(it);
    if (m) main.appendChild(el('div', m, 'item-meta'));

    let act;
    if (isPrint) {
        // no edit route for print specs - print page adds the new job, then drops this one
        act = el('a', 'Edit', 'item-edit');
        act.href = `/print.html?file=${it.fileId}&replace=${it._id}`;
    } else {
        act = stepper(it);
    }
    const foot = el('div', undefined, 'item-foot');
    foot.append(act, el('div', money(it.totalPrice), 'item-price'));
    main.appendChild(foot);

    const del = el('button', undefined, 'item-del');
    del.type = 'button';
    del.setAttribute('aria-label', 'Remove ' + (isPrint ? it.fileName : it.name));
    del.innerHTML = TRASH;
    del.onclick = () => remove(it);

    li.append(thumb, main, del);
    return li;
}

function render() {
    list.textContent = '';
    items.forEach((it) => list.appendChild(row(it)));
    $('count').textContent = plural(items.length, 'item');
    $('empty').hidden = items.length > 0;
    // cart level total field name is not known here, and item totals are server priced anyway
    $('total').textContent = money(items.reduce((sum, it) => sum + it.totalPrice, 0));
    checkoutBtn.disabled = items.length === 0;
}

checkoutBtn.addEventListener('click', () => { location.href = '/checkout.html'; });

async function init() {
    try {
        items = (await api('/cart')).items || [];
    } catch (err) {
        showMsg(err.message, 'err');
        return;
    }
    render();
}

if (!token) toLogin();
else init();

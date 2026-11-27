const API = '/api';
let token = localStorage.getItem('token');
let user = JSON.parse(localStorage.getItem('user') || 'null');

const $ = (id) => document.getElementById(id);
const isStaff = () => user && ['StoreStaff', 'SuperAdmin'].includes(user.role);
const money = (n) => Number(n).toLocaleString('vi-VN') + ' VND';
const MAX_SIZE = 25 * 1024 * 1024;
const say = (t) => { const m = $('uploadMsg'); if (m) m.textContent = t; };
const SWATCHES = ['#CFD265', '#637C54', '#6CA6AB', '#2C388E'];
const drop = $('dropzone');
const fileInput = $('fileInput');

function el(tag, text, cls) {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    if (cls) n.className = cls;
    return n;
}

async function api(path, method = 'GET', body) {
    const res = await fetch(API + path, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: 'Bearer ' + token } : {})
        },
        body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
}

function logout() {
    token = null;
    user = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    render();
}

function card(p, i) {
    const c = el('article', undefined, 'card');

    if (p.imageUrls && p.imageUrls[0]) {
        const cardImg = el('a', undefined, 'card-img');
        cardImg.href = '/product.html?id=' + p._id;
        const img = el('img', undefined);
        img.src = p.imageUrls[0];
        img.alt = p.name;
        cardImg.appendChild(img);
        c.appendChild(cardImg);
    } else {
        const placeholder = el('a', undefined, 'card-img');
        placeholder.href = '/product.html?id=' + p._id;
        placeholder.style.background = SWATCHES[i % SWATCHES.length];
        c.appendChild(placeholder);
    }

    const body = el('div', undefined, 'card-body');
    const name = el('a', p.name, 'card-name');
    name.href = '/product.html?id=' + p._id;

    body.appendChild(el('div', (p.tags && p.tags[0]) || 'Souvenir', 'card-cat'));
    body.appendChild(name);
    body.appendChild(el('div', money(p.salePrice || p.basePrice), 'price'));
    if (p.salePrice) body.appendChild(el('s', money(p.basePrice), 'was'));
    c.appendChild(body);

    // customers only see the figma fields, staff still need stock numbers + delete
    if (isStaff()) {
        if (p.variants && p.variants.length) {
            const ul = el('ul', undefined, 'variants');
            for (const v of p.variants) {
                ul.appendChild(el('li', `${v.sku} | ${v.size || '-'} | ${v.color || '-'} | stock ${v.stockQuantity}`));
            }
            c.appendChild(ul);
        }
        const b = el('button', 'Delete', 'danger');
        b.onclick = async () => {
            if (!confirm('Delete ' + p.name + '?')) return;
            try { await api('/products/' + p._id, 'DELETE'); loadProducts(); }
            catch (e) { alert(e.message); }
        };
        c.appendChild(b);
    }
    return c;
}

async function loadProducts() {
    const list = $('productList');
    list.textContent = 'Loading...';
    if (!list) return;
    try {
        const products = await api('/products');
        list.textContent = '';
        if (!products.length) { list.textContent = 'No products yet.'; return; }
        products.forEach((p, i) => list.appendChild(card(p, i)));
    } catch (e) {
        list.textContent = e.message;
    }
}

function render() {
    const box = $('userBox');
    if (box) {
        box.textContent = '';
        if (user) {
            box.appendChild(el('span', `${user.fullName} (${user.role})`));
            const b = el('button', 'Logout');
            b.onclick = logout;
            box.appendChild(b);
        } else {
            const a = el('a', 'Login');
            a.href = 'login.html';
            box.appendChild(a);
        }
    }
    loadProducts();
}

function needLogin() {
    if (token) return false;
    say('Login first to upload.');
    location.href = 'login.html';
    return true;
}

async function uploadFile(file) {
    if (needLogin()) return;
    // server re-checks the %PDF- header, this only saves a round trip
    if (file.type !== 'application/pdf') { say('PDF only.'); return; }
    if (file.size > MAX_SIZE) { say('Max 25 MB.'); return; }

    say('Uploading...');
    const body = new FormData();
    body.append('file', file);
    try {
        // no Content-Type here - browser must set the multipart boundary itself
        const res = await fetch(API + '/files', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + token },
            body
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Upload failed');
        location.href = 'print.html?file=' + data._id;
    } catch (e) { say(e.message); }
}

if (drop && fileInput) {
    drop.addEventListener('click', () => { if (!needLogin()) fileInput.click(); });
}

fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) uploadFile(fileInput.files[0]);
    // reset so picking the same file twice still fires change
    fileInput.value = '';
});

drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('over');
    if (e.dataTransfer.files[0]) uploadFile(e.dataTransfer.files[0]);
});

// 2-level nav - aria-expanded drives the css, hover/click/esc only flip it
const nav = $('mainNav');
const menuBtn = $('menuBtn');
const hoverNav = matchMedia('(min-width: 701px) and (hover: hover)');
const subBtns = nav.querySelectorAll('.nav-link[aria-expanded]');

const setOpen = (btn, open) => btn.setAttribute('aria-expanded', String(open));

function closeAll() {
    subBtns.forEach((b) => setOpen(b, false));
    nav.classList.remove('open');
    setOpen(menuBtn, false);
}

subBtns.forEach((btn) => {
    const item = btn.parentElement;
    btn.addEventListener('click', (e) => {
        // mouse click on pc - hover already opened it, toggling would shut it right away
        if (hoverNav.matches && e.detail > 0) return;
        const open = btn.getAttribute('aria-expanded') === 'true';
        subBtns.forEach((b) => setOpen(b, false));
        setOpen(btn, !open);
    });
    item.addEventListener('mouseenter', () => {
        if (!hoverNav.matches) return;
        subBtns.forEach((b) => setOpen(b, b === btn));
    });
    item.addEventListener('mouseleave', () => {
        if (hoverNav.matches) setOpen(btn, false);
    });
});

menuBtn.addEventListener('click', () => {
    const open = !nav.classList.contains('open');
    nav.classList.toggle('open', open);
    setOpen(menuBtn, open);
});

nav.addEventListener('click', (e) => { if (e.target.closest('a')) closeAll(); });
document.addEventListener('click', (e) => { if (!e.target.closest('.top')) closeAll(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); });

render();

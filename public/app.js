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

function saveSession(data) {
    token = data.token;
    user = data.user;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    $('authMsg').textContent = '';
    say('');
    render();
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
        const img = el('img', undefined, 'card-img');
        img.src = p.imageUrls[0];
        img.alt = p.name;
        c.appendChild(img);
    } else {
        const ph = el('div', undefined, 'card-img');
        ph.style.background = SWATCHES[i % SWATCHES.length];
        c.appendChild(ph);
    }

    const body = el('div', undefined, 'card-body');
    body.appendChild(el('div', (p.tags && p.tags[0]) || 'Souvenir', 'card-cat'));
    body.appendChild(el('div', p.name, 'card-name'));
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
    const auth = $('authSection');
    const admin = $('adminSection');
    const box = $('userBox');
    if (auth) auth.hidden = !!user;
    if (admin) admin.hidden = !isStaff();
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

$('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target.elements;
    try {
        saveSession(await api('/auth/login', 'POST', { email: f.email.value, password: f.password.value }));
        e.target.reset();
    } catch (err) { $('authMsg').textContent = err.message; }
});

$('registerForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target.elements;
    try {
        saveSession(await api('/auth/register', 'POST', {
            fullName: f.fullName.value,
            email: f.email.value,
            password: f.password.value,
            studentOrStaffCode: f.studentOrStaffCode.value
        }));
        e.target.reset();
    } catch (err) { $('authMsg').textContent = err.message; }
});

$('productForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target.elements;
    const variants = f.variants.value.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
        const [sku, size, color, stock] = l.split(',').map(s => s.trim());
        return { sku, size, color, stockQuantity: Number(stock) || 0 };
    });
    try {
        await api('/products', 'POST', {
            name: f.name.value,
            basePrice: Number(f.basePrice.value),
            isPrintable: f.isPrintable.checked,
            tags: f.tags.value.split(',').map(s => s.trim()).filter(Boolean),
            variants
        });
        e.target.reset();
        loadProducts();
    } catch (err) { alert(err.message); }
});

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
        say(`Uploaded: ${data.fileName} (${data.pageCount} pages)`);
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

render();
// only the login/register pages have these forms - send user home after success
if ($('loginForm') || $('registerForm')) location.href = '/';
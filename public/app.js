const API = '/api';
let token = localStorage.getItem('token');
let user = JSON.parse(localStorage.getItem('user') || 'null');

const $ = (id) => document.getElementById(id);
const isStaff = () => user && ['StoreStaff', 'SuperAdmin'].includes(user.role);
const money = (n) => Number(n).toLocaleString('vi-VN') + ' VND';

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
    render();
}

function logout() {
    token = null;
    user = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    render();
}

function card(p) {
    const c = el('div', undefined, 'card');
    c.appendChild(el('h3', p.name));
    c.appendChild(el('div', p.salePrice ? money(p.salePrice) + ' (was ' + money(p.basePrice) + ')' : money(p.basePrice), 'price'));
    if (p.isPrintable) c.appendChild(el('span', 'Printable', 'badge'));

    if (p.variants && p.variants.length) {
        const ul = el('ul', undefined, 'variants');
        for (const v of p.variants) {
            ul.appendChild(el('li', `${v.sku} | ${v.size || '-'} | ${v.color || '-'} | stock ${v.stockQuantity}`));
        }
        c.appendChild(ul);
    }

    if (isStaff()) {
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
    try {
        const products = await api('/products');
        list.textContent = '';
        if (!products.length) { list.textContent = 'No products yet.'; return; }
        for (const p of products) list.appendChild(card(p));
    } catch (e) {
        list.textContent = e.message;
    }
}

function render() {
    $('authSection').hidden = !!user;
    $('adminSection').hidden = !isStaff();
    const box = $('userBox');
    box.textContent = '';
    if (user) {
        box.appendChild(el('span', `${user.fullName} (${user.role})`));
        const b = el('button', 'Logout');
        b.onclick = logout;
        box.appendChild(b);
    }
    loadProducts();
}

$('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target.elements;
    try {
        saveSession(await api('/auth/login', 'POST', { email: f.email.value, password: f.password.value }));
        e.target.reset();
    } catch (err) { $('authMsg').textContent = err.message; }
});

$('registerForm').addEventListener('submit', async (e) => {
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

$('productForm').addEventListener('submit', async (e) => {
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

render();
const API = '/api';
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || 'null');

const $ = (id) => document.getElementById(id);
const money = (n) => Number(n).toLocaleString('vi-VN') + ' VND';
const SWATCHES = ['#CFD265', '#637C54', '#6CA6AB', '#2C388E'];

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

// header + footer live here so every page shares one nav - static strings only, no user data inside
const HEADER = `
<header class="top">
    <a href="/" class="logo">Uni Print</a>
    <nav id="mainNav" class="nav" aria-label="Main">
        <ul class="nav-list">
            <li class="nav-item">
                <button type="button" class="nav-link" aria-expanded="false" aria-controls="subShop">Shop</button>
                <ul class="sub" id="subShop">
                    <li><a href="/products.html">All Souvenir</a></li>
                    <li><a href="/products.html?category=mug">Mug</a></li>
                    <li><a href="/products.html?category=document">Document</a></li>
                    <li><a href="/products.html?category=cloths">Cloths</a></li>
                </ul>
            </li>
            <li class="nav-item"><a class="nav-link" href="/#print">Print</a></li>
            <li class="nav-item">
                <button type="button" class="nav-link" aria-expanded="false" aria-controls="subInfo">Info</button>
                <ul class="sub" id="subInfo">
                    <li><a href="#">About</a></li>
                    <li><a href="#">Size Guide</a></li>
                    <li><a href="#">Shipping</a></li>
                    <li><a href="#">Return</a></li>
                </ul>
            </li>
        </ul>
    </nav>
    <div id="userBox"></div>
    <a href="/cart.html" class="icon-btn" aria-label="Cart">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="9" cy="20" r="1.5" />
            <circle cx="18" cy="20" r="1.5" />
            <path d="M1 2h4l2.7 12.4a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L22 7H6" />
        </svg>
        <span class="badge" id="cartBadge" hidden></span>
    </a>
    <button type="button" class="icon-btn menu-btn" id="menuBtn" aria-label="Menu" aria-expanded="false"
        aria-controls="mainNav">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2"
            stroke-linecap="round" aria-hidden="true">
            <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
    </button>
</header>`;

const FOOTER = `
<footer class="foot">
    <div class="foot-brand">Uni print</div>
    <div class="foot-cols">
        <nav class="foot-col" aria-label="Shop">
            <h3>SHOP</h3>
            <a href="/products.html">All Souvenir</a>
            <a href="/products.html?category=mug">Mug</a>
            <a href="/products.html?category=document">Document</a>
            <a href="/products.html?category=cloths">Cloths</a>
        </nav>
        <nav class="foot-col" aria-label="Info">
            <h3>INFO</h3>
            <a href="#">About</a>
            <a href="#">Size Guide</a>
            <a href="#">Shipping</a>
            <a href="#">Return</a>
        </nav>
        <nav class="foot-col" aria-label="Follow">
            <h3>FOLLOW</h3>
            <a href="#">Instagram</a>
            <a href="#">Tiktok</a>
            <a href="#">Facebook</a>
        </nav>
    </div>
    <p class="copy">© 2026 UniPrint.</p>
</footer>`;

document.body.insertAdjacentHTML('afterbegin', HEADER);
document.body.insertAdjacentHTML('beforeend', FOOTER);

const box = $('userBox');
if (user) {
    box.appendChild(el('span', `${user.fullName} (${user.role})`));
    const b = el('button', 'Logout');
    b.onclick = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        location.reload();
    };
    box.appendChild(b);
} else {
    const a = el('a', 'Login');
    a.href = '/login.html';
    box.appendChild(a);
}

// 2-level nav - same behaviour as app.js: aria-expanded drives the css, hover/click/esc only flip it
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

// badge sits in the header cart link - hidden at 0, 99+ so it never outgrows the icon
function setCartBadge(n) {
    const b = $('cartBadge');
    b.textContent = n > 99 ? '99+' : String(n);
    b.hidden = !n;
    b.parentElement.setAttribute('aria-label', n ? 'Cart, ' + n + (n === 1 ? ' item' : ' items') : 'Cart');
}

async function loadCartBadge() {
    if (!token) { setCartBadge(0); return; }
    try {
        setCartBadge((await api('/cart/count')).cartCount || 0);
    } catch {
        // badge is a hint only - header must still work when the call fails
    }
}

// back button restores the page from cache with an old count
addEventListener('pageshow', (e) => { if (e.persisted) loadCartBadge(); });

loadCartBadge();
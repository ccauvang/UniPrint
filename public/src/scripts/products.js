const list = $('productList');
const q = $('q');
const catSel = $('cat');
let products = [];
let cats = [];

const catName = (id) => (cats.find((c) => c._id === id) || {}).name || 'Souvenir';

function card(p, i) {
    const c = el('article', undefined, 'card');

    if (p.imageUrls && p.imageUrls[0]) {
        const cardImg = el('a', undefined, 'card-img');
        cardImg.href = '/product.html?id=' + p._id;
        const img = el('img', undefined);
        img.src = p.imageUrls[0];
        img.alt = p.name;
        img.loading = 'lazy';
        img.decoding = 'async';
        cardImg.appendChild(img);
        c.appendChild(cardImg);
    } else {
        const placeholder = el('a', undefined, 'card-img');
        placeholder.href = '/product.html?id=' + p._id;
        placeholder.style.background = SWATCHES[i % SWATCHES.length];
        c.appendChild(placeholder);
    }

    const body = el('div', undefined, 'card-body');
    body.appendChild(el('div', catName(p.categoryId), 'card-cat'));
    const name = el('a', p.name, 'card-name');
    name.href = '/product.html?id=' + p._id;
    body.appendChild(name);
    body.appendChild(el('div', money(p.salePrice || p.basePrice), 'price'));
    if (p.salePrice) body.appendChild(el('s', money(p.basePrice), 'was'));
    if (p.status === 'OutOfStock') body.appendChild(el('div', 'Out of stock', 'was'));
    c.appendChild(body);
    return c;
}

function say(text) {
    list.textContent = '';
    list.appendChild(el('p', text, 'empty'));
}

function draw() {
    const text = q.value.trim().toLowerCase();
    const shown = products.filter((p) =>
        (!catSel.value || p.categoryId === catSel.value) &&
        (!text || [p.name, ...(p.tags || [])].some((s) => s.toLowerCase().includes(text))));
    if (!shown.length) { say('No products found.'); return; }
    list.textContent = '';
    shown.forEach((p, i) => list.appendChild(card(p, i)));
}

async function init() {
    say('Loading...');
    try {
        [products, cats] = await Promise.all([api('/products'), api('/categories')]);
    } catch (e) {
        say(e.message);
        return;
    }
    // server returns every status to the public, so hide inactive here
    products = products.filter((p) => p.status !== 'Inactive');
    for (const c of cats) {
        const o = el('option', c.name);
        o.value = c._id;
        catSel.appendChild(o);
    }
    const hit = cats.find((c) => c.slug === new URLSearchParams(location.search).get('category'));
    if (hit) catSel.value = hit._id;
    draw();
}

q.addEventListener('input', draw);
catSel.addEventListener('change', draw);
$('filters').addEventListener('submit', (e) => e.preventDefault());

init();

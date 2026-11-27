const id = new URLSearchParams(location.search).get('id');
const sel = { size: null, color: null };
const buy = $('buyBtn');
let product;
let busy = false;
let rating = 0;

const key = (x) => x || null;
const uniq = (a) => [...new Set(a.filter(Boolean))];
const variants = () => product.variants || [];
const inStock = (v) => Boolean(v) && v.stockQuantity > 0;
const current = () => variants().find((v) => key(v.size) === sel.size && key(v.color) === sel.color);

function showMsg(text, kind) {
    const m = $('msg');
    m.textContent = text;
    m.className = 'msg ' + (kind || '');
    m.hidden = !text;
}

function setMain(url) {
    const img = $('mainImg');
    img.hidden = !url;
    if (url) {
        img.src = url;
        img.alt = product.name;
    }
}

function renderThumbs(urls) {
    const box = $('thumbs');
    box.textContent = '';
    if (urls.length < 2) return;
    urls.forEach((u, i) => {
        const b = el('button', undefined, 'thumb');
        b.type = 'button';
        b.setAttribute('aria-label', 'Image ' + (i + 1));
        b.setAttribute('aria-current', String(i === 0));
        const img = el('img');
        img.src = u;
        img.alt = '';
        b.appendChild(img);
        b.onclick = () => {
            setMain(u);
            box.querySelectorAll('.thumb').forEach((t) => t.setAttribute('aria-current', String(t === b)));
        };
        box.appendChild(b);
    });
}

function pickSize(s) {
    sel.size = s;
    const colors = uniq(variants().filter((v) => v.size === s).map((v) => v.color));
    // keep the color when the new size has it, else fall back to the first one
    if (!colors.includes(sel.color)) sel.color = colors[0] || null;
    update();
}

function renderOptions() {
    const sizes = uniq(variants().map((v) => v.size));
    const colors = uniq(variants().filter((v) => key(v.size) === sel.size).map((v) => v.color));
    $('sizeBox').hidden = !sizes.length;
    $('colorBox').hidden = !colors.length;

    const sizeRow = $('sizes');
    sizeRow.textContent = '';
    for (const s of sizes) {
        const b = el('button', s, 'size');
        b.type = 'button';
        b.setAttribute('aria-pressed', String(s === sel.size));
        b.disabled = !variants().some((v) => v.size === s && inStock(v));
        b.onclick = () => pickSize(s);
        sizeRow.appendChild(b);
    }

    const colorRow = $('colors');
    colorRow.textContent = '';
    for (const c of colors) {
        const b = el('button', undefined, 'swatch');
        b.type = 'button';
        b.title = c;
        b.setAttribute('aria-label', c);
        b.setAttribute('aria-pressed', String(c === sel.color));
        b.disabled = !inStock(variants().find((v) => key(v.size) === sel.size && v.color === c));
        // color field is free text - only paint it when css understands it, else show the word
        if (CSS.supports('color', c)) {
            const dot = el('i');
            dot.style.background = c;
            b.appendChild(dot);
        } else {
            b.textContent = c;
        }
        b.onclick = () => { sel.color = c; update(); };
        colorRow.appendChild(b);
    }
}

function update() {
    renderOptions();
    const cur = current();
    // display only - the cart API computes the real unit price
    const adj = cur ? cur.priceAdjustment || 0 : 0;
    $('dPrice').textContent = money((product.salePrice || product.basePrice) + adj);
    $('dWas').textContent = product.salePrice ? money(product.basePrice + adj) : '';
    if (cur && cur.imageUrl) setMain(cur.imageUrl);

    const ok = product.status === 'Active' && (!variants().length || inStock(cur));
    buy.disabled = !ok || busy;
    buy.textContent = ok ? 'Add to cart - Order now' : 'Out of stock';
}

buy.addEventListener('click', async () => {
    if (!token) { location.href = '/login.html'; return; }
    busy = true;
    update();
    showMsg('');
    const cur = current();
    try {
        await api('/cart/items', 'POST', {
            productId: product._id,
            quantity: 1,
            ...(cur ? { variantId: cur._id } : {})
        });
        showMsg('Added to cart.', 'ok');
        // refetch - same product + variant merges into one line, so +1 locally would be wrong
        loadCartBadge();
    } catch (e) {
        showMsg(e.message, 'err');
    }
    busy = false;
    update();
});

// approved only - server hides pending reviews
async function loadReviews() {
    return api('/products/' + id + '/reviews');
}

// field names (userName, rating, comment) are guesses - match them to the real review model
function renderReviews(reviews) {
    const ul = $('revList');
    ul.textContent = '';
    $('revEmpty').hidden = reviews.length > 0;
    for (const r of reviews) {
        const li = el('li');
        li.appendChild(el('strong', `${r.userName || 'Customer'} - ${r.rating}/5`));
        li.appendChild(el('p', r.comment));
        ul.appendChild(li);
    }
}

function showRevMsg(text, kind) {
    const m = $('revMsg');
    m.textContent = text;
    m.className = 'msg ' + (kind || '');
    m.hidden = !text;
}

function renderRate() {
    const row = $('rate');
    row.textContent = '';
    for (let n = 1; n <= 5; n++) {
        const b = el('button', String(n), 'size');
        b.type = 'button';
        b.setAttribute('aria-label', n + ' out of 5');
        b.setAttribute('aria-pressed', String(n === rating));
        b.onclick = () => { rating = n; renderRate(); };
        row.appendChild(b);
    }
}

$('revForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!token) { location.href = '/login.html'; return; }
    if (!rating) { showRevMsg('Pick a rating 1-5', 'err'); return; }
    const btn = $('revBtn');
    btn.disabled = true;
    showRevMsg('');
    const comment = $('revText').value.trim();
    try {
        await api('/products/' + id + '/reviews', 'POST', { rating, ...(comment ? { comment } : {}) });
        // new review is pending - not in the list until staff approve, so no reload
        showRevMsg('Thanks. Your review shows after staff approve it.', 'ok');
        $('revText').value = '';
        rating = 0;
        renderRate();
    } catch (err) {
        // 409 "You already reviewed this product" lands here too
        showRevMsg(err.message, 'err');
    }
    btn.disabled = false;
});

function fail(text) {
    $('status').textContent = text;
    $('crumbName').textContent = 'Not found';
}

async function init() {
    if (!id) { fail('Product not found.'); return; }
    try {
        product = await api('/products/' + id);
    } catch (e) {
        fail(e.message);
        return;
    }
    if (product.status === 'Inactive') { fail('Product not found.'); return; }

    let catName = 'Souvenir';
    if (product.categoryId) {
        try { catName = (await api('/categories/' + product.categoryId)).name; } catch { /* keep default label */ }
    }

    document.title = product.name + ' - UniPrint';
    $('crumbName').textContent = product.name;
    $('dCat').textContent = catName;
    $('dName').textContent = product.name;
    $('dDesc').textContent = product.description || product.shortDescription || '';
    $('printBox').hidden = !product.isPrintable;

    const urls = product.imageUrls || [];
    setMain(urls[0]);
    renderThumbs(urls);

    const first = variants().find(inStock) || variants()[0];
    if (first) {
        sel.size = key(first.size);
        sel.color = key(first.color);
    }
    update();

    $('revSum').textContent = `${Number(product.averageRating || 0).toFixed(1)} / 5 - ${product.reviewCount || 0} reviews`;
    renderRate();
    // reviews failing must not block the page - this runs before $('status') is hidden
    try { renderReviews(await loadReviews()); } catch { renderReviews([]); }

    $('status').hidden = true;
    $('detail').hidden = false;
    $('reviews').hidden = false;
}

init();

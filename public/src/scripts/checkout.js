const API = '/api';
const token = localStorage.getItem('token');

// fee is display only - the order API must price delivery itself
const DELIVERY = {
    pickup: { title: 'Pick up at shop', fee: 0 },
    campus: { title: 'Campus delivery', fee: 3000 }
};
const CASH_NOTE = { pickup: 'Pay when you pick up', campus: 'Pay on delivery' };
// no order or payment page yet - point this at it when it exists
const AFTER_ORDER = '/';

const $ = (id) => document.getElementById(id);
const msgEl = $('msg');
const roomEl = $('room');
const codeEl = $('code');
const applyBtn = $('applyBtn');
const placeBtn = $('placeBtn');
const voucherForm = $('voucherForm');
const voucherBox = $('voucher');

const state = { subTotal: 0, voucher: null, ready: false, busy: false };

const money = (n) => Number(n).toLocaleString('vi-VN') + ' VND';
const feeText = (fee) => (fee ? money(fee) : 'Free');
const pick = (name) => document.querySelector('input[name="' + name + '"]:checked').value;

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
    placeBtn.disabled = !state.ready || state.busy;
}

function renderSummary() {
    const d = pick('delivery');
    $('roomBox').hidden = d !== 'campus';
    $('cashNote').textContent = CASH_NOTE[d];
    // money rows wait for the cart, else they would flash 0 VND
    if (!state.ready) return;

    const v = state.voucher;
    const discount = v ? v.discountAmount : 0;
    const fee = DELIVERY[d].fee;

    $('sSub').textContent = money(state.subTotal);
    $('sVoucherRow').hidden = !v;
    if (v) {
        $('sVoucherLabel').textContent = 'Voucher ' + v.code;
        $('sVoucher').textContent = '-' + money(discount);
    }
    $('sShipLabel').textContent = DELIVERY[d].title;
    $('sShip').textContent = feeText(fee);
    $('total').textContent = money(state.subTotal - discount + fee);
}

function drawVoucher() {
    const v = state.voucher;
    voucherForm.hidden = Boolean(v);
    voucherBox.hidden = !v;
    if (v) {
        const off = v.discountType === 'percent' ? v.discountValue + '% off' : money(v.discountValue) + ' off';
        $('voucherText').textContent = v.code + ' - ' + off;
    }
    renderSummary();
}

// one place that maps ui values to server field names - POST /api/orders is not built yet, fix here when it is
function orderBody() {
    const delivery = pick('delivery');
    return {
        deliveryMethod: delivery,
        ...(delivery === 'campus' ? { deliveryAddress: roomEl.value.trim() } : {}),
        paymentMethod: pick('payment'),
        // code only, never the amount - server must reprice from the cart
        ...(state.voucher ? { couponCode: state.voucher.code } : {})
    };
}

document.addEventListener('change', (e) => {
    if (e.target.type === 'radio') {
        showMsg('');
        renderSummary();
    }
});

voucherForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = codeEl.value.trim();
    if (!code) {
        showMsg('Enter a voucher code', 'err');
        codeEl.focus();
        return;
    }
    applyBtn.disabled = true;
    showMsg('');
    try {
        // server prices the voucher from the saved cart, not from anything sent here
        state.voucher = await api('/coupons/validate', 'POST', { code });
        drawVoucher();
    } catch (err) {
        showMsg(err.message, 'err');
    }
    applyBtn.disabled = false;
});

$('removeVoucher').addEventListener('click', () => {
    // request already in flight carries the old code
    if (state.busy) return;
    state.voucher = null;
    codeEl.value = '';
    showMsg('');
    drawVoucher();
    codeEl.focus();
});

placeBtn.addEventListener('click', async () => {
    if (placeBtn.disabled) return;
    const body = orderBody();
    if (body.deliveryMethod === 'campus' && !body.deliveryAddress) {
        showMsg('Enter building and room', 'err');
        roomEl.focus();
        return;
    }
    state.busy = true;
    syncBtn();
    showMsg('');
    try {
        await api('/orders', 'POST', body);
        showMsg('Order placed.', 'ok');
        location.href = AFTER_ORDER;
        return;
    } catch (err) {
        showMsg(err.message, 'err');
    }
    state.busy = false;
    syncBtn();
});

async function init() {
    document.querySelectorAll('[data-fee]').forEach((n) => {
        n.textContent = feeText(DELIVERY[n.dataset.fee].fee);
    });
    renderSummary();

    try {
        const cart = await api('/cart');
        const items = cart.items || [];
        if (!items.length) {
            location.replace('/cart.html');
            return;
        }
        // subTotalAmount is a cart virtual, sum is only a fallback
        state.subTotal = cart.subTotalAmount !== undefined
            ? cart.subTotalAmount
            : items.reduce((sum, it) => sum + it.totalPrice, 0);
    } catch (err) {
        $('total').textContent = '-';
        showMsg(err.message, 'err');
        return;
    }
    state.ready = true;
    renderSummary();
    syncBtn();
}

if (!token) toLogin();
else init();

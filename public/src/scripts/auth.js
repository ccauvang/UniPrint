const API = '/api/auth';
const HOME = '/';

const form = document.querySelector('form[data-auth]');
const msg = document.getElementById('formMsg');

function showError(text) {
    msg.textContent = text;
    msg.hidden = !text;
}

function saveSession({ token, user }) {
    // same keys app.js reads on the home page
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
}

// blank optional fields are dropped so mongo never stores empty strings
function clean(obj) {
    return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== ''));
}

async function skipIfSignedIn() {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
        const res = await fetch(`${API}/me`, { headers: { Authorization: 'Bearer ' + token } });
        if (res.ok) { location.replace(HOME); return; }
        // expired token would bounce the user between pages forever, so drop it
        if (res.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        }
    } catch {
        // server unreachable - keep the form usable, submit will show the real error
    }
}

document.querySelectorAll('[data-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
        const input = document.getElementById(btn.dataset.toggle);
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.setAttribute('aria-pressed', String(show));
        btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    });
});

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showError('');
    const mode = form.dataset.auth;
    const f = form.elements;

    if (mode === 'register' && f.password.value !== f.confirmPassword.value) {
        showError('Passwords do not match');
        f.confirmPassword.focus();
        return;
    }

    const payload = mode === 'login'
        ? { email: f.email.value.trim(), password: f.password.value }
        : clean({
            fullName: f.fullName.value.trim(),
            email: f.email.value.trim(),
            password: f.password.value,
            phoneNumber: f.phoneNumber.value.trim(),
            studentOrStaffCode: f.studentOrStaffCode.value.trim(),
            classCode: f.classCode.value.trim()
        });

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
        const res = await fetch(`${API}/${mode}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        // express-rate-limit answers 429 with plain text, json() would fail
        if (res.status === 429) throw new Error('Too many attempts. Try again in 15 minutes.');
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Request failed');
        saveSession(data);
        location.href = HOME;
    } catch (err) {
        showError(err.message);
        btn.disabled = false;
    }
});

skipIfSignedIn();

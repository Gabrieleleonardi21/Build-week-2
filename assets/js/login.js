// ============================================
// LOGIN — gestione del form e redirect alla home
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Auto-login: la sessione attiva è separata dal profilo, così il logout
    // chiude la sessione ma conserva i dati dell'utente in localStorage.
    if (localStorage.getItem('session_active')) {
        location.href = 'home.html';
        return;
    }
    // Pre-compila lo username dell'ultimo accesso, se presente (profilo conservato)
    const savedName = localStorage.getItem('display_name');
    if (savedName) document.getElementById('loginUser').value = savedName;

    document.getElementById('loginForm').addEventListener('submit', handleLogin);
});

async function handleLogin(e) {
    e.preventDefault();
    const user = document.getElementById('loginUser').value.trim();
    const errorEl = document.getElementById('loginEmailError');

    // Valida: campo vuoto o, se contiene @, verifica formato email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isEmail = user.includes('@');
    if (!user || (isEmail && !emailRegex.test(user))) {
        errorEl.classList.remove('d-none');
        return;
    }
    errorEl.classList.add('d-none');

    // Spinner sul bottone durante il login simulato
    const btn = document.getElementById('loginSubmitBtn');
    btn.disabled = true;
    const spinner = make('span', 'spinner-border spinner-border-sm me-2');
    spinner.setAttribute('role', 'status');
    btn.replaceChildren(spinner, 'Accesso in corso...');

    await new Promise(resolve => setTimeout(resolve, 800));

    const displayName = isEmail ? user.split('@')[0] : user;
    localStorage.setItem('display_name', displayName);
    // Apre la sessione: questo flag (non il profilo) determina "sono loggato"
    localStorage.setItem('session_active', '1');
    if (!localStorage.getItem('profile_join_date')) {
        localStorage.setItem('profile_join_date', new Date().toISOString());
    }
    // Flag letto da app.js sulla home per far partire i confetti post-login
    sessionStorage.setItem('just_logged_in', '1');
    location.href = 'home.html';
}

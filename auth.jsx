// auth.jsx — client-side auth for the Tiled prototype
//
// IMPORTANT: this is a UI prototype. Users + passwords are stored in
// localStorage in plaintext. A real production app must do auth server-side
// with bcrypt/argon2 hashing, secure sessions, rate limiting, and password
// reset flows. Do not ship this as-is to anything that handles real users.

const { useState: useState_a, useEffect: useEffect_a, useMemo: useMemo_a, createContext: createContext_a, useContext: useContext_a } = React;

const AUTH_USERS_KEY = 'tiled.users.v1';
const AUTH_SESSION_KEY = 'tiled.session.v1';

// roles
const ROLE_OWNER = 'owner';
const ROLE_ADMIN = 'admin';
const ROLE_USER  = 'user';

// seeded built-in accounts so the prototype is testable without signup
const SEED_USERS = [
  {
    username: 'yohan', email: 'yohan@tiled.app', password: 'Yohan2026!',
    name: 'Yohan Olivier', avatar: 'YO', role: ROLE_OWNER,
    bio: 'Designer, sometimes photographer. Founder of Tiled.',
    createdAt: '2024-03-12T00:00:00Z',
  },
  {
    username: 'asha', email: 'asha@tiled.app', password: 'Admin2026!',
    name: 'Asha Rajan', avatar: 'AR', role: ROLE_ADMIN,
    bio: 'Operations & moderation. Keeping the feed civilized.',
    createdAt: '2024-04-04T00:00:00Z',
  },
];

const PASSWORD_RULES = [
  { id: 'length',  label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { id: 'upper',   label: 'One capital letter',    test: (p) => /[A-Z]/.test(p) },
  { id: 'number',  label: 'One number',            test: (p) => /\d/.test(p) },
  { id: 'special', label: 'One special character', test: (p) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?`~]/.test(p) },
];
function validatePassword(p) {
  return PASSWORD_RULES.map(r => ({ ...r, ok: r.test(p) }));
}
function passwordValid(p) {
  return PASSWORD_RULES.every(r => r.test(p));
}

function loadUsers() {
  try {
    const raw = localStorage.getItem(AUTH_USERS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  // first run — seed
  localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(SEED_USERS));
  return SEED_USERS;
}
function saveUsers(users) {
  localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(users));
}
// Sessions can be persistent (localStorage — survives browser close) or
// ephemeral (sessionStorage — cleared on browser close). On read, a
// remembered session takes priority, then the per-tab session is checked.
function loadSession() {
  try {
    return localStorage.getItem(AUTH_SESSION_KEY) ||
           sessionStorage.getItem(AUTH_SESSION_KEY) || null;
  } catch (e) { return null; }
}
function saveSession(emailLower, remember) {
  try {
    localStorage.removeItem(AUTH_SESSION_KEY);
    sessionStorage.removeItem(AUTH_SESSION_KEY);
  } catch (e) { /* ignore */ }
  if (!emailLower) return;
  try {
    if (remember) localStorage.setItem(AUTH_SESSION_KEY, emailLower);
    else sessionStorage.setItem(AUTH_SESSION_KEY, emailLower);
  } catch (e) { /* ignore */ }
}

const AuthContext = createContext_a(null);
function useAuth() { return useContext_a(AuthContext); }

function AuthProvider({ children }) {
  const [users, setUsers] = useState_a(() => loadUsers());
  const [sessionEmail, setSessionEmail] = useState_a(() => loadSession());

  const currentUser = useMemo_a(() => {
    if (!sessionEmail) return null;
    return users.find(u => u.email.toLowerCase() === sessionEmail.toLowerCase()) || null;
  }, [users, sessionEmail]);

  const login = (identifier, password, remember = true) => {
    const id = identifier.trim().toLowerCase();
    const user = users.find(u =>
      u.email.toLowerCase() === id || u.username.toLowerCase() === id
    );
    if (!user) return { ok: false, error: 'No account found for that email or username.' };
    if (user.password !== password) return { ok: false, error: 'Incorrect password.' };
    saveSession(user.email.toLowerCase(), remember);
    setSessionEmail(user.email.toLowerCase());
    return { ok: true };
  };

  const signup = ({ username, email, password, remember = true }) => {
    const u = (username || '').trim();
    const e = (email || '').trim();
    if (!u) return { ok: false, error: 'Username is required.' };
    if (!/^[a-zA-Z0-9_.-]{3,24}$/.test(u))
      return { ok: false, error: 'Username must be 3–24 characters, letters/numbers/._- only.' };
    if (!e) return { ok: false, error: 'Email is required.' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
      return { ok: false, error: 'Enter a valid email address.' };
    if (!passwordValid(password))
      return { ok: false, error: 'Password does not meet all requirements.' };
    if (users.some(x => x.email.toLowerCase() === e.toLowerCase()))
      return { ok: false, error: 'An account with that email already exists.' };
    if (users.some(x => x.username.toLowerCase() === u.toLowerCase()))
      return { ok: false, error: 'That username is taken.' };

    const avatar = u.slice(0, 2).toUpperCase();
    const newUser = {
      username: u, email: e, password,
      name: u.charAt(0).toUpperCase() + u.slice(1),
      avatar, role: ROLE_USER, bio: '',
      createdAt: new Date().toISOString(),
    };
    const next = [...users, newUser];
    setUsers(next); saveUsers(next);
    saveSession(e.toLowerCase(), remember); setSessionEmail(e.toLowerCase());
    return { ok: true };
  };

  const logout = () => { saveSession(null, false); setSessionEmail(null); };

  const value = { currentUser, login, signup, logout, users };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function AuthGate({ children }) {
  const { currentUser } = useAuth();
  if (!currentUser) return <AuthScreen />;
  return children;
}

function EyeIcon({ open }) {
  return open ? (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M3 3l18 18"/>
      <path d="M10.6 6.1A10.4 10.4 0 0 1 12 6c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.1 4"/>
      <path d="M6.6 6.6A17 17 0 0 0 2 13s3.5 7 10 7c1.7 0 3.2-.4 4.6-1"/>
      <path d="M9.5 9.6a3 3 0 0 0 4 4"/>
    </svg>
  );
}

function PasswordField({ value, onChange, placeholder, autoComplete, onKeyDown, name }) {
  const [show, setShow] = useState_a(false);
  return (
    <div className="ti-auth-pw">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder || 'Password'}
        autoComplete={autoComplete || 'current-password'}
        name={name || 'password'}
        className="ti-auth-input"
      />
      <button type="button" className="ti-auth-eye"
              onClick={() => setShow(s => !s)}
              aria-label={show ? 'Hide password' : 'Show password'}>
        <EyeIcon open={show} />
      </button>
    </div>
  );
}

function AuthScreen() {
  const [tab, setTab] = useState_a('login'); // 'login' | 'signup'
  return (
    <div className="ti-auth-root">
      <div className="ti-auth-bg" />
      <div className="ti-auth-card">
        <div className="ti-gloss" />
        <div className="ti-gloss-edge" />
        <header className="ti-auth-hd">
          <div className="ti-logo ti-auth-logo">
            <span className="ti-logo-mark"><span /><span /><span /><span /></span>
            <span className="ti-logo-word">Tiled</span>
          </div>
          <div className="ti-auth-tabs" data-tab={tab}>
            <span className="ti-auth-tab-thumb" style={{ left: tab === 'login' ? '4px' : 'calc(50% + 0px)' }} />
            <button className={`ti-auth-tab${tab === 'login' ? ' is-active' : ''}`}
                    onClick={() => setTab('login')}>Sign in</button>
            <button className={`ti-auth-tab${tab === 'signup' ? ' is-active' : ''}`}
                    onClick={() => setTab('signup')}>Create account</button>
          </div>
        </header>
        {tab === 'login' ? <LoginForm onSwitch={() => setTab('signup')} /> : <SignupForm onSwitch={() => setTab('login')} />}
        <footer className="ti-auth-ft">
          <div className="ti-auth-ft-line">
            <span className="ti-auth-ft-eyebrow">Prototype</span>
            <span>Try <code>yohan@tiled.app</code> · <code>Yohan2026!</code> (Owner) or <code>asha@tiled.app</code> · <code>Admin2026!</code> (Admin)</span>
          </div>
          <div className="ti-auth-ft-note">
            Accounts are stored on this device only — sign in on a different device or browser and you'll see a fresh state. Cross-device sync requires a server backend.
          </div>
        </footer>
      </div>
    </div>
  );
}

function LoginForm({ onSwitch }) {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState_a('');
  const [password, setPassword] = useState_a('');
  const [remember, setRemember] = useState_a(true);
  const [error, setError] = useState_a(null);

  const submit = (e) => {
    e?.preventDefault();
    setError(null);
    if (!identifier.trim() || !password) {
      setError('Enter your email/username and password.');
      return;
    }
    const r = login(identifier, password, remember);
    if (!r.ok) setError(r.error);
  };

  return (
    <form className="ti-auth-form" onSubmit={submit}>
      <label className="ti-auth-row">
        <span className="ti-auth-lbl">Email or username</span>
        <input className="ti-auth-input"
               value={identifier}
               onChange={(e) => setIdentifier(e.target.value)}
               placeholder="you@example.com"
               autoComplete="username"
               autoFocus />
      </label>
      <label className="ti-auth-row">
        <span className="ti-auth-lbl">Password</span>
        <PasswordField value={password} onChange={setPassword}
                       autoComplete="current-password" />
      </label>
      <RememberMe checked={remember} onChange={setRemember} />
      {error && <div className="ti-auth-err">{error}</div>}
      <button className="ti-auth-submit" type="submit">Sign in</button>
      <div className="ti-auth-switch">
        New to Tiled? <button type="button" onClick={onSwitch}>Create an account</button>
      </div>
    </form>
  );
}

function RememberMe({ checked, onChange }) {
  return (
    <label className="ti-auth-remember">
      <span className={`ti-auth-checkbox${checked ? ' is-checked' : ''}`} aria-hidden="true">
        {checked && (
          <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m2 6 3 3 5-6"/>
          </svg>
        )}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
             className="ti-auth-checkbox-real" />
      <span className="ti-auth-remember-text">
        <span className="ti-auth-remember-line">Stay signed in</span>
        <span className="ti-auth-remember-hint">
          {checked
            ? 'You\'ll stay signed in on this device until you sign out.'
            : 'You\'ll be signed out when you close the browser.'}
        </span>
      </span>
    </label>
  );
}

function SignupForm({ onSwitch }) {
  const { signup } = useAuth();
  const [username, setUsername] = useState_a('');
  const [email, setEmail] = useState_a('');
  const [password, setPassword] = useState_a('');
  const [remember, setRemember] = useState_a(true);
  const [error, setError] = useState_a(null);
  const [touched, setTouched] = useState_a(false);

  const checks = validatePassword(password);
  const allOk = checks.every(c => c.ok);

  const submit = (e) => {
    e?.preventDefault();
    setError(null);
    setTouched(true);
    const r = signup({ username, email, password, remember });
    if (!r.ok) setError(r.error);
  };

  return (
    <form className="ti-auth-form" onSubmit={submit}>
      <label className="ti-auth-row">
        <span className="ti-auth-lbl">Username</span>
        <input className="ti-auth-input"
               value={username}
               onChange={(e) => setUsername(e.target.value)}
               placeholder="yourhandle"
               autoComplete="username"
               autoFocus />
      </label>
      <label className="ti-auth-row">
        <span className="ti-auth-lbl">Email</span>
        <input className="ti-auth-input" type="email"
               value={email}
               onChange={(e) => setEmail(e.target.value)}
               placeholder="you@example.com"
               autoComplete="email" />
      </label>
      <label className="ti-auth-row">
        <span className="ti-auth-lbl">Password</span>
        <PasswordField value={password} onChange={setPassword}
                       autoComplete="new-password" />
      </label>
      <ul className={`ti-auth-rules${touched && !allOk ? ' is-touched' : ''}`}>
        {checks.map(c => (
          <li key={c.id} className={c.ok ? 'is-ok' : ''}>
            <span className="ti-auth-rule-icn">
              {c.ok
                ? <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m2 6 3 3 5-6"/></svg>
                : <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="6" cy="6" r="4.2"/></svg>}
            </span>
            <span>{c.label}</span>
          </li>
        ))}
      </ul>
      <RememberMe checked={remember} onChange={setRemember} />
      {error && <div className="ti-auth-err">{error}</div>}
      <button className="ti-auth-submit" type="submit" disabled={!allOk || !username.trim() || !email.trim()}>
        Create account
      </button>
      <div className="ti-auth-switch">
        Already have an account? <button type="button" onClick={onSwitch}>Sign in</button>
      </div>
    </form>
  );
}

window.AuthProvider = AuthProvider;
window.AuthGate = AuthGate;
window.useAuth = useAuth;
window.ROLE_OWNER = ROLE_OWNER;
window.ROLE_ADMIN = ROLE_ADMIN;
window.ROLE_USER = ROLE_USER;

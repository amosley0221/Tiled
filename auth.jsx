// auth.jsx — Supabase-backed auth for Tiled
//
// Sessions live on Supabase's servers. The token is cached locally so
// reloading doesn't kick the user out:
//   - "Stay signed in" CHECKED   → token in localStorage (survives close)
//   - "Stay signed in" UNCHECKED → token in sessionStorage (cleared on close)
// The dynamic storage adapter below switches between the two right before
// each auth call.

const { useState: useState_a, useEffect: useEffect_a, useMemo: useMemo_a, createContext: createContext_a, useContext: useContext_a } = React;

const ROLE_OWNER = 'owner';
const ROLE_ADMIN = 'admin';
const ROLE_USER  = 'user';

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

// ─── dynamic storage: localStorage when "remember", sessionStorage otherwise
const sessionMode = { remember: true };
const dynamicStorage = {
  getItem: (key) => {
    try {
      const v = localStorage.getItem(key);
      if (v !== null) return v;
      return sessionStorage.getItem(key);
    } catch (e) { return null; }
  },
  setItem: (key, value) => {
    try {
      if (sessionMode.remember) {
        localStorage.setItem(key, value);
        sessionStorage.removeItem(key);
      } else {
        sessionStorage.setItem(key, value);
        localStorage.removeItem(key);
      }
    } catch (e) { /* ignore quota / private mode */ }
  },
  removeItem: (key) => {
    try { localStorage.removeItem(key); sessionStorage.removeItem(key); } catch (e) { /* ignore */ }
  },
};

// initialize the supabase client once
const supabase = (window.supabase && window.SUPABASE_URL && window.SUPABASE_KEY)
  ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY, {
      auth: {
        storage: dynamicStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;
// expose for the rest of the app
window.supabaseClient = supabase;

const AuthContext = createContext_a(null);
function useAuth() { return useContext_a(AuthContext); }

function AuthProvider({ children }) {
  const [session, setSession] = useState_a(null);
  const [profile, setProfile] = useState_a(null);
  const [loading, setLoading] = useState_a(true);
  const [pendingConfirmation, setPendingConfirmation] = useState_a(null); // { email } | null

  // initial session check + listener
  useEffect_a(() => {
    if (!supabase) { setLoading(false); return; }
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session || null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess || null);
      if (sess) setPendingConfirmation(null);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  // load profile when session changes
  useEffect_a(() => {
    if (!supabase || !session?.user?.id) { setProfile(null); return; }
    let mounted = true;
    supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) { console.warn('[tiled] profile load failed:', error.message); setProfile(null); return; }
        setProfile(data);
      });
    return () => { mounted = false; };
  }, [session?.user?.id]);

  const currentUser = useMemo_a(() => {
    if (!session || !profile) return null;
    return {
      id: profile.id,
      username: profile.username,
      email: session.user.email,
      name: profile.name,
      avatar: profile.avatar,
      role: profile.role,
      bio: profile.bio || '',
      createdAt: profile.created_at,
    };
  }, [session, profile]);

  const login = async (identifier, password, remember = true) => {
    if (!supabase) return { ok: false, error: 'Auth not configured.' };
    sessionMode.remember = !!remember;
    const id = identifier.trim();
    let email = id;

    // username login: resolve to email via security-definer RPC
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id)) {
      const { data, error } = await supabase.rpc('get_email_for_username', { uname: id });
      if (error || !data) {
        return { ok: false, error: 'No account found for that email or username.' };
      }
      email = data;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { ok: false, error: friendlyAuthError(error) };
    }
    return { ok: true };
  };

  const signup = async ({ username, email, password, remember = true }) => {
    if (!supabase) return { ok: false, error: 'Auth not configured.' };
    sessionMode.remember = !!remember;

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

    const { data, error } = await supabase.auth.signUp({
      email: e,
      password,
      options: { data: { username: u.toLowerCase() } },
    });
    if (error) return { ok: false, error: friendlyAuthError(error) };

    // If email confirmation is enabled, supabase returns a user but no session.
    if (data.user && !data.session) {
      setPendingConfirmation({ email: e });
      return { ok: true, needsConfirmation: true };
    }
    return { ok: true };
  };

  const logout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null); setProfile(null);
  };

  const value = { currentUser, login, signup, logout, loading, pendingConfirmation };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function friendlyAuthError(error) {
  const m = (error?.message || '').toLowerCase();
  if (m.includes('invalid login')) return 'Email/username and password don\'t match.';
  if (m.includes('already registered')) return 'An account with that email already exists.';
  if (m.includes('rate limit')) return 'Too many attempts — wait a moment and try again.';
  if (m.includes('email not confirmed')) return 'Confirm your email address before signing in.';
  return error?.message || 'Something went wrong. Try again.';
}

function AuthGate({ children }) {
  const { currentUser, loading } = useAuth();
  if (loading) return <AuthLoading />;
  if (!currentUser) return <AuthScreen />;
  return children;
}

function AuthLoading() {
  return (
    <div className="ti-auth-root">
      <div className="ti-auth-bg" />
      <div className="ti-auth-loading">
        <div className="ti-logo ti-auth-logo">
          <span className="ti-logo-mark"><span /><span /><span /><span /></span>
          <span className="ti-logo-word">Tiled</span>
        </div>
        <div className="ti-auth-loading-bar"><span /></div>
      </div>
    </div>
  );
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

function AuthScreen() {
  const [tab, setTab] = useState_a('login'); // 'login' | 'signup'
  const { pendingConfirmation } = useAuth();
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
        {pendingConfirmation && (
          <div className="ti-auth-info">
            We sent a confirmation link to <b>{pendingConfirmation.email}</b>. Click it to finish creating your account.
          </div>
        )}
        {tab === 'login' ? <LoginForm onSwitch={() => setTab('signup')} /> : <SignupForm onSwitch={() => setTab('login')} />}
        <footer className="ti-auth-ft">
          <div className="ti-auth-ft-line">
            <span className="ti-auth-ft-eyebrow">Hosted on Supabase</span>
            <span>Sessions are real — sign in on any device, see the same account.</span>
          </div>
          <div className="ti-auth-ft-note">
            Tiles, comments, likes, and notifications are still local while we finish migrating the data layer.
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
  const [busy, setBusy] = useState_a(false);

  const submit = async (e) => {
    e?.preventDefault();
    setError(null);
    if (!identifier.trim() || !password) {
      setError('Enter your email/username and password.');
      return;
    }
    setBusy(true);
    const r = await login(identifier, password, remember);
    setBusy(false);
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
      <button className="ti-auth-submit" type="submit" disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
      <div className="ti-auth-switch">
        New to Tiled? <button type="button" onClick={onSwitch}>Create an account</button>
      </div>
    </form>
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
  const [busy, setBusy] = useState_a(false);

  const checks = validatePassword(password);
  const allOk = checks.every(c => c.ok);

  const submit = async (e) => {
    e?.preventDefault();
    setError(null);
    setTouched(true);
    setBusy(true);
    const r = await signup({ username, email, password, remember });
    setBusy(false);
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
      <button className="ti-auth-submit" type="submit"
              disabled={busy || !allOk || !username.trim() || !email.trim()}>
        {busy ? 'Creating account…' : 'Create account'}
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

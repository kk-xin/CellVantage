import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang, LANGUAGES } from '../context/LanguageContext';

const I18N = {
  en: {
    title:       'CellVantage',
    username:    'Username',
    password:    'Password',
    login:       'Login',
    loggingIn:   'Logging in...',
    noAccount:   "Don't have an account?",
    registerHere:'Register here',
    error:       'Login failed',
  },
  zh: {
    title:       'CellVantage',
    username:    '用户名',
    password:    '密码',
    login:       '登录',
    loggingIn:   '登录中...',
    noAccount:   '还没有账号？',
    registerHere:'点击注册',
    error:       '登录失败',
  },
  de: {
    title:       'CellVantage',
    username:    'Benutzername',
    password:    'Passwort',
    login:       'Anmelden',
    loggingIn:   'Anmeldung läuft...',
    noAccount:   'Noch kein Konto?',
    registerHere:'Hier registrieren',
    error:       'Anmeldung fehlgeschlagen',
  }
};

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const { lang, changeLang } = useLang();
  const navigate = useNavigate();
  const t = I18N[lang];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const userData = await login(username, password);
      navigate(userData.role === 'admin' ? '/dashboard' : '/cells');
    } catch (err) {
      setError(err.response?.data?.message || t.error);
    } finally {
      setLoading(false);
    }
  };

  const labelStyle = { display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' };

  return (
    <div style={{ maxWidth: '380px', margin: '100px auto', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '32px' }}>

      {/* 语言切换 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginBottom: '20px' }}>
        {LANGUAGES.map(l => (
          <span key={l.code} onClick={() => changeLang(l.code)}
            style={{ fontSize: '12px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', cursor: 'pointer',
              background: lang === l.code ? '#0A84FF' : 'var(--bg-surface-raised)',
              color: lang === l.code ? 'white' : 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)' }}>
            {l.short}
          </span>
        ))}
      </div>

      <h1 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '24px' }}>{t.title}</h1>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>{t.username}</label>
          <input type="text" value={username} onChange={e => setUsername(e.target.value)} required style={{ width: '100%' }} />
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>{t.password}</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={{ width: '100%' }} />
        </div>
        {error && <p style={{ color: 'var(--state-danger)', fontSize: '13px', marginBottom: '12px' }}>{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%' }}>
          {loading ? t.loggingIn : t.login}
        </button>
      </form>
      <p style={{ marginTop: '18px', fontSize: '13px', color: 'var(--text-secondary)' }}>
        {t.noAccount} <Link to="/register">{t.registerHere}</Link>
      </p>
    </div>
  );
}

export default Login;

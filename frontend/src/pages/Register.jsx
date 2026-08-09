import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang, LANGUAGES } from '../context/LanguageContext';
import axios from 'axios';

const I18N = {
  en: {
    title:          'Create account',
    username:       'Username',
    email:          'Email',
    password:       'Password',
    register:       'Register',
    registering:    'Creating account...',
    hasAccount:     'Already have an account?',
    loginHere:      'Login here',
    error:          'Registration failed',
  },
  zh: {
    title:          '创建账号',
    username:       '用户名',
    email:          '邮箱',
    password:       '密码',
    register:       '注册',
    registering:    '注册中...',
    hasAccount:     '已有账号？',
    loginHere:      '点击登录',
    error:          '注册失败',
  },
  de: {
    title:          'Konto erstellen',
    username:       'Benutzername',
    email:          'E-Mail',
    password:       'Passwort',
    register:       'Registrieren',
    registering:    'Konto wird erstellt...',
    hasAccount:     'Bereits ein Konto?',
    loginHere:      'Hier anmelden',
    error:          'Registrierung fehlgeschlagen',
  }
};

function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
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
      await axios.post('http://localhost:3000/api/auth/register', { username, password, email });
      await login(username, password);
      navigate('/cells');
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
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>{t.email}</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%' }} />
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>{t.password}</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={{ width: '100%' }} />
        </div>
        {error && <p style={{ color: 'var(--state-danger)', fontSize: '13px', marginBottom: '12px' }}>{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%' }}>
          {loading ? t.registering : t.register}
        </button>
      </form>
      <p style={{ marginTop: '18px', fontSize: '13px', color: 'var(--text-secondary)' }}>
        {t.hasAccount} <Link to="/login">{t.loginHere}</Link>
      </p>
    </div>
  );
}

export default Register;
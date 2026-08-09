import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang, LANGUAGES } from '../context/LanguageContext';

const NAV_I18N = {
  en: { cells: 'Cells', dashboard: 'Dashboard', importCells: 'Import Cells', users: 'Users', logout: 'Logout' },
  zh: { cells: '电池列表', dashboard: '仪表盘', importCells: '导入电池', users: '用户管理', logout: '退出登录' },
  de: { cells: 'Zellen', dashboard: 'Dashboard', importCells: 'Zellen importieren', users: 'Benutzerverwaltung', logout: 'Abmelden' }
};

function Navbar() {
    const { user, logout } = useAuth();
    const { lang, changeLang } = useLang();
    const location = useLocation();
    const [showLangMenu, setShowLangMenu] = useState(false);
    const langRef = useRef(null);
    const t = NAV_I18N[lang];

    useEffect(() => {
        function handleClick(e) {
            if (langRef.current && !langRef.current.contains(e.target)) setShowLangMenu(false);
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    if (!user) return null;

    const isActive = (path) => {
        const { pathname } = location;
        if (path === '/cells') return pathname === '/cells' || (pathname.startsWith('/cells/') && !pathname.startsWith('/cells/import'));
        return pathname === path || pathname.startsWith(path + '/');
    };

    const linkStyle = (path) => ({
        color: isActive(path) ? '#1D1D1F' : '#6E6E73',
        fontSize: '14px', fontWeight: 500, padding: '6px 2px',
        textDecoration: 'none',
        borderBottom: isActive(path) ? '2px solid #0A84FF' : '2px solid transparent',
        outline: 'none', transition: 'color 0.15s ease'
    });

    const currentLang = LANGUAGES.find(l => l.code === lang);

    return (
        <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '0 24px', height: '56px', backgroundColor: '#F5F5F7',
            borderBottom: '1px solid #E5E5EA', marginBottom: '28px' }}>
            <div style={{ display: 'flex', gap: '28px', alignItems: 'center' }}>
                <span style={{ fontSize: '15px', fontWeight: 600, color: '#1D1D1F' }}>CellVantage</span>
                <Link to="/cells" style={linkStyle('/cells')}>{t.cells}</Link>
                {user.role === 'admin' && <Link to="/dashboard" style={linkStyle('/dashboard')}>{t.dashboard}</Link>}
                {user.role === 'quality_engineer' && <Link to="/cells/import" style={linkStyle('/cells/import')}>{t.importCells}</Link>}
                {user.role === 'admin' && <Link to="/users" style={linkStyle('/users')}>{t.users}</Link>}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span style={{ fontSize: '13px', color: '#6E6E73' }}>
                    {user.username} <span style={{ color: '#AEAEB2' }}>· {user.role}</span>
                </span>

                <div ref={langRef} style={{ position: 'relative' }}>
                    <button onClick={() => setShowLangMenu(v => !v)}
                        style={{ display: 'flex', alignItems: 'center', gap: '5px',
                            padding: '5px 10px', fontSize: '13px', fontWeight: 500,
                            border: '1px solid #E5E5EA', borderRadius: '6px',
                            background: 'white', color: '#1D1D1F', cursor: 'pointer' }}>
                        🌐 {currentLang?.short}
                    </button>
                    {showLangMenu && (
                        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                            background: 'white', border: '1px solid #E5E5EA', borderRadius: '8px',
                            boxShadow: '0 4px 16px rgba(0,0,0,0.10)', overflow: 'hidden', zIndex: 1000, minWidth: '120px' }}>
                            {LANGUAGES.map(l => (
                                <div key={l.code} onClick={() => { changeLang(l.code); setShowLangMenu(false); }}
                                    style={{ padding: '9px 14px', fontSize: '13px', cursor: 'pointer',
                                        color: lang === l.code ? '#0A84FF' : '#1D1D1F',
                                        fontWeight: lang === l.code ? 600 : 400,
                                        background: lang === l.code ? '#EAF2FF' : 'transparent',
                                        display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {lang === l.code && <span style={{ color: '#0A84FF' }}>✓</span>}
                                    {l.label}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <button onClick={logout} style={{ padding: '6px 14px', fontSize: '13px' }}>{t.logout}</button>
            </div>
        </nav>
    );
}

export default Navbar;

import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Navbar() {
    const { user, logout } = useAuth();
    const location = useLocation();

    if (!user) return null;

    const isActive = (path) => {
        const { pathname } = location;
        if (path === '/cells') {
            return pathname === '/cells' || (pathname.startsWith('/cells/') && !pathname.startsWith('/cells/import'));
        }
        return pathname === path || pathname.startsWith(path + '/');
    };

    const linkStyle = (path) => ({
        color: isActive(path) ? '#1D1D1F' : '#6E6E73',
        fontSize: '14px',
        fontWeight: 500,
        padding: '6px 2px',
        textDecoration: 'none',
        borderBottom: isActive(path) ? '2px solid #0A84FF' : '2px solid transparent',
        outline: 'none',
        transition: 'color 0.15s ease'
    });

    return (
        <nav style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0 24px',
            height: '56px',
            backgroundColor: '#F5F5F7',
            borderBottom: '1px solid #E5E5EA',
            marginBottom: '28px'
        }}>
            <div style={{ display: 'flex', gap: '28px', alignItems: 'center' }}>
                <span style={{
                    fontSize: '15px',
                    fontWeight: 600,
                    color: '#1D1D1F'
                }}>
                    CellVantage
                </span>

                <Link to="/cells" style={linkStyle('/cells')}>Cells</Link>

                {user.role === 'admin' && (
                    <Link to="/dashboard" style={linkStyle('/dashboard')}>Dashboard</Link>
                )}

                {user.role === 'quality_engineer' && (
                    <Link to="/cells/import" style={linkStyle('/cells/import')}>Import Cells</Link>
                )}

                {user.role === 'admin' && (
                    <Link to="/users" style={linkStyle('/users')}>Users</Link>
                )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span style={{ fontSize: '13px', color: '#6E6E73' }}>
                    {user.username} <span style={{ color: '#AEAEB2' }}>· {user.role}</span>
                </span>
                <button onClick={logout} style={{ padding: '6px 14px', fontSize: '13px' }}>
                    Logout
                </button>
            </div>
        </nav>
    );
}

export default Navbar;

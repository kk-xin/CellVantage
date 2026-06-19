import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Navbar() {
  const { user, logout } = useAuth();

  if (!user) return null;  // Don't show navbar if not logged in

  return (
    <nav style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '15px 20px',
      borderBottom: '1px solid #ccc',
      marginBottom: '20px'
    }}>
      <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
        <strong>CellVantage</strong>

        <Link to="/cells">Cells</Link>

        {user.role === 'admin' && (
          <Link to="/dashboard">Dashboard</Link>
        )}

        {user.role === 'quality_engineer' && (
          <Link to="/cells/import">Import Cells</Link>
        )}
      </div>

      <div>
        <span style={{ marginRight: '15px' }}>
          {user.username} ({user.role})
        </span>
        <button onClick={logout}>Logout</button>
      </div>
    </nav>
  );
}

export default Navbar;
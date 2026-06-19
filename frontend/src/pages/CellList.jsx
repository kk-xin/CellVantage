import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

function CellList() {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();

  const [cells, setCells] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCells();
  }, []);

  const fetchCells = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/cells', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCells(res.data.data);
    } catch (err) {
      setError('Failed to load cells');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <p>Loading cells...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Cells</h1>
        <div>
          <span style={{ marginRight: '15px' }}>Welcome, {user?.username} ({user?.role})</span>
          <button onClick={logout}>Logout</button>
        </div>
      </div>

      <table border="1" cellPadding="8" style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
        <thead>
          <tr>
            <th>Cell Code</th>
            <th>Model</th>
            <th>Batch Number</th>
            <th>Current State</th>
            <th>Created At</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {cells.map((cell) => (
            <tr key={cell.id}>
              <td>{cell.cell_code}</td>
              <td>{cell.model}</td>
              <td>{cell.batch_number}</td>
              <td>{cell.current_state}</td>
              <td>{new Date(cell.created_at).toLocaleDateString()}</td>
              <td>
                <button onClick={() => navigate(`/cells/${cell.id}`)}>
                  View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {cells.length === 0 && (
        <p>
          {user?.role === 'system'
            ? 'Your account is pending role assignment by an administrator.'
            : 'No cells found.'}
        </p>
      )}
    </div>
  );
}

export default CellList;
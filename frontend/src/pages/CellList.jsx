import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

function CellList() {
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [cells, setCells] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');

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

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedCells = [...cells].sort((a, b) => {
    if (!sortField) return 0;

    let valA = a[sortField];
    let valB = b[sortField];

    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();

    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const renderArrow = (field) => {
  if (sortField !== field) return ' ⇅';  // 还没排序时，显示一个中性的双向箭头
  return sortDirection === 'asc' ? ' ▲' : ' ▼';
};

  if (loading) return <p>Loading cells...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;

  return (
    <div>
      <h1>Cells</h1>

      <table border="1" cellPadding="8" style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px', tableLayout: 'fixed' }}>
        <thead>
          <tr>
            <th onClick={() => handleSort('cell_code')} style={{ cursor: 'pointer' }}>
              Cell Code{renderArrow('cell_code')}
            </th>
            <th onClick={() => handleSort('model')} style={{ cursor: 'pointer' }}>
              Model{renderArrow('model')}
            </th>
            <th onClick={() => handleSort('batch_number')} style={{ cursor: 'pointer' }}>
              Batch Number{renderArrow('batch_number')}
            </th>
            <th onClick={() => handleSort('current_state')} style={{ cursor: 'pointer' }}>
              Current State{renderArrow('current_state')}
            </th>
            <th onClick={() => handleSort('created_at')} style={{ cursor: 'pointer' }}>
              Created At{renderArrow('created_at')}
            </th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {sortedCells.map((cell) => (
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
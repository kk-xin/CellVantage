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
  const [hoveredCell, setHoveredCell] = useState(null);

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

  // 检查Cell信息是否完整
  const requiredFields = ['model', 'capacity_rated', 'voltage_nominal', 'manufacture_date'];
  const fieldLabels = {
    model: 'Model',
    capacity_rated: 'Rated Capacity',
    voltage_nominal: 'Nominal Voltage',
    manufacture_date: 'Manufacturing Date'
  };

  const getMissingFields = (cell) => {
    return requiredFields
      .filter((field) => !cell[field] || cell[field] === '')
      .map((field) => fieldLabels[field]);
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

  const thStyle = { cursor: 'pointer', padding: '8px', border: '1px solid #ccc', textAlign: 'left' };
  const tdStyle = { padding: '8px', border: '1px solid #ccc', height: '20px', lineHeight: '20px', verticalAlign: 'middle' };

  return (
    <div>
      <h1>Cells</h1>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px', tableLayout: 'fixed' }}>
        <thead>
          <tr>
            <th onClick={() => handleSort('cell_code')} style={thStyle}>
              Cell Code{renderArrow('cell_code')}
            </th>
            <th onClick={() => handleSort('model')} style={thStyle}>
              Model{renderArrow('model')}
            </th>
            <th onClick={() => handleSort('batch_number')} style={thStyle}>
              Batch Number{renderArrow('batch_number')}
            </th>
            <th onClick={() => handleSort('current_state')} style={thStyle}>
              Current State{renderArrow('current_state')}
            </th>
            <th onClick={() => handleSort('created_at')} style={thStyle}>
              Created At{renderArrow('created_at')}
            </th>
            <th style={thStyle}>Action</th>
          </tr>
        </thead>
        <tbody>
          {sortedCells.map((cell) => {
            const missing = getMissingFields(cell);
            const incomplete = missing.length > 0;

            return (
              <tr key={cell.id} style={{ backgroundColor: incomplete ? '#fff3cd' : 'transparent' }}>
                <td style={tdStyle}>
                  {cell.cell_code}
                  {incomplete && (
                    <span
                      onMouseEnter={() => setHoveredCell(cell.id)}
                      onMouseLeave={() => setHoveredCell(null)}
                      title={`Missing: ${missing.join(', ')}`}
                      style={{
                        color: 'red',
                        marginLeft: '8px',
                        cursor: 'pointer',
                        position: 'relative',
                        fontSize: '14px',
                        lineHeight: '20px',
                        verticalAlign: 'middle'
                      }}
                    >
                      ⚠️
                      {hoveredCell === cell.id && (
                        <span style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          backgroundColor: '#333',
                          color: 'white',
                          padding: '6px 10px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          whiteSpace: 'nowrap',
                          zIndex: 100
                        }}>
                          Missing: {missing.join(', ')}
                        </span>
                      )}
                    </span>
                  )}
                </td>
                <td style={tdStyle}>{cell.model || <span style={{ color: '#999' }}>—</span>}</td>
                <td style={tdStyle}>{cell.batch_number}</td>
                <td style={tdStyle}>{cell.current_state}</td>
                <td style={tdStyle}>{new Date(cell.created_at).toLocaleDateString()}</td>
                <td style={tdStyle}>
                  <button onClick={() => navigate(`/cells/${cell.id}`)}>
                    View
                  </button>
                </td>
              </tr>
            );
          })}
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

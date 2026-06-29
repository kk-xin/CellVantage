import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const STATUS_STYLES = {
  Received:      { color: '#6E6E73', bg: '#F2F2F7' },
  'Incoming QC': { color: '#FF9500', bg: 'var(--state-warning-soft)' },
  Storage:       { color: '#0A84FF', bg: 'var(--accent-soft)' },
  'Under Test':  { color: '#FF9500', bg: 'var(--state-warning-soft)' },
  Passed:        { color: '#1E8E3E', bg: 'var(--state-success-soft)' },
  Failed:        { color: '#D70015', bg: 'var(--state-danger-soft)' },
  Disposed:      { color: '#AEAEB2', bg: '#F2F2F7' },
};

function StatusBadge({ state }) {
  const s = STATUS_STYLES[state] || STATUS_STYLES.Received;
  return (
    <span className="status-badge" style={{ backgroundColor: s.bg, color: s.color }}>
      <span className="status-dot" style={{ backgroundColor: s.color }} />
      {state}
    </span>
  );
}

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
    if (sortField !== field) return ' ⇅';
    return sortDirection === 'asc' ? ' ▲' : ' ▼';
  };

  if (loading) return <p style={{ color: 'var(--text-secondary)' }}>Loading cells...</p>;
  if (error) return <p style={{ color: 'var(--state-danger)' }}>{error}</p>;

  const thStyle = {
    cursor: 'pointer',
    padding: '10px 12px',
    fontSize: '12px',
    fontWeight: 600,
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
    textAlign: 'left',
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--bg-surface-raised)',
    borderBottom: '1px solid var(--border-strong)',
    whiteSpace: 'nowrap'
  };
  const tdStyle = {
    padding: '10px 12px',
    borderBottom: '1px solid var(--border-subtle)',
    fontSize: '14px'
  };

  return (
    <div>
      <h1>Cells</h1>

      <div style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden'
      }}>
        <table style={{ tableLayout: 'fixed', width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th onClick={() => handleSort('cell_code')} style={thStyle}>Cell Code{renderArrow('cell_code')}</th>
              <th onClick={() => handleSort('model')} style={thStyle}>Model{renderArrow('model')}</th>
              <th onClick={() => handleSort('batch_number')} style={thStyle}>Batch Number{renderArrow('batch_number')}</th>
              <th onClick={() => handleSort('current_state')} style={thStyle}>Current State{renderArrow('current_state')}</th>
              <th onClick={() => handleSort('created_at')} style={thStyle}>Created At{renderArrow('created_at')}</th>
              <th style={{ ...thStyle, cursor: 'default' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {sortedCells.map((cell, idx) => {
              const missing = getMissingFields(cell);
              const incomplete = missing.length > 0;
              const isLast = idx === sortedCells.length - 1;

              return (
                <tr key={cell.id} style={{ backgroundColor: incomplete ? 'var(--state-warning-soft)' : 'transparent' }}>
                  <td style={{ ...tdStyle, borderBottom: isLast ? 'none' : tdStyle.borderBottom, height: '20px', lineHeight: '20px', verticalAlign: 'middle' }}>
                    <span className="mono">{cell.cell_code}</span>
                    {incomplete && (
                      <span
                        onMouseEnter={() => setHoveredCell(cell.id)}
                        onMouseLeave={() => setHoveredCell(null)}
                        title={`Missing: ${missing.join(', ')}`}
                        style={{
                          color: 'var(--state-warning)',
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
                            backgroundColor: '#1D1D1F',
                            color: '#FFFFFF',
                            padding: '6px 10px',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '12px',
                            fontWeight: 400,
                            whiteSpace: 'nowrap',
                            zIndex: 100
                          }}>
                            Missing: {missing.join(', ')}
                          </span>
                        )}
                      </span>
                    )}
                  </td>
                  <td style={{ ...tdStyle, borderBottom: isLast ? 'none' : tdStyle.borderBottom }}>
                    {cell.model || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td className="mono" style={{ ...tdStyle, borderBottom: isLast ? 'none' : tdStyle.borderBottom, color: 'var(--text-secondary)' }}>
                    {cell.batch_number}
                  </td>
                  <td style={{ ...tdStyle, borderBottom: isLast ? 'none' : tdStyle.borderBottom }}>
                    <StatusBadge state={cell.current_state} />
                  </td>
                  <td style={{ ...tdStyle, borderBottom: isLast ? 'none' : tdStyle.borderBottom, color: 'var(--text-secondary)' }}>
                    {new Date(cell.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ ...tdStyle, borderBottom: isLast ? 'none' : tdStyle.borderBottom }}>
                    <button onClick={() => navigate(`/cells/${cell.id}`)}>View</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {cells.length === 0 && (
        <p style={{ color: 'var(--text-secondary)' }}>
          {user?.role === 'system'
            ? 'Your account is pending role assignment by an administrator.'
            : 'No cells found.'}
        </p>
      )}
    </div>
  );
}

export default CellList;

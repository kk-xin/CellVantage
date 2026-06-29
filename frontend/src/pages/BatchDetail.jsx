import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const STATE_COLORS = {
  Received: '#6E6E73',
  'Incoming QC': '#FF9500',
  Storage: '#0A84FF',
  'Under Test': '#FF9500',
  Passed: '#1E8E3E',
  Failed: '#D70015',
  Disposed: '#AEAEB2'
};

function BatchDetail() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [batch, setBatch] = useState(null);
  const [grouped, setGrouped] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const res = await axios.get(
        `http://localhost:3000/api/batches/${id}/cells-by-state`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setBatch(res.data.data.batch);
      setGrouped(res.data.data.grouped);
    } catch (err) {
      setError('Failed to load batch details');
    } finally {
      setLoading(false);
    }
  };

  if (user?.role !== 'admin') {
    return <p style={{ color: 'var(--text-secondary)' }}>You do not have permission to view this page.</p>;
  }

  if (loading) return <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>;
  if (error) return <p style={{ color: 'var(--state-danger)' }}>{error}</p>;

  const states = Object.keys(grouped);

  return (
    <div>
      <button onClick={() => navigate('/dashboard')} style={{ marginBottom: '16px' }}>← Back to Dashboard</button>

      <h1 className="mono">{batch.batch_number}</h1>
      <p><span style={{ color: 'var(--text-secondary)' }}>Supplier:</span> {batch.supplier}</p>
      <p><span style={{ color: 'var(--text-secondary)' }}>Total Quantity:</span> {batch.total_quantity}</p>

      {states.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>No cells found in this batch.</p>}

      {states.map((state) => (
        <div key={state} style={{ marginTop: '28px' }}>
          <h3 style={{ color: STATE_COLORS[state] || 'var(--text-primary)', fontSize: '14px', fontWeight: 600 }}>
            {state} ({grouped[state].length})
          </h3>

          <table style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th>Cell Code</th>
                <th>Model</th>
                <th style={{ cursor: 'default' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {grouped[state].map((cell) => (
                <tr key={cell.id}>
                  <td className="mono">{cell.cell_code}</td>
                  <td>{cell.model}</td>
                  <td>
                    <button onClick={() => navigate(`/cells/${cell.id}`)}>
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

export default BatchDetail;

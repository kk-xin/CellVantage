import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

// Color coding per state, similar idea to the timeline event colors
const STATE_COLORS = {
  Received: '#999',
  'Incoming QC': '#2196f3',
  Storage: '#9c27b0',
  'Under Test': '#ff9800',
  Passed: '#4caf50',
  Failed: '#f44336',
  Disposed: '#000'
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
    return <p>You do not have permission to view this page.</p>;
  }

  if (loading) return <p>Loading...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;

  // Get all states that actually have cells in this batch
  const states = Object.keys(grouped);

  return (
    <div>
      <button onClick={() => navigate('/dashboard')}>← Back to Dashboard</button>

      <h1>{batch.batch_number}</h1>
      <p><strong>Supplier:</strong> {batch.supplier}</p>
      <p><strong>Total Quantity:</strong> {batch.total_quantity}</p>

      {states.length === 0 && <p>No cells found in this batch.</p>}

      {states.map((state) => (
        <div key={state} style={{ marginTop: '25px' }}>
          <h3 style={{ color: STATE_COLORS[state] || '#000' }}>
            {state} ({grouped[state].length})
          </h3>

          <table border="1" cellPadding="6" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>Cell Code</th>
                <th>Model</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {grouped[state].map((cell) => (
                <tr key={cell.id}>
                  <td>{cell.cell_code}</td>
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
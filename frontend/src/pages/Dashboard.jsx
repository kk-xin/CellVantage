import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

function Dashboard() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [stateSummary, setStateSummary] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };

      const [summaryRes, batchesRes] = await Promise.all([
        axios.get('http://localhost:3000/api/cells/dashboard/summary', { headers }),
        axios.get('http://localhost:3000/api/batches', { headers })
      ]);

      setStateSummary(summaryRes.data.data);
      setBatches(batchesRes.data.data);

    } catch (err) {
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <p style={{ color: 'var(--text-secondary)' }}>Loading dashboard...</p>;
  if (error) return <p style={{ color: 'var(--state-danger)' }}>{error}</p>;

  return (
    <div>
      <h1>Dashboard</h1>

      <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px' }}>
        Cells by state
      </h2>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '32px' }}>
        {stateSummary.map((item) => (
          <div
            key={item.current_state}
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '16px 20px',
              minWidth: '140px'
            }}
          >
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 6px' }}>
              {item.current_state}
            </p>
            <p style={{ fontSize: '24px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
              {item.count}
            </p>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px' }}>
        Batches
      </h2>
      <table style={{ tableLayout: 'fixed' }}>
        <thead>
          <tr>
            <th>Batch Number</th>
            <th>Supplier</th>
            <th>Delivery Date</th>
            <th>Cell Count</th>
            <th style={{ cursor: 'default' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {batches.map((batch) => (
            <tr key={batch.id}>
              <td className="mono">{batch.batch_number}</td>
              <td>{batch.supplier}</td>
              <td style={{ color: 'var(--text-secondary)' }}>{batch.delivery_date}</td>
              <td>{batch.cell_count}</td>
              <td>
                <button onClick={() => navigate(`/batches/${batch.id}`)}>
                  View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Dashboard;

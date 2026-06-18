import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

function Dashboard() {
  const { token, logout, user } = useAuth();
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

      // Fetch cell state summary and batches in parallel
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

  if (loading) return <p>Loading dashboard...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Dashboard</h1>
        <div>
          <span style={{ marginRight: '15px' }}>Welcome, {user?.username}</span>
          <button onClick={logout}>Logout</button>
        </div>
      </div>

      <h2>Cells by State</h2>
      <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
        {stateSummary.map((item) => (
          <div
            key={item.current_state}
            style={{
              border: '1px solid #ccc',
              borderRadius: '8px',
              padding: '20px',
              minWidth: '150px',
              textAlign: 'center'
            }}
          >
            <h3>{item.current_state}</h3>
            <p style={{ fontSize: '24px', fontWeight: 'bold' }}>{item.count}</p>
          </div>
        ))}
      </div>

      <h2>Batches</h2>
      <table border="1" cellPadding="8" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>Batch Number</th>
            <th>Supplier</th>
            <th>Delivery Date</th>
            <th>Cell Count</th>
          </tr>
        </thead>
        <tbody>
          {batches.map((batch) => (
            <tr key={batch.id}>
              <td>{batch.batch_number}</td>
              <td>{batch.supplier}</td>
              <td>{batch.delivery_date}</td>
              <td>{batch.cell_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Dashboard;
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

function CellDetail() {
  const { id } = useParams();           // Get cell id from URL
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [cell, setCell] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [newState, setNewState] = useState('');
  const [notes, setNotes] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchCellData();
  }, [id]);   // Re-fetch if the id in the URL changes

  const fetchCellData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };

      const [cellRes, historyRes] = await Promise.all([
        axios.get(`http://localhost:3000/api/cells/${id}`, { headers }),
        axios.get(`http://localhost:3000/api/cells/${id}/history`, { headers })
      ]);

      setCell(cellRes.data.data);
      setHistory(historyRes.data.data);

    } catch (err) {
      setError('Failed to load cell details');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateState = async (e) => {
    e.preventDefault();
    setUpdating(true);

    try {
      await axios.patch(
        `http://localhost:3000/api/cells/${id}/state`,
        { new_state: newState, notes },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Refresh data after successful update
      setNewState('');
      setNotes('');
      await fetchCellData();

    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update state');
    } finally {
      setUpdating(false);
    }
  };

  // Map each role to the states they're allowed to set
  const roleOptions = {
    quality_engineer: ['Incoming QC', 'Failed'],
    warehouse_staff:  ['Storage'],
    lab_operator:     ['Under Test', 'Passed', 'Failed'],
    admin:            ['Disposed']
  };

  const myOptions = roleOptions[user?.role] || [];

  if (loading) return <p>Loading...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;

  return (
    <div>
      <button onClick={() => navigate('/cells')}>← Back to list</button>

      <h1>{cell.cell_code}</h1>
      <p><strong>Model:</strong> {cell.model}</p>
      <p><strong>Batch:</strong> {cell.batch_number} ({cell.batch_supplier})</p>
      <p><strong>Current State:</strong> {cell.current_state}</p>

      {myOptions.length > 0 && (
        <div style={{ border: '1px solid #ccc', padding: '15px', marginTop: '20px' }}>
          <h3>Update State</h3>
          <form onSubmit={handleUpdateState}>
            <select
              value={newState}
              onChange={(e) => setNewState(e.target.value)}
              required
              style={{ marginRight: '10px' }}
            >
              <option value="">Select new state</option>
              {myOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>

            <input
              type="text"
              placeholder="Notes (required)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              required
              style={{ width: '300px', marginRight: '10px' }}
            />

            <button type="submit" disabled={updating}>
              {updating ? 'Updating...' : 'Update'}
            </button>
          </form>
        </div>
      )}

      <h2 style={{ marginTop: '30px' }}>Timeline</h2>
      <div>
        {history.map((event) => (
          <div
            key={event.id}
            style={{
              borderLeft: '3px solid #4caf50',
              paddingLeft: '15px',
              marginBottom: '15px'
            }}
          >
            <p><strong>{event.event_type}</strong> — {new Date(event.created_at).toLocaleString()}</p>
            <p>{event.changed_from ? `${event.changed_from} → ${event.changed_to}` : event.changed_to}</p>
            <p>By: {event.operator_name}</p>
            <p>Notes: {event.notes}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default CellDetail;
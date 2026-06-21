import axios from 'axios';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Convert any date string to YYYY-MM-DD format for <input type="date">
function formatDateForInput(dateStr) {
  if (!dateStr) return '';
  return dateStr.split('T')[0];
}

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

  const [editMode, setEditMode] = useState(false);
  const [editModel, setEditModel] = useState('');
  const [editCapacity, setEditCapacity] = useState('');
  const [editVoltage, setEditVoltage] = useState('');
  const [editManufactureDate, setEditManufactureDate] = useState('');

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
      console.log('manufacture_date raw value:', cellRes.data.data.manufacture_date);
      setEditModel(cellRes.data.data.model || '');
      setEditCapacity(cellRes.data.data.capacity_rated || '');
      setEditVoltage(cellRes.data.data.voltage_nominal || '');
      setEditManufactureDate(formatDateForInput(cellRes.data.data.manufacture_date));
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

  const handleEditSubmit = async (e) => {
    e.preventDefault();

    try {
      await axios.patch(
        `http://localhost:3000/api/cells/${id}`,
        {
          model: editModel,
          capacity_rated: editCapacity,
          voltage_nominal: editVoltage,
          manufacture_date: editManufactureDate
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setEditMode(false);
      await fetchCellData();

    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update cell info');
    }
  };

  // Map each role to the FROM → TO transitions they're allowed to perform
  const roleOptions = {
    quality_engineer: {
      'Received': ['Incoming QC', 'Failed']
    },
    warehouse_staff: {
      'Incoming QC': ['Storage']
    },
    lab_operator: {
      'Storage': ['Under Test'],
      'Under Test': ['Passed', 'Failed']
    },
    disposal_manager: {
      'Failed': ['Disposed']
    }
  };

  const myOptions = roleOptions[user?.role]?.[cell?.current_state] || [];

  if (loading) return <p>Loading...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;

  return (
    <div>
      <button onClick={() => navigate('/cells')}>← Back to list</button>

      <h1>{cell.cell_code}</h1>
      {user?.role === 'quality_engineer' && (
        <button onClick={() => setEditMode(!editMode)} style={{ marginBottom: '10px' }}>
          {editMode ? 'Cancel' : 'Edit Info'}
        </button>
      )}

      {editMode ? (
        <form onSubmit={handleEditSubmit} style={{ border: '1px solid #ccc', padding: '15px', marginBottom: '15px' }}>
          <div style={{ marginBottom: '10px' }}>
            <label>Model</label>
            <input
              type="text"
              value={editModel}
              onChange={(e) => setEditModel(e.target.value)}
              style={{ width: '100%', padding: '6px' }}
            />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label>Capacity Rated (mAh)</label>
            <input
              type="number"
              value={editCapacity}
              onChange={(e) => setEditCapacity(e.target.value)}
              style={{ width: '100%', padding: '6px' }}
            />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label>Voltage Nominal (V)</label>
            <input
              type="number"
              step="0.01"
              value={editVoltage}
              onChange={(e) => setEditVoltage(e.target.value)}
              style={{ width: '100%', padding: '6px' }}
            />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label>Manufacture Date</label>
            <input
              type="date"
              value={editManufactureDate}
              onChange={(e) => setEditManufactureDate(e.target.value)}
              style={{ width: '100%', padding: '6px' }}
            />
          </div>
          <button type="submit">Save Changes</button>
        </form>
      ) : (
        <div>
          <p><strong>Model:</strong> {cell.model || '(missing)'}</p>
          <p><strong>Capacity:</strong> {cell.capacity_rated ? `${cell.capacity_rated} mAh` : '(missing)'}</p>
          <p><strong>Voltage:</strong> {cell.voltage_nominal ? `${cell.voltage_nominal} V` : '(missing)'}</p>
        </div>
      )}
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
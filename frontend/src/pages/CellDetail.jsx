import axios from 'axios';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function formatDateForInput(dateStr) {
  if (!dateStr) return '';
  return dateStr.split('T')[0];
}

const cardStyle = {
  backgroundColor: 'var(--bg-surface)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
  padding: '20px'
};

function CellDetail() {
  const { id } = useParams();
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
  }, [id]);

  const fetchCellData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };

      const [cellRes, historyRes] = await Promise.all([
        axios.get(`http://localhost:3000/api/cells/${id}`, { headers }),
        axios.get(`http://localhost:3000/api/cells/${id}/history`, { headers })
      ]);

      setCell(cellRes.data.data);
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

  if (loading) return <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>;
  if (error) return <p style={{ color: 'var(--state-danger)' }}>{error}</p>;

  return (
    <div>
      <button onClick={() => navigate('/cells')} style={{ marginBottom: '16px' }}>← Back to list</button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <h1 style={{ margin: 0 }} className="mono">{cell.cell_code}</h1>
        {user?.role === 'quality_engineer' && (
          <button onClick={() => setEditMode(!editMode)}>
            {editMode ? 'Cancel' : 'Edit Info'}
          </button>
        )}
      </div>

      {editMode ? (
        <form onSubmit={handleEditSubmit} style={{ ...cardStyle, marginBottom: '16px' }}>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Model</label>
            <input type="text" value={editModel} onChange={(e) => setEditModel(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Capacity Rated (mAh)</label>
            <input type="number" value={editCapacity} onChange={(e) => setEditCapacity(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Voltage Nominal (V)</label>
            <input type="number" step="0.01" value={editVoltage} onChange={(e) => setEditVoltage(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Manufacture Date</label>
            <input type="date" value={editManufactureDate} onChange={(e) => setEditManufactureDate(e.target.value)} style={{ width: '100%' }} />
          </div>
          <button type="submit" className="btn-primary">Save Changes</button>
        </form>
      ) : (
        <div style={{ ...cardStyle, marginBottom: '16px' }}>
          <p style={{ margin: '0 0 8px' }}><span style={{ color: 'var(--text-secondary)' }}>Model:</span> {cell.model || <span style={{ color: 'var(--text-muted)' }}>(missing)</span>}</p>
          <p style={{ margin: '0 0 8px' }}><span style={{ color: 'var(--text-secondary)' }}>Capacity:</span> {cell.capacity_rated ? `${cell.capacity_rated} mAh` : <span style={{ color: 'var(--text-muted)' }}>(missing)</span>}</p>
          <p style={{ margin: 0 }}><span style={{ color: 'var(--text-secondary)' }}>Voltage:</span> {cell.voltage_nominal ? `${cell.voltage_nominal} V` : <span style={{ color: 'var(--text-muted)' }}>(missing)</span>}</p>
        </div>
      )}

      <p><span style={{ color: 'var(--text-secondary)' }}>Batch:</span> {cell.batch_number} ({cell.batch_supplier})</p>
      <p><span style={{ color: 'var(--text-secondary)' }}>Current State:</span> {cell.current_state}</p>

      {myOptions.length > 0 && (
        <div style={{ ...cardStyle, marginTop: '20px' }}>
          <h3 style={{ marginTop: 0, fontSize: '15px' }}>Update State</h3>
          <form onSubmit={handleUpdateState} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <select value={newState} onChange={(e) => setNewState(e.target.value)} required>
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
              style={{ width: '280px' }}
            />

            <button type="submit" disabled={updating} className="btn-primary">
              {updating ? 'Updating...' : 'Update'}
            </button>
          </form>
        </div>
      )}

      <h2 style={{ marginTop: '32px', fontSize: '16px' }}>Timeline</h2>
      <div>
        {history.map((event) => (
          <div
            key={event.id}
            style={{
              borderLeft: '3px solid var(--accent)',
              paddingLeft: '15px',
              marginBottom: '15px'
            }}
          >
            <p style={{ margin: '0 0 4px' }}><strong>{event.event_type}</strong> — <span style={{ color: 'var(--text-secondary)' }}>{new Date(event.created_at).toLocaleString()}</span></p>
            <p style={{ margin: '0 0 4px' }}>{event.changed_from ? `${event.changed_from} → ${event.changed_to}` : event.changed_to}</p>
            <p style={{ margin: '0 0 4px', color: 'var(--text-secondary)' }}>By: {event.operator_name}</p>
            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Notes: {event.notes}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default CellDetail;

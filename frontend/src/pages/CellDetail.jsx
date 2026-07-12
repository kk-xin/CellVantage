import axios from 'axios';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';

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

const METRICS = [
  { key: 'voltage',             label: 'Voltage (V)',              color: '#0A84FF' },
  { key: 'internal_resistance', label: 'Internal Resistance (mΩ)', color: '#FF9500' },
  { key: 'capacity',            label: 'Capacity (mAh)',           color: '#34C759' },
  { key: 'temperature',         label: 'Temperature (°C)',         color: '#FF3B30' },
];

const THRESHOLDS = {
  internal_resistance: 35,
  temperature: 45,
};

function MetricsChart({ data }) {
  const [activeMetrics, setActiveMetrics] = useState(['voltage', 'internal_resistance']);

  if (!data || data.length === 0) {
    return (
      <div style={{ ...cardStyle, marginTop: '24px' }}>
        <h2 style={{ fontSize: '16px', margin: '0 0 8px' }}>Test Metrics</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>
          No metrics data available for this cell.
        </p>
      </div>
    );
  }

  const chartData = data.map((row, i) => ({
    ...row,
    label: row.cycle_count != null ? `C${row.cycle_count}` : `#${i + 1}`,
    voltage:             row.voltage             != null ? Number(row.voltage)             : null,
    internal_resistance: row.internal_resistance != null ? Number(row.internal_resistance) : null,
    capacity:            row.capacity            != null ? Number(row.capacity)            : null,
    temperature:         row.temperature         != null ? Number(row.temperature)         : null,
  }));

  const toggleMetric = (key) => {
    setActiveMetrics(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const warnings = [];
  chartData.forEach(row => {
    if (row.internal_resistance != null && row.internal_resistance > THRESHOLDS.internal_resistance) {
      warnings.push(`${row.label}: internal resistance ${row.internal_resistance}mΩ exceeds ${THRESHOLDS.internal_resistance}mΩ`);
    }
    if (row.temperature != null && row.temperature > THRESHOLDS.temperature) {
      warnings.push(`${row.label}: temperature ${row.temperature}°C exceeds ${THRESHOLDS.temperature}°C`);
    }
  });

  return (
    <div style={{ ...cardStyle, marginTop: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '16px', margin: 0 }}>Test Metrics</h2>
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          {data.length} record{data.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* 指标切换按钮 */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {METRICS.map(m => (
          <button
            key={m.key}
            onClick={() => toggleMetric(m.key)}
            style={{
              padding: '4px 12px',
              borderRadius: '999px',
              border: `1.5px solid ${activeMetrics.includes(m.key) ? m.color : 'var(--border-strong)'}`,
              background: activeMetrics.includes(m.key) ? m.color + '18' : 'transparent',
              color: activeMetrics.includes(m.key) ? m.color : 'var(--text-secondary)',
              fontSize: '12px', fontWeight: 500, cursor: 'pointer'
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* 折线图 */}
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} width={48} />
          <Tooltip
            contentStyle={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px', fontSize: '12px'
            }}
          />
          <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
          {METRICS.filter(m => activeMetrics.includes(m.key)).map(m => (
            <Line
              key={m.key}
              type="monotone"
              dataKey={m.key}
              name={m.label}
              stroke={m.color}
              strokeWidth={2}
              dot={{ r: 3, fill: m.color }}
              activeDot={{ r: 5 }}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {/* 异常警告 */}
      {warnings.length > 0 && (
        <div style={{
          marginTop: '14px', padding: '10px 14px',
          background: 'var(--state-danger-soft)',
          borderRadius: 'var(--radius-sm)',
          borderLeft: '3px solid var(--state-danger)'
        }}>
          <p style={{ margin: '0 0 6px', fontSize: '12px', fontWeight: 600, color: 'var(--state-danger)' }}>
            ⚠️ Anomalies detected
          </p>
          {warnings.map((w, i) => (
            <p key={i} style={{ margin: '2px 0', fontSize: '12px', color: 'var(--text-secondary)' }}>• {w}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function CellDetail() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [cell, setCell] = useState(null);
  const [history, setHistory] = useState([]);
  const [metrics, setMetrics] = useState([]);
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

      const cellData = cellRes.data.data;
      setCell(cellData);
      setEditModel(cellData.model || '');
      setEditCapacity(cellData.capacity_rated || '');
      setEditVoltage(cellData.voltage_nominal || '');
      setEditManufactureDate(formatDateForInput(cellData.manufacture_date));
      setHistory(historyRes.data.data);

      // 拉取 metrics 数据（用 cell_code 查）
      try {
        const metricsRes = await axios.get(
          `http://localhost:3000/api/metrics/${cellData.cell_code}`,
          { headers }
        );
        setMetrics(metricsRes.data.data || []);
      } catch {
        setMetrics([]);
      }

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
    quality_engineer: { 'Received': ['Incoming QC', 'Failed'] },
    warehouse_staff:  { 'Incoming QC': ['Storage'] },
    lab_operator:     { 'Storage': ['Under Test'], 'Under Test': ['Passed', 'Failed'] },
    disposal_manager: { 'Failed': ['Disposed'] }
  };

  const myOptions = roleOptions[user?.role]?.[cell?.current_state] || [];

  if (loading) return <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>;
  if (error)   return <p style={{ color: 'var(--state-danger)' }}>{error}</p>;

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
            <input type="text" value={editModel} onChange={e => setEditModel(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Capacity Rated (mAh)</label>
            <input type="number" value={editCapacity} onChange={e => setEditCapacity(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Voltage Nominal (V)</label>
            <input type="number" step="0.01" value={editVoltage} onChange={e => setEditVoltage(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Manufacture Date</label>
            <input type="date" value={editManufactureDate} onChange={e => setEditManufactureDate(e.target.value)} style={{ width: '100%' }} />
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

      {/* 测试数据图表 */}
      <MetricsChart data={metrics} />

      {myOptions.length > 0 && (
        <div style={{ ...cardStyle, marginTop: '24px' }}>
          <h3 style={{ marginTop: 0, fontSize: '15px' }}>Update State</h3>
          <form onSubmit={handleUpdateState} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <select value={newState} onChange={e => setNewState(e.target.value)} required>
              <option value="">Select new state</option>
              {myOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Notes (required)"
              value={notes}
              onChange={e => setNotes(e.target.value)}
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
        {history.map(event => (
          <div
            key={event.id}
            style={{ borderLeft: '3px solid var(--accent)', paddingLeft: '15px', marginBottom: '15px' }}
          >
            <p style={{ margin: '0 0 4px' }}>
              <strong>{event.event_type}</strong> — <span style={{ color: 'var(--text-secondary)' }}>{new Date(event.created_at).toLocaleString()}</span>
            </p>
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

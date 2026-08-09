import axios from 'axios';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const I18N = {
  en: {
    backToList:       '← Back to list',
    editInfo:         'Edit Info',
    cancel:           'Cancel',
    saveChanges:      'Save Changes',
    model:            'Model',
    capacity:         'Capacity',
    capacityLabel:    'Capacity Rated (mAh)',
    voltageLabel:     'Voltage Nominal (V)',
    voltage:          'Voltage',
    batch:            'Batch',
    currentState:     'Current State',
    manufactureDate:  'Manufacture Date',
    missing:          '(missing)',
    updateState:      'Update State',
    selectState:      'Select new state',
    notesPlaceholder: 'Notes (required)',
    updating:         'Updating...',
    update:           'Update',
    timeline:         'Timeline',
    by:               'By',
    notes:            'Notes',
    loading:          'Loading...',
    error:            'Failed to load cell details',
    testMetrics:      'Test Metrics',
    noMetrics:        'No metrics data available for this cell.',
    records:          (n) => `${n} record${n !== 1 ? 's' : ''}`,
    anomaliesDetected:'⚠️ Anomalies detected',
    metricLabels: {
      voltage:             'Voltage (V)',
      internal_resistance: 'Internal Resistance (mΩ)',
      capacity:            'Capacity (mAh)',
      temperature:         'Temperature (°C)',
    },
    warningIR:   (label, val, thr) => `${label}: internal resistance ${val}mΩ exceeds ${thr}mΩ`,
    warningTemp: (label, val, thr) => `${label}: temperature ${val}°C exceeds ${thr}°C`,
    states: {
      'Received': 'Received', 'Incoming QC': 'Incoming QC', 'Storage': 'Storage',
      'Under Test': 'Under Test', 'Passed': 'Passed', 'Failed': 'Failed', 'Disposed': 'Disposed'
    }
  },
  zh: {
    backToList:       '← 返回列表',
    editInfo:         '编辑信息',
    cancel:           '取消',
    saveChanges:      '保存更改',
    model:            '型号',
    capacity:         '容量',
    capacityLabel:    '额定容量 (mAh)',
    voltageLabel:     '标称电压 (V)',
    voltage:          '电压',
    batch:            '批次',
    currentState:     '当前状态',
    manufactureDate:  '生产日期',
    missing:          '(缺失)',
    updateState:      '更新状态',
    selectState:      '选择新状态',
    notesPlaceholder: '备注（必填）',
    updating:         '更新中...',
    update:           '更新',
    timeline:         '时间线',
    by:               '操作人',
    notes:            '备注',
    loading:          '加载中...',
    error:            '加载电池详情失败',
    testMetrics:      '测试数据',
    noMetrics:        '该电池暂无测试数据。',
    records:          (n) => `${n} 条记录`,
    anomaliesDetected:'⚠️ 检测到异常',
    metricLabels: {
      voltage:             '电压 (V)',
      internal_resistance: '内阻 (mΩ)',
      capacity:            '容量 (mAh)',
      temperature:         '温度 (°C)',
    },
    warningIR:   (label, val, thr) => `${label}：内阻 ${val}mΩ 超过阈值 ${thr}mΩ`,
    warningTemp: (label, val, thr) => `${label}：温度 ${val}°C 超过阈值 ${thr}°C`,
    states: {
      'Received': '已入库', 'Incoming QC': '质检中', 'Storage': '存储中',
      'Under Test': '测试中', 'Passed': '已通过', 'Failed': '已失败', 'Disposed': '已处置'
    }
  },
  de: {
    backToList:       '← Zurück zur Liste',
    editInfo:         'Info bearbeiten',
    cancel:           'Abbrechen',
    saveChanges:      'Änderungen speichern',
    model:            'Modell',
    capacity:         'Kapazität',
    capacityLabel:    'Nennkapazität (mAh)',
    voltageLabel:     'Nennspannung (V)',
    voltage:          'Spannung',
    batch:            'Charge',
    currentState:     'Aktueller Zustand',
    manufactureDate:  'Herstellungsdatum',
    missing:          '(fehlend)',
    updateState:      'Zustand aktualisieren',
    selectState:      'Neuen Zustand wählen',
    notesPlaceholder: 'Notizen (erforderlich)',
    updating:         'Aktualisierung...',
    update:           'Aktualisieren',
    timeline:         'Zeitverlauf',
    by:               'Von',
    notes:            'Notizen',
    loading:          'Wird geladen...',
    error:            'Fehler beim Laden der Zelldetails',
    testMetrics:      'Testdaten',
    noMetrics:        'Keine Testdaten für diese Zelle verfügbar.',
    records:          (n) => `${n} Datensatz${n !== 1 ? 'e' : ''}`,
    anomaliesDetected:'⚠️ Anomalien erkannt',
    metricLabels: {
      voltage:             'Spannung (V)',
      internal_resistance: 'Innenwiderstand (mΩ)',
      capacity:            'Kapazität (mAh)',
      temperature:         'Temperatur (°C)',
    },
    warningIR:   (label, val, thr) => `${label}: Innenwiderstand ${val}mΩ überschreitet ${thr}mΩ`,
    warningTemp: (label, val, thr) => `${label}: Temperatur ${val}°C überschreitet ${thr}°C`,
    states: {
      'Received': 'Empfangen', 'Incoming QC': 'Eingangs-QK', 'Storage': 'Lagerung',
      'Under Test': 'Im Test', 'Passed': 'Bestanden', 'Failed': 'Fehlgeschlagen', 'Disposed': 'Entsorgt'
    }
  }
};

const THRESHOLDS = { internal_resistance: 35, temperature: 45 };

const cardStyle = {
  backgroundColor: 'var(--bg-surface)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
  padding: '20px'
};

function formatDateForInput(dateStr) {
  if (!dateStr) return '';
  return dateStr.split('T')[0];
}

function MetricsChart({ data, t }) {
  const METRICS = [
    { key: 'voltage',             label: t.metricLabels.voltage,             color: '#0A84FF' },
    { key: 'internal_resistance', label: t.metricLabels.internal_resistance, color: '#FF9500' },
    { key: 'capacity',            label: t.metricLabels.capacity,            color: '#34C759' },
    { key: 'temperature',         label: t.metricLabels.temperature,         color: '#FF3B30' },
  ];

  const [activeMetrics, setActiveMetrics] = useState(['voltage', 'internal_resistance']);

  if (!data || data.length === 0) {
    return (
      <div style={{ ...cardStyle, marginTop: '24px' }}>
        <h2 style={{ fontSize: '16px', margin: '0 0 8px' }}>{t.testMetrics}</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>{t.noMetrics}</p>
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

  const toggleMetric = (key) =>
    setActiveMetrics(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  const warnings = [];
  chartData.forEach(row => {
    if (row.internal_resistance != null && row.internal_resistance > THRESHOLDS.internal_resistance)
      warnings.push(t.warningIR(row.label, row.internal_resistance, THRESHOLDS.internal_resistance));
    if (row.temperature != null && row.temperature > THRESHOLDS.temperature)
      warnings.push(t.warningTemp(row.label, row.temperature, THRESHOLDS.temperature));
  });

  return (
    <div style={{ ...cardStyle, marginTop: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '16px', margin: 0 }}>{t.testMetrics}</h2>
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t.records(data.length)}</span>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {METRICS.map(m => (
          <button key={m.key} onClick={() => toggleMetric(m.key)} style={{
            padding: '4px 12px', borderRadius: '999px',
            border: `1.5px solid ${activeMetrics.includes(m.key) ? m.color : 'var(--border-strong)'}`,
            background: activeMetrics.includes(m.key) ? m.color + '18' : 'transparent',
            color: activeMetrics.includes(m.key) ? m.color : 'var(--text-secondary)',
            fontSize: '12px', fontWeight: 500, cursor: 'pointer'
          }}>{m.label}</button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} width={48} />
          <Tooltip contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px', fontSize: '12px' }} />
          <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
          {METRICS.filter(m => activeMetrics.includes(m.key)).map(m => (
            <Line key={m.key} type="monotone" dataKey={m.key} name={m.label}
              stroke={m.color} strokeWidth={2}
              dot={{ r: 3, fill: m.color }} activeDot={{ r: 5 }} connectNulls={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {warnings.length > 0 && (
        <div style={{ marginTop: '14px', padding: '10px 14px', background: 'var(--state-danger-soft)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--state-danger)' }}>
          <p style={{ margin: '0 0 6px', fontSize: '12px', fontWeight: 600, color: 'var(--state-danger)' }}>{t.anomaliesDetected}</p>
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
  const { lang } = useLang();
  const navigate = useNavigate();
  const t = I18N[lang];

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

  useEffect(() => { fetchCellData(); }, [id]);

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
      try {
        const metricsRes = await axios.get(`http://localhost:3000/api/metrics/${cellData.cell_code}`, { headers });
        setMetrics(metricsRes.data.data || []);
      } catch { setMetrics([]); }
    } catch { setError(t.error); }
    finally { setLoading(false); }
  };

  const handleUpdateState = async (e) => {
    e.preventDefault(); setUpdating(true);
    try {
      await axios.patch(`http://localhost:3000/api/cells/${id}/state`,
        { new_state: newState, notes },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNewState(''); setNotes('');
      await fetchCellData();
    } catch (err) { alert(err.response?.data?.message || t.error); }
    finally { setUpdating(false); }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.patch(`http://localhost:3000/api/cells/${id}`,
        { model: editModel, capacity_rated: editCapacity, voltage_nominal: editVoltage, manufacture_date: editManufactureDate },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setEditMode(false); await fetchCellData();
    } catch (err) { alert(err.response?.data?.message || t.error); }
  };

  const roleOptions = {
    quality_engineer: { 'Received': ['Incoming QC', 'Failed'] },
    warehouse_staff:  { 'Incoming QC': ['Storage'] },
    lab_operator:     { 'Storage': ['Under Test'], 'Under Test': ['Passed', 'Failed'] },
    disposal_manager: { 'Failed': ['Disposed'] }
  };
  const myOptions = roleOptions[user?.role]?.[cell?.current_state] || [];

  if (loading) return <p style={{ color: 'var(--text-secondary)' }}>{t.loading}</p>;
  if (error)   return <p style={{ color: 'var(--state-danger)' }}>{error}</p>;

  const labelStyle = { display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' };

  return (
    <div>
      <button onClick={() => navigate('/cells')} style={{ marginBottom: '16px' }}>{t.backToList}</button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <h1 style={{ margin: 0 }} className="mono">{cell.cell_code}</h1>
        {user?.role === 'quality_engineer' && (
          <button onClick={() => setEditMode(!editMode)}>{editMode ? t.cancel : t.editInfo}</button>
        )}
      </div>

      {editMode ? (
        <form onSubmit={handleEditSubmit} style={{ ...cardStyle, marginBottom: '16px' }}>
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>{t.model}</label>
            <input type="text" value={editModel} onChange={e => setEditModel(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>{t.capacityLabel}</label>
            <input type="number" value={editCapacity} onChange={e => setEditCapacity(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>{t.voltageLabel}</label>
            <input type="number" step="0.01" value={editVoltage} onChange={e => setEditVoltage(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>{t.manufactureDate}</label>
            <input type="date" value={editManufactureDate} onChange={e => setEditManufactureDate(e.target.value)} style={{ width: '100%' }} />
          </div>
          <button type="submit" className="btn-primary">{t.saveChanges}</button>
        </form>
      ) : (
        <div style={{ ...cardStyle, marginBottom: '16px' }}>
          <p style={{ margin: '0 0 8px' }}><span style={{ color: 'var(--text-secondary)' }}>{t.model}:</span> {cell.model || <span style={{ color: 'var(--text-muted)' }}>{t.missing}</span>}</p>
          <p style={{ margin: '0 0 8px' }}><span style={{ color: 'var(--text-secondary)' }}>{t.capacity}:</span> {cell.capacity_rated ? `${cell.capacity_rated} mAh` : <span style={{ color: 'var(--text-muted)' }}>{t.missing}</span>}</p>
          <p style={{ margin: 0 }}><span style={{ color: 'var(--text-secondary)' }}>{t.voltage}:</span> {cell.voltage_nominal ? `${cell.voltage_nominal} V` : <span style={{ color: 'var(--text-muted)' }}>{t.missing}</span>}</p>
        </div>
      )}

      <p><span style={{ color: 'var(--text-secondary)' }}>{t.batch}:</span> {cell.batch_number} ({cell.batch_supplier})</p>
      <p><span style={{ color: 'var(--text-secondary)' }}>{t.currentState}:</span> {t.states[cell.current_state] || cell.current_state}</p>

      <MetricsChart data={metrics} t={t} />

      {myOptions.length > 0 && (
        <div style={{ ...cardStyle, marginTop: '24px' }}>
          <h3 style={{ marginTop: 0, fontSize: '15px' }}>{t.updateState}</h3>
          <form onSubmit={handleUpdateState} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <select value={newState} onChange={e => setNewState(e.target.value)} required>
              <option value="">{t.selectState}</option>
              {myOptions.map(option => (
                <option key={option} value={option}>{t.states[option] || option}</option>
              ))}
            </select>
            <input type="text" placeholder={t.notesPlaceholder} value={notes}
              onChange={e => setNotes(e.target.value)} required style={{ width: '280px' }} />
            <button type="submit" disabled={updating} className="btn-primary">
              {updating ? t.updating : t.update}
            </button>
          </form>
        </div>
      )}

      <h2 style={{ marginTop: '32px', fontSize: '16px' }}>{t.timeline}</h2>
      <div>
        {history.map(event => (
          <div key={event.id} style={{ borderLeft: '3px solid var(--accent)', paddingLeft: '15px', marginBottom: '15px' }}>
            <p style={{ margin: '0 0 4px' }}>
              <strong>{event.event_type}</strong> — <span style={{ color: 'var(--text-secondary)' }}>{new Date(event.created_at).toLocaleString()}</span>
            </p>
            <p style={{ margin: '0 0 4px' }}>{event.changed_from ? `${event.changed_from} → ${event.changed_to}` : event.changed_to}</p>
            <p style={{ margin: '0 0 4px', color: 'var(--text-secondary)' }}>{t.by}: {event.operator_name}</p>
            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{t.notes}: {event.notes}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default CellDetail;

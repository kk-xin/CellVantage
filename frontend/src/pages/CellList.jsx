import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';

const I18N = {
  en: {
    title:        'Cells',
    cellCode:     'Cell Code',
    model:        'Model',
    batchNumber:  'Batch Number',
    currentState: 'Current State',
    createdAt:    'Created At',
    action:       'Action',
    view:         'View',
    loading:      'Loading cells...',
    error:        'Failed to load cells',
    noCells:      'No cells found.',
    pendingRole:  'Your account is pending role assignment by an administrator.',
    missing:      'Missing',
    fieldLabels: {
      model:            'Model',
      capacity_rated:   'Rated Capacity',
      voltage_nominal:  'Nominal Voltage',
      manufacture_date: 'Manufacturing Date',
    },
    states: {
      'Received': 'Received', 'Incoming QC': 'Incoming QC', 'Storage': 'Storage',
      'Under Test': 'Under Test', 'Passed': 'Passed', 'Failed': 'Failed', 'Disposed': 'Disposed'
    }
  },
  zh: {
    title:        '电池列表',
    cellCode:     '电池编号',
    model:        '型号',
    batchNumber:  '批次编号',
    currentState: '当前状态',
    createdAt:    '创建时间',
    action:       '操作',
    view:         '查看',
    loading:      '加载中...',
    error:        '加载电池列表失败',
    noCells:      '未找到电池。',
    pendingRole:  '您的账号待管理员分配角色。',
    missing:      '缺少',
    fieldLabels: {
      model:            '型号',
      capacity_rated:   '额定容量',
      voltage_nominal:  '标称电压',
      manufacture_date: '生产日期',
    },
    states: {
      'Received': '已入库', 'Incoming QC': '质检中', 'Storage': '存储中',
      'Under Test': '测试中', 'Passed': '已通过', 'Failed': '已失败', 'Disposed': '已处置'
    }
  },
  de: {
    title:        'Zellen',
    cellCode:     'Zellcode',
    model:        'Modell',
    batchNumber:  'Chargennummer',
    currentState: 'Aktueller Zustand',
    createdAt:    'Erstellt am',
    action:       'Aktion',
    view:         'Ansehen',
    loading:      'Zellen werden geladen...',
    error:        'Fehler beim Laden der Zellen',
    noCells:      'Keine Zellen gefunden.',
    pendingRole:  'Ihr Konto wartet auf eine Rollenzuweisung durch einen Administrator.',
    missing:      'Fehlend',
    fieldLabels: {
      model:            'Modell',
      capacity_rated:   'Nennkapazität',
      voltage_nominal:  'Nennspannung',
      manufacture_date: 'Herstellungsdatum',
    },
    states: {
      'Received': 'Empfangen', 'Incoming QC': 'Eingangs-QK', 'Storage': 'Lagerung',
      'Under Test': 'Im Test', 'Passed': 'Bestanden', 'Failed': 'Fehlgeschlagen', 'Disposed': 'Entsorgt'
    }
  }
};

const STATUS_STYLES = {
  Received:      { color: '#6E6E73', bg: '#F2F2F7' },
  'Incoming QC': { color: '#FF9500', bg: 'var(--state-warning-soft)' },
  Storage:       { color: '#0A84FF', bg: 'var(--accent-soft)' },
  'Under Test':  { color: '#FF9500', bg: 'var(--state-warning-soft)' },
  Passed:        { color: '#1E8E3E', bg: 'var(--state-success-soft)' },
  Failed:        { color: '#D70015', bg: 'var(--state-danger-soft)' },
  Disposed:      { color: '#AEAEB2', bg: '#F2F2F7' },
};

function StatusBadge({ state, label }) {
  const s = STATUS_STYLES[state] || STATUS_STYLES.Received;
  return (
    <span className="status-badge" style={{ backgroundColor: s.bg, color: s.color }}>
      <span className="status-dot" style={{ backgroundColor: s.color }} />
      {label || state}
    </span>
  );
}

function CellList() {
  const { token, user } = useAuth();
  const { lang } = useLang();
  const navigate = useNavigate();
  const t = I18N[lang];

  const [cells, setCells] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [hoveredCell, setHoveredCell] = useState(null);

  useEffect(() => { fetchCells(); }, []);

  const fetchCells = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/cells', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCells(res.data.data);
    } catch {
      setError(t.error);
    } finally {
      setLoading(false);
    }
  };

  const requiredFields = ['model', 'capacity_rated', 'voltage_nominal', 'manufacture_date'];

  const getMissingFields = (cell) =>
    requiredFields
      .filter(f => !cell[f] || cell[f] === '')
      .map(f => t.fieldLabels[f]);

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
    let valA = a[sortField], valB = b[sortField];
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

  if (loading) return <p style={{ color: 'var(--text-secondary)' }}>{t.loading}</p>;
  if (error)   return <p style={{ color: 'var(--state-danger)' }}>{error}</p>;

  const thStyle = {
    cursor: 'pointer', padding: '10px 12px', fontSize: '12px', fontWeight: 600,
    letterSpacing: '0.03em', textTransform: 'uppercase', textAlign: 'left',
    color: 'var(--text-secondary)', backgroundColor: 'var(--bg-surface-raised)',
    borderBottom: '1px solid var(--border-strong)', whiteSpace: 'nowrap'
  };
  const tdStyle = {
    padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)', fontSize: '14px'
  };

  return (
    <div>
      <h1>{t.title}</h1>

      <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        <table style={{ tableLayout: 'fixed', width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th onClick={() => handleSort('cell_code')} style={thStyle}>{t.cellCode}{renderArrow('cell_code')}</th>
              <th onClick={() => handleSort('model')} style={thStyle}>{t.model}{renderArrow('model')}</th>
              <th onClick={() => handleSort('batch_number')} style={thStyle}>{t.batchNumber}{renderArrow('batch_number')}</th>
              <th onClick={() => handleSort('current_state')} style={thStyle}>{t.currentState}{renderArrow('current_state')}</th>
              <th onClick={() => handleSort('created_at')} style={thStyle}>{t.createdAt}{renderArrow('created_at')}</th>
              <th style={{ ...thStyle, cursor: 'default' }}>{t.action}</th>
            </tr>
          </thead>
          <tbody>
            {sortedCells.map((cell, idx) => {
              const missing = getMissingFields(cell);
              const incomplete = missing.length > 0;
              const isLast = idx === sortedCells.length - 1;
              const td = (extra = {}) => ({ ...tdStyle, borderBottom: isLast ? 'none' : tdStyle.borderBottom, ...extra });

              return (
                <tr key={cell.id} style={{ backgroundColor: incomplete ? 'var(--state-warning-soft)' : 'transparent' }}>
                  <td style={td({ height: '20px', lineHeight: '20px', verticalAlign: 'middle' })}>
                    <span className="mono">{cell.cell_code}</span>
                    {incomplete && (
                      <span
                        onMouseEnter={() => setHoveredCell(cell.id)}
                        onMouseLeave={() => setHoveredCell(null)}
                        title={`${t.missing}: ${missing.join(', ')}`}
                        style={{ color: 'var(--state-warning)', marginLeft: '8px', cursor: 'pointer', position: 'relative', fontSize: '14px', lineHeight: '20px', verticalAlign: 'middle' }}
                      >
                        ⚠️
                        {hoveredCell === cell.id && (
                          <span style={{ position: 'absolute', top: '100%', left: 0, backgroundColor: '#1D1D1F', color: '#FFFFFF', padding: '6px 10px', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontWeight: 400, whiteSpace: 'nowrap', zIndex: 100 }}>
                            {t.missing}: {missing.join(', ')}
                          </span>
                        )}
                      </span>
                    )}
                  </td>
                  <td style={td()}>
                    {cell.model || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td className="mono" style={td({ color: 'var(--text-secondary)' })}>{cell.batch_number}</td>
                  <td style={td()}>
                    <StatusBadge state={cell.current_state} label={t.states[cell.current_state]} />
                  </td>
                  <td style={td({ color: 'var(--text-secondary)' })}>
                    {new Date(cell.created_at).toLocaleDateString()}
                  </td>
                  <td style={td()}>
                    <button onClick={() => navigate(`/cells/${cell.id}`)}>{t.view}</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {cells.length === 0 && (
        <p style={{ color: 'var(--text-secondary)' }}>
          {user?.role === 'system' ? t.pendingRole : t.noCells}
        </p>
      )}
    </div>
  );
}

export default CellList;

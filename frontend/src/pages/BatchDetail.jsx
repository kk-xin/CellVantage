import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';

const I18N = {
  en: {
    backToDashboard: '← Back to Dashboard',
    supplier:        'Supplier',
    totalQuantity:   'Total Quantity',
    noCells:         'No cells found in this batch.',
    cellCode:        'Cell Code',
    model:           'Model',
    action:          'Action',
    view:            'View',
    noPermission:    'You do not have permission to view this page.',
    loading:         'Loading...',
    error:           'Failed to load batch details',
    states: {
      'Received': 'Received', 'Incoming QC': 'Incoming QC', 'Storage': 'Storage',
      'Under Test': 'Under Test', 'Passed': 'Passed', 'Failed': 'Failed', 'Disposed': 'Disposed'
    }
  },
  zh: {
    backToDashboard: '← 返回仪表盘',
    supplier:        '供应商',
    totalQuantity:   '总数量',
    noCells:         '该批次暂无电池。',
    cellCode:        '电池编号',
    model:           '型号',
    action:          '操作',
    view:            '查看',
    noPermission:    '您没有权限查看此页面。',
    loading:         '加载中...',
    error:           '加载批次详情失败',
    states: {
      'Received': '已入库', 'Incoming QC': '质检中', 'Storage': '存储中',
      'Under Test': '测试中', 'Passed': '已通过', 'Failed': '已失败', 'Disposed': '已处置'
    }
  },
  de: {
    backToDashboard: '← Zurück zum Dashboard',
    supplier:        'Lieferant',
    totalQuantity:   'Gesamtmenge',
    noCells:         'Keine Zellen in dieser Charge gefunden.',
    cellCode:        'Zellcode',
    model:           'Modell',
    action:          'Aktion',
    view:            'Ansehen',
    noPermission:    'Sie haben keine Berechtigung, diese Seite anzuzeigen.',
    loading:         'Wird geladen...',
    error:           'Fehler beim Laden der Chargendetails',
    states: {
      'Received': 'Empfangen', 'Incoming QC': 'Eingangs-QK', 'Storage': 'Lagerung',
      'Under Test': 'Im Test', 'Passed': 'Bestanden', 'Failed': 'Fehlgeschlagen', 'Disposed': 'Entsorgt'
    }
  }
};

const STATE_COLORS = {
  Received: '#6E6E73', 'Incoming QC': '#FF9500', Storage: '#0A84FF',
  'Under Test': '#FF9500', Passed: '#1E8E3E', Failed: '#D70015', Disposed: '#AEAEB2'
};

function BatchDetail() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const { lang } = useLang();
  const navigate = useNavigate();
  const t = I18N[lang];

  const [batch, setBatch] = useState(null);
  const [grouped, setGrouped] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { fetchData(); }, [id]);

  const fetchData = async () => {
    try {
      const res = await axios.get(
        `http://localhost:3000/api/batches/${id}/cells-by-state`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setBatch(res.data.data.batch);
      setGrouped(res.data.data.grouped);
    } catch {
      setError(t.error);
    } finally {
      setLoading(false);
    }
  };

  if (user?.role !== 'admin') {
    return <p style={{ color: 'var(--text-secondary)' }}>{t.noPermission}</p>;
  }
  if (loading) return <p style={{ color: 'var(--text-secondary)' }}>{t.loading}</p>;
  if (error)   return <p style={{ color: 'var(--state-danger)' }}>{error}</p>;

  const states = Object.keys(grouped);

  const thStyle = {
    padding: '10px 12px', fontSize: '12px', fontWeight: 600,
    letterSpacing: '0.03em', textTransform: 'uppercase', textAlign: 'left',
    color: 'var(--text-secondary)', backgroundColor: 'var(--bg-surface-raised)',
    borderBottom: '1px solid var(--border-strong)', whiteSpace: 'nowrap'
  };
  const tdStyle = { padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)', fontSize: '14px' };

  return (
    <div>
      <button onClick={() => navigate('/dashboard')} style={{ marginBottom: '16px' }}>{t.backToDashboard}</button>

      <h1 className="mono">{batch.batch_number}</h1>
      <p><span style={{ color: 'var(--text-secondary)' }}>{t.supplier}:</span> {batch.supplier}</p>
      <p><span style={{ color: 'var(--text-secondary)' }}>{t.totalQuantity}:</span> {batch.total_quantity}</p>

      {states.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>{t.noCells}</p>}

      {states.map((state) => (
        <div key={state} style={{ marginTop: '28px' }}>
          <h3 style={{ color: STATE_COLORS[state] || 'var(--text-primary)', fontSize: '14px', fontWeight: 600 }}>
            {t.states[state] || state} ({grouped[state].length})
          </h3>

          <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <table style={{ tableLayout: 'fixed', width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>{t.cellCode}</th>
                  <th style={thStyle}>{t.model}</th>
                  <th style={{ ...thStyle, cursor: 'default' }}>{t.action}</th>
                </tr>
              </thead>
              <tbody>
                {grouped[state].map((cell, idx) => {
                  const isLast = idx === grouped[state].length - 1;
                  const td = { ...tdStyle, borderBottom: isLast ? 'none' : tdStyle.borderBottom };
                  return (
                    <tr key={cell.id}>
                      <td className="mono" style={td}>{cell.cell_code}</td>
                      <td style={td}>{cell.model}</td>
                      <td style={td}>
                        <button onClick={() => navigate(`/cells/${cell.id}`)}>{t.view}</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

export default BatchDetail;
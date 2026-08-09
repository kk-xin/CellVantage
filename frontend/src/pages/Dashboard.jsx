import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';

const I18N = {
  en: {
    title:        'Dashboard',
    cellsByState: 'Cells by state',
    batches:      'Batches',
    batchNumber:  'Batch Number',
    supplier:     'Supplier',
    deliveryDate: 'Delivery Date',
    cellCount:    'Cell Count',
    action:       'Action',
    view:         'View',
    loading:      'Loading dashboard...',
    error:        'Failed to load dashboard data',
    states: {
      'Received': 'Received', 'Incoming QC': 'Incoming QC', 'Storage': 'Storage',
      'Under Test': 'Under Test', 'Passed': 'Passed', 'Failed': 'Failed', 'Disposed': 'Disposed'
    }
  },
  zh: {
    title:        '仪表盘',
    cellsByState: '各状态电池数量',
    batches:      '批次列表',
    batchNumber:  '批次编号',
    supplier:     '供应商',
    deliveryDate: '到货日期',
    cellCount:    '电池数量',
    action:       '操作',
    view:         '查看',
    loading:      '加载中...',
    error:        '加载仪表盘数据失败',
    states: {
      'Received': '已入库', 'Incoming QC': '质检中', 'Storage': '存储中',
      'Under Test': '测试中', 'Passed': '已通过', 'Failed': '已失败', 'Disposed': '已处置'
    }
  },
  de: {
    title:        'Dashboard',
    cellsByState: 'Zellen nach Zustand',
    batches:      'Chargen',
    batchNumber:  'Chargennummer',
    supplier:     'Lieferant',
    deliveryDate: 'Lieferdatum',
    cellCount:    'Zellenanzahl',
    action:       'Aktion',
    view:         'Ansehen',
    loading:      'Dashboard wird geladen...',
    error:        'Fehler beim Laden der Dashboard-Daten',
    states: {
      'Received': 'Empfangen', 'Incoming QC': 'Eingangs-QK', 'Storage': 'Lagerung',
      'Under Test': 'Im Test', 'Passed': 'Bestanden', 'Failed': 'Fehlgeschlagen', 'Disposed': 'Entsorgt'
    }
  }
};

const thStyle = {
  padding: '10px 12px', fontSize: '12px', fontWeight: 600,
  letterSpacing: '0.03em', textTransform: 'uppercase', textAlign: 'left',
  color: 'var(--text-secondary)', backgroundColor: 'var(--bg-surface-raised)',
  borderBottom: '1px solid var(--border-strong)', whiteSpace: 'nowrap'
};
const tdStyle = {
  padding: '10px 12px',
  borderBottom: '1px solid var(--border-subtle)',
  fontSize: '14px'
};

function Dashboard() {
  const { token } = useAuth();
  const { lang } = useLang();
  const navigate = useNavigate();
  const t = I18N[lang];

  const [stateSummary, setStateSummary] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { fetchDashboardData(); }, []);

  const fetchDashboardData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [summaryRes, batchesRes] = await Promise.all([
        axios.get('http://localhost:3000/api/cells/dashboard/summary', { headers }),
        axios.get('http://localhost:3000/api/batches', { headers })
      ]);
      setStateSummary(summaryRes.data.data);
      setBatches(batchesRes.data.data);
    } catch {
      setError(t.error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <p style={{ color: 'var(--text-secondary)' }}>{t.loading}</p>;
  if (error)   return <p style={{ color: 'var(--state-danger)' }}>{error}</p>;

  return (
    <div>
      <h1>{t.title}</h1>

      <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px' }}>
        {t.cellsByState}
      </h2>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '32px' }}>
        {stateSummary.map((item) => (
          <div key={item.current_state} style={{
            backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)', padding: '16px 20px', minWidth: '140px'
          }}>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 6px' }}>
              {t.states[item.current_state] || item.current_state}
            </p>
            <p style={{ fontSize: '24px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
              {item.count}
            </p>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px' }}>
        {t.batches}
      </h2>
      <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        <table style={{ tableLayout: 'fixed', width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>{t.batchNumber}</th>
              <th style={thStyle}>{t.supplier}</th>
              <th style={thStyle}>{t.deliveryDate}</th>
              <th style={thStyle}>{t.cellCount}</th>
              <th style={{ ...thStyle, cursor: 'default' }}>{t.action}</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((batch, idx) => {
              const isLast = idx === batches.length - 1;
              const td = { ...tdStyle, borderBottom: isLast ? 'none' : tdStyle.borderBottom };
              return (
                <tr key={batch.id}>
                  <td className="mono" style={td}>{batch.batch_number}</td>
                  <td style={td}>{batch.supplier}</td>
                  <td style={{ ...td, color: 'var(--text-secondary)' }}>{batch.delivery_date}</td>
                  <td style={td}>{batch.cell_count}</td>
                  <td style={td}>
                    <button onClick={() => navigate(`/batches/${batch.id}`)}>{t.view}</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Dashboard;

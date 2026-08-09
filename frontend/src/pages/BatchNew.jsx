import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';

const I18N = {
  en: {
    title:         'Create New Batch',
    batchNumber:   'Batch Number',
    supplier:      'Supplier',
    totalQuantity: 'Total Quantity',
    deliveryDate:  'Delivery Date',
    notesOptional: 'Notes (optional)',
    creating:      'Creating...',
    createBatch:   'Create Batch',
    noPermission:  'You do not have permission to create a batch.',
    error:         'Failed to create batch',
  },
  zh: {
    title:         '新建批次',
    batchNumber:   '批次编号',
    supplier:      '供应商',
    totalQuantity: '总数量',
    deliveryDate:  '到货日期',
    notesOptional: '备注（可选）',
    creating:      '创建中...',
    createBatch:   '创建批次',
    noPermission:  '您没有权限创建批次。',
    error:         '创建批次失败',
  },
  de: {
    title:         'Neue Charge erstellen',
    batchNumber:   'Chargennummer',
    supplier:      'Lieferant',
    totalQuantity: 'Gesamtmenge',
    deliveryDate:  'Lieferdatum',
    notesOptional: 'Notizen (optional)',
    creating:      'Wird erstellt...',
    createBatch:   'Charge erstellen',
    noPermission:  'Sie haben keine Berechtigung, eine Charge zu erstellen.',
    error:         'Charge konnte nicht erstellt werden',
  }
};

function BatchNew() {
  const { token, user } = useAuth();
  const { lang } = useLang();
  const navigate = useNavigate();
  const t = I18N[lang];

  const [batchNumber, setBatchNumber] = useState('');
  const [supplier, setSupplier] = useState('');
  const [totalQuantity, setTotalQuantity] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user?.role !== 'quality_engineer') {
    return <p style={{ color: 'var(--text-secondary)' }}>{t.noPermission}</p>;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await axios.post(
        'http://localhost:3000/api/batches',
        { batch_number: batchNumber, supplier, total_quantity: totalQuantity, delivery_date: deliveryDate, notes },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      navigate(`/cells/import?batch_id=${res.data.id}`);
    } catch (err) {
      setError(err.response?.data?.message || t.error);
    } finally {
      setSubmitting(false);
    }
  };

  const labelStyle = { display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' };

  return (
    <div style={{ maxWidth: '460px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '28px' }}>
      <h1 style={{ fontSize: '20px', marginTop: 0, marginBottom: '20px' }}>{t.title}</h1>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '14px' }}>
          <label style={labelStyle}>{t.batchNumber}</label>
          <input type="text" value={batchNumber} onChange={e => setBatchNumber(e.target.value)} required style={{ width: '100%' }} />
        </div>

        <div style={{ marginBottom: '14px' }}>
          <label style={labelStyle}>{t.supplier}</label>
          <input type="text" value={supplier} onChange={e => setSupplier(e.target.value)} required style={{ width: '100%' }} />
        </div>

        <div style={{ marginBottom: '14px' }}>
          <label style={labelStyle}>{t.totalQuantity}</label>
          <input type="number" value={totalQuantity} onChange={e => setTotalQuantity(e.target.value)} required style={{ width: '100%' }} />
        </div>

        <div style={{ marginBottom: '14px' }}>
          <label style={labelStyle}>{t.deliveryDate}</label>
          <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} required style={{ width: '100%' }} />
        </div>

        <div style={{ marginBottom: '18px' }}>
          <label style={labelStyle}>{t.notesOptional}</label>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)} style={{ width: '100%' }} />
        </div>

        {error && <p style={{ color: 'var(--state-danger)', fontSize: '13px', marginBottom: '12px' }}>{error}</p>}

        <button type="submit" disabled={submitting} className="btn-primary" style={{ width: '100%' }}>
          {submitting ? t.creating : t.createBatch}
        </button>
      </form>
    </div>
  );
}

export default BatchNew;
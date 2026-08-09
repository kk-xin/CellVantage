import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';

const I18N = {
  en: {
    title:           'Import Cells',
    batchInfo:       'Batch Information',
    batchNumber:     'Batch Number',
    supplier:        'Supplier',
    deliveryDate:    'Delivery Date',
    cellData:        'Cell Data (CSV)',
    selected:        (name, n) => `Selected: ${name} (${n} rows)`,
    importing:       'Importing...',
    importBtn:       'Import Cells',
    errorsLabel:     'Errors:',
    rowError:        (row, code, reason) => `Row ${row} (${code}): ${reason}`,
    goToList:        'Go to Cell List',
    noPermission:    'You do not have permission to import cells.',
    parseError:      'Failed to parse CSV file',
    uploadRequired:  'Please upload a CSV file with cell data',
    importFailed:    'Import failed',
  },
  zh: {
    title:           '导入电池',
    batchInfo:       '批次信息',
    batchNumber:     '批次编号',
    supplier:        '供应商',
    deliveryDate:    '到货日期',
    cellData:        '电池数据 (CSV)',
    selected:        (name, n) => `已选择：${name}（共 ${n} 行）`,
    importing:       '导入中...',
    importBtn:       '导入电池',
    errorsLabel:     '错误：',
    rowError:        (row, code, reason) => `第 ${row} 行（${code}）：${reason}`,
    goToList:        '前往电池列表',
    noPermission:    '您没有权限导入电池。',
    parseError:      '解析 CSV 文件失败',
    uploadRequired:  '请上传包含电池数据的 CSV 文件',
    importFailed:    '导入失败',
  },
  de: {
    title:           'Zellen importieren',
    batchInfo:       'Chargeninformationen',
    batchNumber:     'Chargennummer',
    supplier:        'Lieferant',
    deliveryDate:    'Lieferdatum',
    cellData:        'Zelldaten (CSV)',
    selected:        (name, n) => `Ausgewählt: ${name} (${n} Zeilen)`,
    importing:       'Wird importiert...',
    importBtn:       'Zellen importieren',
    errorsLabel:     'Fehler:',
    rowError:        (row, code, reason) => `Zeile ${row} (${code}): ${reason}`,
    goToList:        'Zur Zellenliste',
    noPermission:    'Sie haben keine Berechtigung, Zellen zu importieren.',
    parseError:      'CSV-Datei konnte nicht analysiert werden',
    uploadRequired:  'Bitte laden Sie eine CSV-Datei mit Zelldaten hoch',
    importFailed:    'Import fehlgeschlagen',
  }
};

function CellImport() {
  const { token, user } = useAuth();
  const { lang } = useLang();
  const navigate = useNavigate();
  const t = I18N[lang];

  const [batchNumber, setBatchNumber] = useState('');
  const [supplier, setSupplier] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [parsedCells, setParsedCells] = useState([]);
  const [fileName, setFileName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  if (user?.role !== 'quality_engineer') {
    return <p style={{ color: 'var(--text-secondary)' }}>{t.noPermission}</p>;
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setError('');
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => setParsedCells(results.data),
      error: () => setError(t.parseError)
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);

    if (parsedCells.length === 0) {
      setError(t.uploadRequired);
      return;
    }

    setSubmitting(true);
    try {
      const res = await axios.post(
        'http://localhost:3000/api/cells/import',
        { batch_number: batchNumber, supplier, delivery_date: deliveryDate, cells: parsedCells },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.message || t.importFailed);
    } finally {
      setSubmitting(false);
    }
  };

  const cardStyle = {
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    padding: '28px'
  };
  const labelStyle = { display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' };

  return (
    <div style={{ maxWidth: '640px' }}>
      <h1>{t.title}</h1>

      <form onSubmit={handleSubmit} style={cardStyle}>
        <h3 style={{ marginTop: 0, fontSize: '15px' }}>{t.batchInfo}</h3>

        <div style={{ marginBottom: '14px' }}>
          <label style={labelStyle}>{t.batchNumber}</label>
          <input type="text" value={batchNumber} onChange={e => setBatchNumber(e.target.value)} required style={{ width: '100%' }} />
        </div>

        <div style={{ marginBottom: '14px' }}>
          <label style={labelStyle}>{t.supplier}</label>
          <input type="text" value={supplier} onChange={e => setSupplier(e.target.value)} required style={{ width: '100%' }} />
        </div>

        <div style={{ marginBottom: '18px' }}>
          <label style={labelStyle}>{t.deliveryDate}</label>
          <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} required style={{ width: '100%' }} />
        </div>

        <h3 style={{ fontSize: '15px' }}>{t.cellData}</h3>

        <div style={{ marginBottom: '14px' }}>
          <input type="file" accept=".csv" onChange={handleFileChange} required />
          {fileName && <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{t.selected(fileName, parsedCells.length)}</p>}
        </div>

        {error && <p style={{ color: 'var(--state-danger)', fontSize: '13px', marginBottom: '12px' }}>{error}</p>}

        <button type="submit" disabled={submitting} className="btn-primary" style={{ width: '100%' }}>
          {submitting ? t.importing : t.importBtn}
        </button>
      </form>

      {result && (
        <div style={{ ...cardStyle, marginTop: '20px' }}>
          <h3 style={{ marginTop: 0, fontSize: '15px' }}>{result.message}</h3>

          {result.data.errors.length > 0 && (
            <div>
              <h4 style={{ color: 'var(--state-danger)', fontSize: '13px' }}>{t.errorsLabel}</h4>
              <ul style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                {result.data.errors.map((err, index) => (
                  <li key={index}>{t.rowError(err.row, err.cell_code, err.reason)}</li>
                ))}
              </ul>
            </div>
          )}

          <button onClick={() => navigate('/cells')}>{t.goToList}</button>
        </div>
      )}
    </div>
  );
}

export default CellImport;
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

function CellImport() {
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [batchNumber, setBatchNumber] = useState('');
  const [supplier, setSupplier] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');

  const [parsedCells, setParsedCells] = useState([]);
  const [fileName, setFileName] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  if (user?.role !== 'quality_engineer') {
    return <p style={{ color: 'var(--text-secondary)' }}>You do not have permission to import cells.</p>;
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);
    setError('');

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setParsedCells(results.data);
      },
      error: () => {
        setError('Failed to parse CSV file');
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);

    if (parsedCells.length === 0) {
      setError('Please upload a CSV file with cell data');
      return;
    }

    setSubmitting(true);

    try {
      const res = await axios.post(
        'http://localhost:3000/api/cells/import',
        {
          batch_number: batchNumber,
          supplier,
          delivery_date: deliveryDate,
          cells: parsedCells
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setResult(res.data);

    } catch (err) {
      setError(err.response?.data?.message || 'Import failed');
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

  return (
    <div style={{ maxWidth: '640px' }}>
      <h1>Import Cells</h1>

      <form onSubmit={handleSubmit} style={cardStyle}>
        <h3 style={{ marginTop: 0, fontSize: '15px' }}>Batch Information</h3>

        <div style={{ marginBottom: '14px' }}>
          <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Batch Number</label>
          <input
            type="text"
            value={batchNumber}
            onChange={(e) => setBatchNumber(e.target.value)}
            required
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ marginBottom: '14px' }}>
          <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Supplier</label>
          <input
            type="text"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            required
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ marginBottom: '18px' }}>
          <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Delivery Date</label>
          <input
            type="date"
            value={deliveryDate}
            onChange={(e) => setDeliveryDate(e.target.value)}
            required
            style={{ width: '100%' }}
          />
        </div>

        <h3 style={{ fontSize: '15px' }}>Cell Data (CSV)</h3>

        <div style={{ marginBottom: '14px' }}>
          <input type="file" accept=".csv" onChange={handleFileChange} required />
          {fileName && <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Selected: {fileName} ({parsedCells.length} rows)</p>}
        </div>

        {error && <p style={{ color: 'var(--state-danger)', fontSize: '13px', marginBottom: '12px' }}>{error}</p>}

        <button type="submit" disabled={submitting} className="btn-primary" style={{ width: '100%' }}>
          {submitting ? 'Importing...' : 'Import Cells'}
        </button>
      </form>

      {result && (
        <div style={{ ...cardStyle, marginTop: '20px' }}>
          <h3 style={{ marginTop: 0, fontSize: '15px' }}>{result.message}</h3>

          {result.data.errors.length > 0 && (
            <div>
              <h4 style={{ color: 'var(--state-danger)', fontSize: '13px' }}>Errors:</h4>
              <ul style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                {result.data.errors.map((err, index) => (
                  <li key={index}>
                    Row {err.row} ({err.cell_code}): {err.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button onClick={() => navigate('/cells')}>Go to Cell List</button>
        </div>
      )}
    </div>
  );
}

export default CellImport;

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

  // Only quality_engineer can import cells
  if (user?.role !== 'quality_engineer') {
    return <p>You do not have permission to import cells.</p>;
  }

  // Triggered when user selects a CSV file
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);
    setError('');

    Papa.parse(file, {
      header: true,           // First row becomes the object keys
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

  return (
    <div style={{ maxWidth: '700px' }}>
      <h1>Import Cells</h1>

      <form onSubmit={handleSubmit}>
        <h3>Batch Information</h3>

        <div style={{ marginBottom: '15px' }}>
          <label>Batch Number</label>
          <input
            type="text"
            value={batchNumber}
            onChange={(e) => setBatchNumber(e.target.value)}
            required
            style={{ width: '100%', padding: '8px' }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>Supplier</label>
          <input
            type="text"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            required
            style={{ width: '100%', padding: '8px' }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>Delivery Date</label>
          <input
            type="date"
            value={deliveryDate}
            onChange={(e) => setDeliveryDate(e.target.value)}
            required
            style={{ width: '100%', padding: '8px' }}
          />
        </div>

        <h3>Cell Data (CSV)</h3>

        <div style={{ marginBottom: '15px' }}>
          <input type="file" accept=".csv" onChange={handleFileChange} required />
          {fileName && <p>Selected: {fileName} ({parsedCells.length} rows)</p>}
        </div>

        {error && <p style={{ color: 'red' }}>{error}</p>}

        <button type="submit" disabled={submitting} style={{ width: '100%', padding: '10px' }}>
          {submitting ? 'Importing...' : 'Import Cells'}
        </button>
      </form>

      {result && (
        <div style={{ marginTop: '20px', border: '1px solid #ccc', padding: '15px' }}>
          <h3>{result.message}</h3>

          {result.data.errors.length > 0 && (
            <div>
              <h4 style={{ color: 'red' }}>Errors:</h4>
              <ul>
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
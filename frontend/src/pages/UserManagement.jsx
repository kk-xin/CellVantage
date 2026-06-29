import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const ROLES = ['system', 'quality_engineer', 'warehouse_staff', 'lab_operator', 'disposal_manager', 'admin'];

function UserManagement() {
  const { token, user } = useAuth();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/auth/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(res.data.data);
    } catch (err) {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    const confirmed = window.confirm(`Change role to "${newRole}"?`);
    if (!confirmed) return;

    try {
      await axios.patch(
        `http://localhost:3000/api/auth/users/${userId}/role`,
        { role: newRole },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update role');
    }
  };

  const handleToggleActive = async (userId, currentStatus) => {
    const action = currentStatus ? 'disable' : 'enable';
    const confirmed = window.confirm(`Are you sure you want to ${action} this user?`);
    if (!confirmed) return;

    try {
      await axios.patch(
        `http://localhost:3000/api/auth/users/${userId}/active`,
        { is_active: !currentStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update status');
    }
  };

  if (user?.role !== 'admin') {
    return <p style={{ color: 'var(--text-secondary)' }}>You do not have permission to view this page.</p>;
  }

  if (loading) return <p style={{ color: 'var(--text-secondary)' }}>Loading users...</p>;
  if (error) return <p style={{ color: 'var(--state-danger)' }}>{error}</p>;

  const filteredUsers = roleFilter
    ? users.filter((u) => u.role === roleFilter)
    : users;

  return (
    <div>
      <h1>User Management</h1>

      <div style={{ marginBottom: '16px' }}>
        <label style={{ fontSize: '13px', color: 'var(--text-secondary)', marginRight: '8px' }}>
          Filter by role:
        </label>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      <table style={{ tableLayout: 'fixed' }}>
        <thead>
          <tr>
            <th>Username</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Created At</th>
            <th style={{ cursor: 'default' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredUsers.map((u) => (
            <tr key={u.id}>
              <td>{u.username}</td>
              <td style={{ color: 'var(--text-secondary)' }}>{u.email}</td>
              <td>
                <select
                  value={u.role}
                  onChange={(e) => handleRoleChange(u.id, e.target.value)}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </td>
              <td>
                <span className="status-badge" style={{
                  backgroundColor: u.is_active ? 'var(--state-success-soft)' : 'var(--state-danger-soft)',
                  color: u.is_active ? '#1E8E3E' : '#D70015'
                }}>
                  <span className="status-dot" style={{ backgroundColor: u.is_active ? '#34C759' : '#FF3B30' }} />
                  {u.is_active ? 'Active' : 'Disabled'}
                </span>
              </td>
              <td style={{ color: 'var(--text-secondary)' }}>{new Date(u.created_at).toLocaleDateString()}</td>
              <td>
                <button onClick={() => handleToggleActive(u.id, u.is_active)}>
                  {u.is_active ? 'Disable' : 'Enable'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {filteredUsers.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>No users found.</p>}
    </div>
  );
}

export default UserManagement;

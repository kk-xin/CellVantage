import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const ROLES = ['system', 'quality_engineer', 'warehouse_staff', 'lab_operator', 'admin'];

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
    return <p>You do not have permission to view this page.</p>;
  }

  if (loading) return <p>Loading users...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;

  // Filter users by selected role (client-side filtering)
  const filteredUsers = roleFilter
    ? users.filter((u) => u.role === roleFilter)
    : users;

  return (
    <div>
      <h1>User Management</h1>

      <div style={{ marginBottom: '15px' }}>
        <label>Filter by role: </label>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      <table border="1" cellPadding="8" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>Username</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Created At</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredUsers.map((u) => (
            <tr key={u.id}>
              <td>{u.username}</td>
              <td>{u.email}</td>
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
              <td>{u.is_active ? 'Active' : 'Disabled'}</td>
              <td>{new Date(u.created_at).toLocaleDateString()}</td>
              <td>
                <button onClick={() => handleToggleActive(u.id, u.is_active)}>
                  {u.is_active ? 'Disable' : 'Enable'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {filteredUsers.length === 0 && <p>No users found.</p>}
    </div>
  );
}

export default UserManagement;
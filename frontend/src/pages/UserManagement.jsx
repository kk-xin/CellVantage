import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';

const I18N = {
  en: {
    title:        'User Management',
    filterByRole: 'Filter by role:',
    allRoles:     'All roles',
    username:     'Username',
    email:        'Email',
    role:         'Role',
    status:       'Status',
    createdAt:    'Created At',
    actions:      'Actions',
    active:       'Active',
    disabled:     'Disabled',
    disable:      'Disable',
    enable:       'Enable',
    noUsers:      'No users found.',
    noPermission: 'You do not have permission to view this page.',
    loading:      'Loading users...',
    error:        'Failed to load users',
    confirmRole:  (role) => `Change role to "${role}"?`,
    confirmDisable: 'Are you sure you want to disable this user?',
    confirmEnable:  'Are you sure you want to enable this user?',
  },
  zh: {
    title:        '用户管理',
    filterByRole: '按角色筛选：',
    allRoles:     '全部角色',
    username:     '用户名',
    email:        '邮箱',
    role:         '角色',
    status:       '状态',
    createdAt:    '创建时间',
    actions:      '操作',
    active:       '活跃',
    disabled:     '已禁用',
    disable:      '禁用',
    enable:       '启用',
    noUsers:      '未找到用户。',
    noPermission: '您没有权限查看此页面。',
    loading:      '加载中...',
    error:        '加载用户列表失败',
    confirmRole:  (role) => `确认将角色更改为"${role}"？`,
    confirmDisable: '确认禁用此用户？',
    confirmEnable:  '确认启用此用户？',
  },
  de: {
    title:        'Benutzerverwaltung',
    filterByRole: 'Nach Rolle filtern:',
    allRoles:     'Alle Rollen',
    username:     'Benutzername',
    email:        'E-Mail',
    role:         'Rolle',
    status:       'Status',
    createdAt:    'Erstellt am',
    actions:      'Aktionen',
    active:       'Aktiv',
    disabled:     'Deaktiviert',
    disable:      'Deaktivieren',
    enable:       'Aktivieren',
    noUsers:      'Keine Benutzer gefunden.',
    noPermission: 'Sie haben keine Berechtigung, diese Seite anzuzeigen.',
    loading:      'Wird geladen...',
    error:        'Fehler beim Laden der Benutzer',
    confirmRole:  (role) => `Rolle auf "${role}" ändern?`,
    confirmDisable: 'Möchten Sie diesen Benutzer wirklich deaktivieren?',
    confirmEnable:  'Möchten Sie diesen Benutzer wirklich aktivieren?',
  }
};

const ROLES = ['system', 'quality_engineer', 'warehouse_staff', 'lab_operator', 'disposal_manager', 'admin'];

const thStyle = {
  padding: '10px 12px', fontSize: '12px', fontWeight: 600,
  letterSpacing: '0.03em', textTransform: 'uppercase', textAlign: 'left',
  color: 'var(--text-secondary)', backgroundColor: 'var(--bg-surface-raised)',
  borderBottom: '1px solid var(--border-strong)', whiteSpace: 'nowrap'
};
const tdStyle = {
  padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)', fontSize: '14px'
};

function UserManagement() {
  const { token, user } = useAuth();
  const { lang } = useLang();
  const t = I18N[lang];

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/auth/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(res.data.data);
    } catch {
      setError(t.error);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    if (!window.confirm(t.confirmRole(newRole))) return;
    try {
      await axios.patch(
        `http://localhost:3000/api/auth/users/${userId}/role`,
        { role: newRole },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.message || t.error);
    }
  };

  const handleToggleActive = async (userId, currentStatus) => {
    if (!window.confirm(currentStatus ? t.confirmDisable : t.confirmEnable)) return;
    try {
      await axios.patch(
        `http://localhost:3000/api/auth/users/${userId}/active`,
        { is_active: !currentStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.message || t.error);
    }
  };

  if (user?.role !== 'admin') {
    return <p style={{ color: 'var(--text-secondary)' }}>{t.noPermission}</p>;
  }
  if (loading) return <p style={{ color: 'var(--text-secondary)' }}>{t.loading}</p>;
  if (error)   return <p style={{ color: 'var(--state-danger)' }}>{error}</p>;

  const filteredUsers = roleFilter ? users.filter(u => u.role === roleFilter) : users;

  return (
    <div>
      <h1>{t.title}</h1>

      <div style={{ marginBottom: '16px' }}>
        <label style={{ fontSize: '13px', color: 'var(--text-secondary)', marginRight: '8px' }}>
          {t.filterByRole}
        </label>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
          <option value="">{t.allRoles}</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        <table style={{ tableLayout: 'fixed', width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>{t.username}</th>
              <th style={thStyle}>{t.email}</th>
              <th style={thStyle}>{t.role}</th>
              <th style={thStyle}>{t.status}</th>
              <th style={thStyle}>{t.createdAt}</th>
              <th style={{ ...thStyle, cursor: 'default' }}>{t.actions}</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((u, idx) => {
              const isLast = idx === filteredUsers.length - 1;
              const td = (extra = {}) => ({ ...tdStyle, borderBottom: isLast ? 'none' : tdStyle.borderBottom, ...extra });
              return (
                <tr key={u.id}>
                  <td style={td()}>{u.username}</td>
                  <td style={td({ color: 'var(--text-secondary)' })}>{u.email}</td>
                  <td style={td()}>
                    <select value={u.role} onChange={e => handleRoleChange(u.id, e.target.value)}>
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td style={td()}>
                    <span className="status-badge" style={{
                      backgroundColor: u.is_active ? 'var(--state-success-soft)' : 'var(--state-danger-soft)',
                      color: u.is_active ? '#1E8E3E' : '#D70015'
                    }}>
                      <span className="status-dot" style={{ backgroundColor: u.is_active ? '#34C759' : '#FF3B30' }} />
                      {u.is_active ? t.active : t.disabled}
                    </span>
                  </td>
                  <td style={td({ color: 'var(--text-secondary)' })}>{new Date(u.created_at).toLocaleDateString()}</td>
                  <td style={td()}>
                    <button onClick={() => handleToggleActive(u.id, u.is_active)}>
                      {u.is_active ? t.disable : t.enable}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filteredUsers.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>{t.noUsers}</p>}
    </div>
  );
}

export default UserManagement;
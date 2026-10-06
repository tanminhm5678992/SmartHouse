import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, Plus, Trash2, Edit3, KeyRound, CheckCircle2, RefreshCw,
  AlertCircle, UserPlus, ShieldCheck,
} from 'lucide-react';
import { userApi } from '../api/axiosClient';

// Nhãn + màu hiển thị theo từng quyền (role)
const ROLE_BADGES = {
  admin: { label: 'Quản trị viên', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
  manager: { label: 'Quản lý', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
  user: { label: 'Người dùng', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
};

// Quyền admin chỉ dành cho tài khoản admin mặc định; admin gán được user/manager khi tạo hoặc sửa
const ASSIGNABLE_ROLES = [
  { value: 'user', label: 'Người dùng (user) - truy cập hệ thống bình thường' },
  { value: 'manager', label: 'Quản lý (manager) - truy cập hệ thống bình thường' },
];

const DEFAULT_FORM = { username: '', password: '', role: 'user' };

const formatDate = (iso) => (iso ? new Date(iso).toLocaleString('vi-VN') : '—');

export default function UserManager({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null); // null = thêm mới
  const [formData, setFormData] = useState({ ...DEFAULT_FORM });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await userApi.getAll();
      setUsers(res.data);
    } catch (err) {
      setLoadError(err.response?.data?.error || 'Không thể tải danh sách người dùng');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const openCreateModal = () => {
    setEditingUser(null);
    setFormError('');
    setFormData({ ...DEFAULT_FORM });
    setShowModal(true);
  };

  const openEditModal = (u) => {
    setEditingUser(u);
    setFormError('');
    // Giữ nguyên role hiện tại làm giá trị khởi tạo (kể cả 'admin');
    // chỉ gửi field role lên server khi admin thực sự thay đổi nó.
    setFormData({ username: u.username, password: '', role: u.role || 'user' });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      if (!editingUser) {
        // Thêm người dùng mới
        await userApi.create({
          username: formData.username.trim(),
          password: formData.password,
          role: formData.role,
        });
      } else {
        // Sửa tài khoản: chỉ gửi role nếu ĐÃ ĐỔI, chỉ gửi mật khẩu nếu CÓ NHẬP
        const payload = {};
        if (formData.role !== editingUser.role) payload.role = formData.role;
        if (formData.password) payload.password = formData.password;
        if (Object.keys(payload).length === 0) {
          setFormError('Bạn chưa thực hiện thay đổi nào');
          return;
        }
        await userApi.update(editingUser.id, payload);
      }
      setShowModal(false);
      await loadUsers();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Thao tác thất bại, vui lòng thử lại');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (u) => {
    if (!window.confirm(`Bạn có chắc muốn xóa tài khoản "${u.username}"?`)) return;
    try {
      await userApi.delete(u.id);
      await loadUsers();
    } catch (err) {
      alert(err.response?.data?.error || 'Không thể xóa tài khoản');
    }
  };


  return (
    <div style={{ marginTop: '20px' }}>
      <div className="section-header">
        <div className="section-title">
          <Users size={20} color="var(--primary)" />
          <span>Quản Lý Người Dùng & Phân Quyền</span>
          <span className="tag">Admin Only</span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="nav-tab-btn" onClick={loadUsers} disabled={loading}>
            <RefreshCw size={16} /> Tải Lại
          </button>
          <button className="btn-primary" onClick={openCreateModal}>
            <UserPlus size={18} /> Thêm Người Dùng Mới
          </button>
        </div>
      </div>

      {loadError && (
        <div className="error-message" style={{ marginBottom: '12px' }}>
          <AlertCircle size={14} /> {loadError}
        </div>
      )}

      <div className="chart-panel" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '24px', color: 'var(--text-dim)', textAlign: 'center' }}>
            Đang tải danh sách người dùng...
          </div>
        ) : users.length === 0 ? (
          <div style={{ padding: '24px', color: 'var(--text-dim)', textAlign: 'center' }}>
            Chưa có người dùng nào.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="logs-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Tên Đăng Nhập</th>
                  <th>Quyền</th>
                  <th>Ngày Tạo</th>
                  <th>Đăng Nhập Gần Nhất</th>
                  <th style={{ textAlign: 'right' }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const badge = ROLE_BADGES[u.role] || ROLE_BADGES.user;
                  const isSelf = currentUser && u.id === currentUser.id;
                  return (
                    <tr key={u.id} className={isSelf ? 'user-row-self' : ''}>
                      <td>{u.id}</td>
                      <td style={{ fontWeight: 700 }}>
                        {u.username}
                        {isSelf && <span className="user-self-tag">bạn</span>}
                      </td>
                      <td>
                        <span className="user-role-badge" style={{ color: badge.color, background: badge.bg }}>
                          <ShieldCheck size={12} /> {badge.label}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-dim)' }}>{formatDate(u.createdAt)}</td>
                      <td style={{ color: 'var(--text-dim)' }}>{formatDate(u.lastLogin)}</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          className="btn-icon"
                          title="Đổi quyền"
                          onClick={() => openEditModal(u)}
                          style={{ color: 'var(--accent-cyan)' }}
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          className="btn-icon"
                          title="Đặt lại mật khẩu"
                          onClick={() => openEditModal(u)}
                          style={{ color: '#f59e0b' }}
                        >
                          <KeyRound size={16} />
                        </button>
                        {!isSelf && (
                          <button
                            className="btn-icon"
                            title="Xóa tài khoản"
                            onClick={() => handleDelete(u)}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '6px', fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '10px', alignItems: 'center' }}>
        <AlertCircle size={13} />
        Người dùng (user) và Quản lý (manager) đăng nhập được nhưng KHÔNG thấy trang này; chỉ admin mới quản lý tài khoản.
      </div>

      {/* Modal Thêm / Sửa Người Dùng */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={20} color="var(--primary)" />
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem' }}>
                  {editingUser ? `Chỉnh Sửa Tài Khoản: ${editingUser.username}` : 'Thêm Người Dùng Mới'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '1.3rem', lineHeight: 1 }}
                title="Đóng"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {!editingUser && (
                <div className="form-group">
                  <label>Tên đăng nhập</label>
                  <input
                    type="text"
                    required
                    maxLength={50}
                    className="form-input"
                    placeholder="Ví dụ: nquoc"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  />
                </div>
              )}

              <div className="form-group">
                <label>{editingUser ? 'Mật khẩu mới (để trống nếu không đổi)' : 'Mật khẩu'}</label>
                <input
                  type="text"
                  required={!editingUser}
                  minLength={3}
                  className="form-input"
                  placeholder={editingUser ? 'Nhập mật khẩu mới...' : 'Tối thiểu 3 ký tự'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Quyền truy cập</label>
                <select
                  className="form-input"
                  value={formData.role}
                  disabled={editingUser && currentUser && editingUser.id === currentUser.id}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                >
                  {ASSIGNABLE_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                  {/* Giữ lựa chọn admin cho tài khoản admin hiện có (chỉ chọn được khi đang là admin) */}
                  {editingUser && editingUser.role === 'admin' && (
                    <option value="admin">Quản trị viên (admin) - xem tất cả trang</option>
                  )}
                </select>
                {editingUser && currentUser && editingUser.id === currentUser.id && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '6px' }}>
                    Bạn đang chỉnh sửa chính mình: không thể thay đổi quyền của tài khoản đang đăng nhập.
                  </div>
                )}
              </div>

              {formError && (
                <div className="error-message">
                  <AlertCircle size={14} /> {formError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button type="button" className="nav-tab-btn" onClick={() => setShowModal(false)}>
                  Hủy
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  <CheckCircle2 size={18} /> {editingUser ? 'Lưu Thay Đổi' : 'Tạo Người Dùng'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


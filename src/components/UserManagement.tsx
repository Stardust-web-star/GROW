import React, { useState, useEffect } from 'react';
import { UserAccount } from '../types';
import { 
  Users, UserPlus, Shield, ShieldCheck, Key, Search, Trash2, Edit, CheckCircle, 
  XCircle, RefreshCw, AlertTriangle, UserCheck, Lock, Building, Mail, Sparkles 
} from 'lucide-react';
import { saveUserToCloud, deleteUserFromCloud, subscribeToUsers } from '../lib/firebase';
import { INITIAL_USERS } from '../data/initialUsers';

interface UserManagementProps {
  currentUser: UserAccount | null;
}

export const UserManagement: React.FC<UserManagementProps> = ({ currentUser }) => {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('ALL');
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserAccount | null>(null);
  
  // Form states for Add User
  const [formUserId, setFormUserId] = useState<string>('');
  const [formName, setFormName] = useState<string>('');
  const [formRole, setFormRole] = useState<UserAccount['role']>('Petugas Yantek');
  const [formPassword, setFormPassword] = useState<string>('pln123');
  const [formUnit, setFormUnit] = useState<string>('ULP Baguala');
  const [formEmail, setFormEmail] = useState<string>('');
  const [formStatus, setFormStatus] = useState<UserAccount['status']>('Aktif');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);

  // Form states for Edit User
  const [editPassword, setEditPassword] = useState<string>('');
  const [editName, setEditName] = useState<string>('');
  const [editRole, setEditRole] = useState<UserAccount['role']>('Petugas Yantek');
  const [editStatus, setEditStatus] = useState<UserAccount['status']>('Aktif');
  const [editUnit, setEditUnit] = useState<string>('ULP Baguala');
  const [editEmail, setEditEmail] = useState<string>('');
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        if (data.users && data.users.length > 0) {
          setUsers(data.users);
          return;
        }
      }
    } catch (err) {
      // Backend not running (e.g. Vercel static), fallback to initial
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();

    // Subscribe to Firestore users collection in real time
    const unsub = subscribeToUsers((cloudUsers) => {
      if (cloudUsers && cloudUsers.length > 0) {
        setUsers(cloudUsers);
        setLoading(false);
      } else {
        // Seed initial users into Firestore on first setup
        INITIAL_USERS.forEach((u) => {
          saveUserToCloud(u).catch(() => {});
        });
        setUsers(INITIAL_USERS);
        setLoading(false);
      }
    }, () => {
      // If error subscribing, fallback to initial users
      setUsers(prev => prev.length > 0 ? prev : INITIAL_USERS);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const handleOpenEdit = (user: UserAccount) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditRole(user.role);
    setEditStatus(user.status);
    setEditUnit(user.unit || 'ULP Baguala');
    setEditEmail(user.email || '');
    setEditPassword('');
    setEditError(null);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formUserId.trim()) {
      setFormError('User ID / NIP wajib diisi.');
      return;
    }
    if (!formName.trim()) {
      setFormError('Nama lengkap pengguna wajib diisi.');
      return;
    }
    if (!formPassword.trim()) {
      setFormError('Password awal pengguna wajib diisi.');
      return;
    }

    setFormSubmitting(true);
    try {
      const cleanUserId = formUserId.trim();
      const newUser: UserAccount = {
        id: `USR-${cleanUserId}-${Date.now()}`,
        userId: cleanUserId,
        name: formName.trim(),
        role: formRole,
        password: formPassword.trim(),
        unit: formUnit.trim(),
        email: formEmail.trim() || undefined,
        status: formStatus,
        createdAt: new Date().toISOString().split('T')[0]
      };

      // Optimistic state update
      setUsers(prev => [newUser, ...prev]);

      // Save to Cloud Firestore (syncs across AI Studio and Vercel)
      await saveUserToCloud(newUser);

      // Also notify local server if available
      try {
        await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newUser)
        });
      } catch (e) {}

      setShowAddModal(false);
      // Reset form
      setFormUserId('');
      setFormName('');
      setFormPassword('pln123');
      setFormEmail('');
    } catch (err: any) {
      setFormError(err.message || 'Terjadi kesalahan saat membuat user.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditError(null);

    try {
      const updatedUser: UserAccount = {
        ...editingUser,
        name: editName.trim(),
        role: editRole,
        status: editStatus,
        unit: editUnit.trim(),
        email: editEmail.trim() || undefined
      };
      if (editPassword.trim()) {
        updatedUser.password = editPassword.trim();
      }

      // Optimistic state update
      setUsers(prev => prev.map(u => u.id === editingUser.id ? updatedUser : u));

      // Save to Cloud Firestore
      await saveUserToCloud(updatedUser);

      // Also notify local server
      try {
        await fetch(`/api/users/${encodeURIComponent(editingUser.id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedUser)
        });
      } catch (e) {}

      setEditingUser(null);
    } catch (err: any) {
      setEditError(err.message || 'Gagal memperbarui user.');
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    setDeleteError(null);
    try {
      // Optimistic state update
      setUsers(prev => prev.filter(u => u.id !== deletingUser.id));

      // Delete from Cloud Firestore
      await deleteUserFromCloud(deletingUser.id);

      // Also notify local server
      try {
        await fetch(`/api/users/${encodeURIComponent(deletingUser.id)}`, {
          method: 'DELETE'
        });
      } catch (e) {}

      setDeletingUser(null);
    } catch (err: any) {
      setDeleteError(err.message || 'Gagal menghapus user.');
    }
  };

  // Filter users
  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.userId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.email && user.email.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesRole = selectedRoleFilter === 'ALL' || user.role === selectedRoleFilter;
    return matchesSearch && matchesRole;
  });

  // Role pill color
  const getRoleBadge = (role: UserAccount['role']) => {
    switch (role) {
      case 'Administrator':
        return 'bg-rose-500/15 text-rose-300 border-rose-500/40';
      case 'Supervisor Teknik':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/40';
      case 'Operator GIS':
        return 'bg-sky-500/15 text-sky-300 border-sky-500/40';
      default:
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40';
    }
  };

  return (
    <div className="w-full min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8 bg-slate-950 text-slate-100 font-sans select-none">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Top Header Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20 shrink-0">
              <Users className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="font-black text-xl sm:text-2xl text-white tracking-tight">
                  Management User GROW
                </h1>
                <span className="bg-amber-400 text-slate-950 text-xs px-2.5 py-0.5 rounded-full font-black">
                  PLN ULP Baguala
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
                Kelola kredensial akun, NIP, hak akses peranan, dan izin akses personel untuk dashboard pemantauan jaringan GIS GROW.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={fetchUsers}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all border border-slate-700 cursor-pointer"
              title="Segarkan Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              onClick={() => {
                setFormError(null);
                setShowAddModal(true);
              }}
              className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black px-4 py-2.5 rounded-xl text-xs sm:text-sm shadow-md transition-all cursor-pointer active:scale-95"
            >
              <UserPlus className="w-4 h-4 stroke-[2.5]" />
              <span>+ Tambah User Baru</span>
            </button>
          </div>
        </div>

        {/* Stats Metrics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl shadow-md">
            <div className="text-xs font-semibold text-slate-400">Total Pengguna Terdaftar</div>
            <div className="text-2xl sm:text-3xl font-black text-white mt-1">{users.length}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Akun pegawai & personel</div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl shadow-md">
            <div className="text-xs font-semibold text-slate-400">Administrator Utama</div>
            <div className="text-2xl sm:text-3xl font-black text-amber-400 mt-1">
              {users.filter(u => u.role === 'Administrator').length}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Akses penuh sistem</div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl shadow-md">
            <div className="text-xs font-semibold text-slate-400">Supervisor & Lapangan</div>
            <div className="text-2xl sm:text-3xl font-black text-sky-400 mt-1">
              {users.filter(u => u.role === 'Supervisor Teknik' || u.role === 'Petugas Yantek').length}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Operasional & SPK</div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl shadow-md">
            <div className="text-xs font-semibold text-slate-400">Akun Berstatus Aktif</div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-400 mt-1">
              {users.filter(u => u.status === 'Aktif').length}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Siap login ke sistem</div>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl shadow-md flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari User ID, Nama, atau Email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-slate-400 font-semibold whitespace-nowrap">Filter Peran:</span>
            <select
              value={selectedRoleFilter}
              onChange={(e) => setSelectedRoleFilter(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-medium focus:outline-none focus:border-amber-400 cursor-pointer"
            >
              <option value="ALL">Semua Peran ({users.length})</option>
              <option value="Administrator">Administrator</option>
              <option value="Supervisor Teknik">Supervisor Teknik</option>
              <option value="Petugas Yantek">Petugas Yantek</option>
              <option value="Operator GIS">Operator GIS</option>
            </select>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-4">User ID / NIP</th>
                  <th className="p-4">Nama Lengkap</th>
                  <th className="p-4">Unit</th>
                  <th className="p-4">Peran (Role)</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Terdaftar</th>
                  <th className="p-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500 font-medium">
                      Tidak ada pengguna yang cocok dengan kriteria pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => {
                    const isMainAdmin = user.userId === '9925045ZY';
                    const isSelf = currentUser?.userId === user.userId;

                    return (
                      <tr key={user.id} className="hover:bg-slate-800/40 transition-colors">
                        
                        {/* User ID */}
                        <td className="p-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20 text-xs">
                              {user.userId}
                            </span>
                            {isMainAdmin && (
                              <span className="bg-rose-500/20 text-rose-300 text-[10px] px-1.5 py-0.2 rounded font-black border border-rose-500/30">
                                UTAMA
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Name & Email */}
                        <td className="p-4">
                          <div className="font-bold text-white text-sm">{user.name}</div>
                          {user.email && (
                            <div className="text-slate-400 text-[11px] flex items-center gap-1 mt-0.5">
                              <Mail className="w-3 h-3 text-slate-500" />
                              <span>{user.email}</span>
                            </div>
                          )}
                        </td>

                        {/* Unit */}
                        <td className="p-4 whitespace-nowrap text-slate-300 font-medium">
                          {user.unit || 'ULP Baguala'}
                        </td>

                        {/* Role */}
                        <td className="p-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${getRoleBadge(user.role)}`}>
                            <Shield className="w-3 h-3" />
                            <span>{user.role}</span>
                          </span>
                        </td>

                        {/* Status */}
                        <td className="p-4 whitespace-nowrap">
                          {user.status === 'Aktif' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 text-[11px]">
                              <CheckCircle className="w-3 h-3" />
                              <span>Aktif</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-400 font-bold bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20 text-[11px]">
                              <XCircle className="w-3 h-3" />
                              <span>Nonaktif</span>
                            </span>
                          )}
                        </td>

                        {/* Created At & Last Login */}
                        <td className="p-4 whitespace-nowrap text-slate-400">
                          <div>{user.createdAt}</div>
                          {user.lastLogin && (
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              Login: {user.lastLogin}
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="p-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(user)}
                              className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-sky-300 hover:text-white px-2.5 py-1.5 rounded-lg font-bold text-xs transition-colors border border-slate-700 cursor-pointer"
                              title="Ubah info / Reset Password"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>

                            <button
                              onClick={() => setDeletingUser(user)}
                              disabled={isMainAdmin}
                              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-bold text-xs transition-colors border cursor-pointer ${
                                isMainAdmin
                                  ? 'bg-slate-800/40 text-slate-600 border-slate-800 cursor-not-allowed'
                                  : 'bg-rose-950/40 hover:bg-rose-600 text-rose-300 hover:text-white border-rose-500/40'
                              }`}
                              title={isMainAdmin ? 'Akun utama tidak dapat dihapus' : 'Hapus user ini'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Hapus</span>
                            </button>
                          </div>
                        </td>

                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* MODAL 1: Tambah User Baru */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 text-slate-100 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-white">Tambah User Baru</h3>
                  <p className="text-xs text-slate-400">Buat kredensial akses baru ke Dashboard GROW</p>
                </div>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white text-lg">
                ✕
              </button>
            </div>

            {formError && (
              <div className="bg-rose-500/15 border border-rose-500/50 text-rose-300 text-xs p-3 rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    User ID / NIP <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: 9925046ZY"
                    value={formUserId}
                    onChange={(e) => setFormUserId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Nama Lengkap <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Budi Santoso, S.T."
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Password Akun <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Password awal"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Peran (Role)
                  </label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-white font-medium outline-none cursor-pointer"
                  >
                    <option value="Administrator">Administrator (Akses Penuh)</option>
                    <option value="Supervisor Teknik">Supervisor Teknik</option>
                    <option value="Petugas Yantek">Petugas Yantek (Lapangan)</option>
                    <option value="Operator GIS">Operator GIS</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Unit PLN
                  </label>
                  <input
                    type="text"
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Email (Opsional)
                  </label>
                  <input
                    type="email"
                    placeholder="nama@pln.co.id"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-white outline-none"
                  />
                </div>

              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Status Akun
                </label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="radio"
                      name="status"
                      checked={formStatus === 'Aktif'}
                      onChange={() => setFormStatus('Aktif')}
                      className="accent-amber-400"
                    />
                    <span className="text-emerald-400 font-bold">Aktif</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="radio"
                      name="status"
                      checked={formStatus === 'Nonaktif'}
                      onChange={() => setFormStatus('Nonaktif')}
                      className="accent-amber-400"
                    />
                    <span className="text-rose-400 font-bold">Nonaktif</span>
                  </label>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black transition-all cursor-pointer shadow-md disabled:opacity-50"
                >
                  {formSubmitting ? 'Menyimpan...' : 'Simpan User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Edit User & Reset Password */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 text-slate-100 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-black text-base text-white">Edit User & Hak Akses</h3>
                <p className="text-xs text-amber-400 font-mono font-bold">User ID: {editingUser.userId}</p>
              </div>
              <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-white text-lg">
                ✕
              </button>
            </div>

            {editError && (
              <div className="bg-rose-500/20 border border-rose-500/50 text-rose-300 text-xs p-3 rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Peran (Role)
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-white font-medium outline-none cursor-pointer"
                >
                  <option value="Administrator">Administrator</option>
                  <option value="Supervisor Teknik">Supervisor Teknik</option>
                  <option value="Petugas Yantek">Petugas Yantek</option>
                  <option value="Operator GIS">Operator GIS</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Reset Password Baru (Kosongkan jika tidak diubah)
                </label>
                <input
                  type="text"
                  placeholder="Ketik password baru..."
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Status Akun
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  disabled={editingUser.userId === '9925045ZY'}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-white font-medium outline-none cursor-pointer disabled:opacity-50"
                >
                  <option value="Aktif">Aktif</option>
                  <option value="Nonaktif">Nonaktif</option>
                </select>
                {editingUser.userId === '9925045ZY' && (
                  <p className="text-[10px] text-amber-400 mt-1">
                    *Akun Administrator utama tidak dapat dinonaktifkan.
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-black transition-all cursor-pointer shadow-md"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Konfirmasi Hapus User */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/50 rounded-2xl max-w-sm w-full p-6 text-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-black text-base text-white">Hapus User Ini?</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Apakah Anda yakin ingin menghapus user <b className="text-amber-400">{deletingUser.userId}</b> ({deletingUser.name})? Akses masuk user ini akan dicabut permanen.
            </p>
            {deleteError && (
              <div className="bg-rose-500/20 border border-rose-500/50 text-rose-300 text-xs p-2.5 rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{deleteError}</span>
              </div>
            )}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeletingUser(null)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleDeleteUser}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black cursor-pointer shadow-md"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
export default UserManagement;

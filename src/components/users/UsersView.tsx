import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import { User, DropPoint, Sector } from '../../types/index.ts';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Phone,
  Mail,
  Building2,
  MapPin,
  Shield,
  CheckCircle2,
  X,
  Loader2,
  RefreshCw,
  ArrowRightLeft,
  Send,
  MessageCircle,
  LayoutDashboard,
} from 'lucide-react';
import { ReassignSellerModal } from './ReassignSellerModal.tsx';
import { AvatarPicker } from '../common/AvatarPicker.tsx';
import { SendCredentialsModal } from './SendCredentialsModal.tsx';

interface UsersViewProps {
  initialRoleFilter?: string;
  title?: string;
  onNavigate?: (view: string) => void;
}

export const UsersView: React.FC<UsersViewProps> = ({ initialRoleFilter, title, onNavigate }) => {
  const { user: currentUser, switchRoleShortcut } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [dropPoints, setDropPoints] = useState<DropPoint[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>(initialRoleFilter || 'ALL');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [reassigningSeller, setReassigningSeller] = useState<User | null>(null);
  const [selectedUserForCredentials, setSelectedUserForCredentials] = useState<any | null>(null);
  const [lastCreatedTemporaryPassword, setLastCreatedTemporaryPassword] = useState<string>('6CDist@2026');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // New user form state
  const [formData, setFormData] = useState({
    role: initialRoleFilter === 'VRS' ? 'VRS' : 'VRS',
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    password: '',
    photo: '',
    dropPointId: currentUser?.dropPointId ? String(currentUser.dropPointId) : '',
    fssId: currentUser?.role === 'FSS' ? String(currentUser.id) : '',
    sectorId: '',
  });

  const loadData = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [usersRes, dpRes] = await Promise.all([
        api.getUsers(),
        api.getDropPoints(),
      ]);
      setUsers(usersRes.users);
      setDropPoints(dpRes.dropPoints);

      if (!formData.dropPointId) {
        if (currentUser?.dropPointId) {
          setFormData((prev) => ({ ...prev, dropPointId: String(currentUser.dropPointId) }));
        } else if (dpRes.dropPoints?.length > 0) {
          setFormData((prev) => ({ ...prev, dropPointId: String(dpRes.dropPoints[0].id) }));
        }
      }

      if (currentUser?.dropPointId) {
        const secRes = await api.getSectors(currentUser.dropPointId);
        setSectors(secRes.sectors);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Impossible de charger la liste des utilisateurs.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload: any = {
        role: formData.role,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        email: formData.email,
        photo: formData.photo || undefined,
        password: formData.password || undefined,
        dropPointId: formData.dropPointId ? parseInt(formData.dropPointId, 10) : undefined,
        fssId: formData.fssId ? parseInt(formData.fssId, 10) : undefined,
        sectorId: formData.sectorId ? parseInt(formData.sectorId, 10) : undefined,
      };

      const res = await api.createUser(payload);
      setSuccessMessage(`Utilisateur créé avec succès ! Identifiant généré : ${res.publicId}`);
      setIsCreateModalOpen(false);

      // Offer immediate credentials delivery
      const assignedDp = dropPoints.find((dp) => String(dp.id) === formData.dropPointId);
      const chosenPass = formData.password || '6CDist@2026';
      setLastCreatedTemporaryPassword(chosenPass);
      setSelectedUserForCredentials({
        id: res.user.id,
        publicId: res.publicId,
        firstName: formData.firstName,
        lastName: formData.lastName,
        role: formData.role,
        phone: formData.phone,
        email: formData.email,
        dropPointName: assignedDp?.name,
      });

      // Reset form
      setFormData({
        role: 'VRS',
        firstName: '',
        lastName: '',
        phone: '',
        email: '',
        password: '',
        photo: '',
        dropPointId: currentUser?.dropPointId ? String(currentUser.dropPointId) : '',
        fssId: currentUser?.role === 'FSS' ? String(currentUser.id) : '',
        sectorId: '',
      });
      loadData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur lors de la création.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.publicId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.phone && u.phone.includes(searchTerm));

    const matchesRole =
      roleFilter === 'ALL' || u.role === roleFilter;

    // If FSS viewing team, only show their VRS
    if (currentUser?.role === 'FSS' && (initialRoleFilter === 'VRS' || title?.includes('Mes Vendeurs'))) {
      return matchesSearch && u.role === 'VRS' && (u.fssId === currentUser.id || !u.fssId);
    }

    return matchesSearch && matchesRole;
  });

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'SALES_ADMIN_NATIONAL':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-950 text-purple-300 border border-purple-800/50">Sales Admin National</span>;
      case 'SALES_ADMIN':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-950 text-blue-300 border border-blue-800/50">Sales Admin</span>;
      case 'FSS':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-teal-950 text-teal-300 border border-teal-800/50">FSS (Superviseur)</span>;
      case 'VRS':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-950 text-amber-300 border border-amber-800/50">VRS (Terrain)</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-300">{role}</span>;
    }
  };

  const canCreateUser = currentUser?.role === 'SALES_ADMIN_NATIONAL';

  if (currentUser?.role === 'VRS') {
    return (
      <div className="p-8 sm:p-12 text-center bg-slate-900 border border-slate-800 rounded-2xl max-w-lg mx-auto mt-8 shadow-xl">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-4">
          <Shield className="w-7 h-7 text-amber-400" />
        </div>
        <h2 className="text-base sm:text-lg font-bold text-white mb-2">Accès restreint</h2>
        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
          Les vendeurs terrain (VRS) ne sont pas autorisés à accéder à la gestion des utilisateurs ni à l'affectation de VRS.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
            <Users className="w-6 h-6 sm:w-7 sm:h-7 text-red-500 shrink-0" />
            <span>{title || 'Gestion des Utilisateurs & Équipes'}</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Organisation hiérarchique conforme 6C Distribution : SAN &gt; Sales Admin &gt; FSS &gt; VRS.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={loadData}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition min-h-[42px] min-w-[42px] flex items-center justify-center shrink-0"
            title="Rafraîchir"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          {canCreateUser && (
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl shadow-sm transition min-h-[42px] active:scale-95"
            >
              <UserPlus className="w-4 h-4" />
              <span>Créer un utilisateur</span>
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button type="button" onClick={() => setSuccessMessage(null)} className="text-slate-400 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-red-950/60 border border-red-800 text-red-300 text-xs rounded-xl">
          {errorMessage}
        </div>
      )}

      {/* Filters bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher par nom, matricule, tel..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500 min-h-[42px]"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <span className="text-xs text-slate-400 flex items-center gap-1 shrink-0 mr-1">
            <Filter className="w-3.5 h-3.5" /> Rôle :
          </span>
          {['ALL', 'SALES_ADMIN_NATIONAL', 'SALES_ADMIN', 'FSS', 'VRS'].map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => setRoleFilter(role)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold shrink-0 transition min-h-[36px] ${
                roleFilter === role
                  ? 'bg-red-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {role === 'ALL'
                ? 'Tous'
                : role === 'SALES_ADMIN_NATIONAL'
                ? 'SAN'
                : role === 'SALES_ADMIN'
                ? 'SA'
                : role}
            </button>
          ))}
        </div>
      </div>

      {/* Users Grid / Table */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-red-500" />
          <span className="text-xs">Chargement des utilisateurs...</span>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="p-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-xl">
          <Users className="w-10 h-10 mx-auto mb-2 text-slate-600" />
          <p className="text-sm font-medium">Aucun utilisateur trouvé.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filteredUsers.map((u) => (
            <div
              key={u.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-700 transition"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    {u.photo ? (
                      <img
                        src={u.photo}
                        alt={`${u.firstName} ${u.lastName}`}
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 rounded-full object-cover border border-slate-700 shrink-0 shadow-xs"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-sm text-white shrink-0">
                        {u.firstName[0]}
                        {u.lastName[0]}
                      </div>
                    )}
                    <div>
                      <button
                        type="button"
                        onClick={async () => {
                          if (currentUser?.role === 'SALES_ADMIN_NATIONAL' && u.publicId !== currentUser.publicId) {
                            try {
                              await switchRoleShortcut(u.publicId);
                              if (typeof window !== 'undefined') {
                                window.location.hash = '#/dashboard';
                                try {
                                  localStorage.setItem('6c_active_tab', 'dashboard');
                                  localStorage.removeItem('6c_selected_pos_id');
                                } catch {}
                              }
                              if (onNavigate) onNavigate('dashboard');
                            } catch (err: any) {
                              alert(err.message || 'Impossible de basculer sur ce profil.');
                            }
                          }
                        }}
                        className="text-left group cursor-pointer"
                        title={currentUser?.role === 'SALES_ADMIN_NATIONAL' && u.publicId !== currentUser.publicId ? "Cliquer pour ouvrir le tableau de bord de ce profil" : undefined}
                      >
                        <div className="text-sm font-semibold text-white group-hover:text-[var(--color-green-text)] transition">
                          {u.firstName} {u.lastName}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400">{u.publicId}</div>
                      </button>
                    </div>
                  </div>
                  {getRoleBadge(u.role)}
                </div>

                <div className="space-y-2 text-xs text-slate-400 pt-2.5 border-t border-slate-800/80">
                  {u.phone && (
                    <a
                      href={`tel:${u.phone}`}
                      className="flex items-center gap-2 text-slate-300 hover:text-white transition group py-0.5"
                    >
                      <div className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 group-hover:bg-red-950">
                        <Phone className="w-3.5 h-3.5 text-slate-400 group-hover:text-red-400" />
                      </div>
                      <span className="font-mono">{u.phone}</span>
                    </a>
                  )}
                  {u.email && (
                    <a
                      href={`mailto:${u.email}`}
                      className="flex items-center gap-2 text-slate-300 hover:text-white transition group py-0.5"
                    >
                      <div className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 group-hover:bg-blue-950">
                        <Mail className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-400" />
                      </div>
                      <span className="truncate">{u.email}</span>
                    </a>
                  )}
                  {u.dropPointName && (
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                      <span className="truncate">{u.dropPointName}</span>
                    </div>
                  )}
                  {u.sectorName && (
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-amber-950/60 border border-amber-800/40 flex items-center justify-center shrink-0">
                        <MapPin className="w-3.5 h-3.5 text-amber-400" />
                      </div>
                      <span className="text-amber-400 font-medium truncate">{u.sectorName}</span>
                    </div>
                  )}
                  {u.fssName && (
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-teal-950/60 border border-teal-800/40 flex items-center justify-center shrink-0">
                        <Shield className="w-3.5 h-3.5 text-teal-400" />
                      </div>
                      <span className="truncate">Superviseur : {u.fssName}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Statut</span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/40 font-semibold">
                  {u.status || 'ACTIF'}
                </span>
              </div>

              {/* Action Buttons: Credentials delivery & Reassignment */}
              <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setLastCreatedTemporaryPassword('6CDist@2026');
                    setSelectedUserForCredentials(u);
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/40 text-[11px] font-semibold transition active:scale-95 shadow-xs"
                  title="Transmettre les identifiants sur WhatsApp et par Email"
                >
                  <Send className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Transmettre identifiants</span>
                </button>

                {currentUser?.role === 'SALES_ADMIN_NATIONAL' && u.publicId !== currentUser.publicId && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await switchRoleShortcut(u.publicId);
                        if (typeof window !== 'undefined') {
                          window.location.hash = '#/dashboard';
                          try {
                            localStorage.setItem('6c_active_tab', 'dashboard');
                            localStorage.removeItem('6c_selected_pos_id');
                          } catch {}
                        }
                        if (onNavigate) onNavigate('dashboard');
                      } catch (err: any) {
                        alert(err.message || 'Impossible de basculer sur ce profil.');
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--color-green-bg)] hover:opacity-90 text-[var(--color-green-text)] border border-[var(--color-green-border)] text-[11px] font-semibold transition active:scale-95 shadow-xs cursor-pointer"
                    title="Basculer et ouvrir le tableau de bord de ce profil"
                  >
                    <LayoutDashboard className="w-3.5 h-3.5 text-[var(--color-green-text)]" />
                    <span>Tableau de bord</span>
                  </button>
                )}

                {currentUser?.role === 'SALES_ADMIN_NATIONAL' && (u.role === 'VRS' || u.role === 'FSS') && (
                  <button
                    type="button"
                    onClick={() => setReassigningSeller(u)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[11px] font-semibold transition shadow-xs"
                    title="Affecter ce vendeur à un autre Dépôt / Drop Point"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5 text-amber-400" />
                    <span>Dépôt</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Créer Utilisateur */}
      {isCreateModalOpen && currentUser?.role === 'SALES_ADMIN_NATIONAL' && (
        <div
          onClick={() => setIsCreateModalOpen(false)}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs overflow-y-auto animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-2xl w-full max-w-lg max-h-[94vh] sm:max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
          >
            {/* Drag handle */}
            <div className="sm:hidden w-12 h-1.5 bg-slate-700 rounded-full mx-auto mt-2.5 mb-1 shrink-0" />

            <div className="flex-shrink-0 px-5 py-3.5 sm:px-6 sm:py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-red-500" />
                <span>Créer un nouvel utilisateur</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition min-w-[36px] min-h-[36px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="flex flex-col flex-1 overflow-hidden min-h-0 text-xs">
              <div className="overflow-y-auto p-4 sm:p-6 space-y-4 flex-1">
                {errorMessage && (
                  <div className="p-3 bg-red-950/80 border border-red-800 text-red-300 text-xs rounded-xl flex items-center justify-between">
                    <span>{errorMessage}</span>
                    <button type="button" onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-white p-1">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Rôle *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white min-h-[42px]"
                  >
                    {currentUser?.role === 'SALES_ADMIN_NATIONAL' && (
                      <>
                        <option value="SALES_ADMIN">Sales Admin (SA)</option>
                        <option value="FSS">FSS (Superviseur)</option>
                      </>
                    )}
                    {(currentUser?.role === 'SALES_ADMIN_NATIONAL' || currentUser?.role === 'SALES_ADMIN') && (
                      <option value="FSS">FSS (Superviseur)</option>
                    )}
                    <option value="VRS">VRS (Vendeur Terrain)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Drop Point (Dépôt) *</label>
                  <select
                    value={formData.dropPointId}
                    onChange={(e) => setFormData({ ...formData, dropPointId: e.target.value })}
                    disabled={currentUser?.role !== 'SALES_ADMIN_NATIONAL'}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white disabled:opacity-50 min-h-[42px]"
                  >
                    <option value="">Sélectionner un Drop Point</option>
                    {dropPoints.map((dp) => (
                      <option key={dp.id} value={dp.id}>
                        {dp.name} ({dp.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Prénom *</label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white min-h-[42px]"
                    placeholder="Ex: Moussa"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Nom *</label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white min-h-[42px]"
                    placeholder="Ex: Coulibaly"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Téléphone *</label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white min-h-[42px]"
                    placeholder="Ex: +223 70 00 11 22"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Email <span className="text-[10px] text-slate-500 font-normal">(optionnel, auto-généré si vide)</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white min-h-[42px]"
                    placeholder="Ex: m.coulibaly@6c.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Mot de passe provisoire (optionnel)</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white min-h-[42px]"
                  placeholder="Défaut: 6CDist@2026"
                />
              </div>

              {/* Optional Photo Picker for profile */}
              <div className="pt-1">
                <AvatarPicker
                  value={formData.photo}
                  onChange={(photoUrl) => setFormData({ ...formData, photo: photoUrl })}
                  label="Photo de profil"
                  initials={`${formData.firstName?.[0] || '6'}${formData.lastName?.[0] || 'C'}`}
                  isOptional={true}
                />
              </div>

                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl text-[11px] text-slate-400">
                  💡 Le matricule officiel (ex: <strong className="text-white">6CDISTVRS-DKN-002</strong>) sera automatiquement généré et calculé selon le drop point et la fonction.
                </div>
              </div>

              <div className="flex-shrink-0 flex flex-col-reverse sm:flex-row items-center justify-end gap-2 sm:gap-3 p-4 sm:px-6 sm:py-3.5 border-t border-slate-800 bg-slate-950/90">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="w-full sm:w-auto px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition min-h-[44px] flex items-center justify-center font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50 min-h-[44px]"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  <span>Créer l'utilisateur</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reassign Seller Modal for National Admin */}
      <ReassignSellerModal
        isOpen={!!reassigningSeller}
        seller={reassigningSeller}
        onClose={() => setReassigningSeller(null)}
        onSuccess={() => {
          setSuccessMessage('Vendeur réaffecté avec succès au nouveau Dépôt ! Les notifications ont été envoyées.');
          loadData();
          setTimeout(() => setSuccessMessage(null), 5000);
        }}
      />

      {/* Send Credentials Modal */}
      <SendCredentialsModal
        isOpen={!!selectedUserForCredentials}
        user={selectedUserForCredentials}
        initialTemporaryPassword={lastCreatedTemporaryPassword}
        onClose={() => setSelectedUserForCredentials(null)}
      />
    </div>
  );
};

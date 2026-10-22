import React, { useEffect, useState } from 'react';
import { api } from '../../services/api.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { NotificationItem } from '../../types/index.ts';
import {
  Bell,
  CheckCheck,
  Check,
  X,
  Loader2,
  Clock,
  AlertTriangle,
  Info,
  CheckCircle2,
  Truck,
  ShoppingCart,
  Boxes,
  ArrowRight,
  ChevronLeft,
  Calendar,
  ExternalLink,
  Store,
  FileCheck2,
  Compass,
} from 'lucide-react';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (tab: string) => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
}) => {
  const { user, refreshNotifications } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNotification, setSelectedNotification] = useState<NotificationItem | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'UNREAD'>('ALL');

  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      const res = await api.getNotifications();
      setNotifications(res.notifications);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
      setSelectedNotification(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleMarkAsRead = async (id: number) => {
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n))
      );
      if (selectedNotification && selectedNotification.id === id) {
        setSelectedNotification({ ...selectedNotification, is_read: 1 });
      }
      refreshNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
      if (selectedNotification) {
        setSelectedNotification({ ...selectedNotification, is_read: 1 });
      }
      refreshNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const handleClickNotification = (n: NotificationItem) => {
    if (!n.is_read) {
      handleMarkAsRead(n.id);
    }
    // Explicitly display the notification details on click
    setSelectedNotification(n);
  };

  const handleActionNavigate = (n: NotificationItem) => {
    const destination = n.link || getFallbackLink(n.type);
    if (destination && onNavigate) {
      onClose();
      onNavigate(destination);
    }
  };

  const getFallbackLink = (type?: string) => {
    switch (type) {
      case 'TOUR':
        return 'tours';
      case 'SUPPLY':
        return 'supply-requests';
      case 'SALE':
        return 'sales';
      case 'STOCK':
        return 'stocks';
      case 'VISIT':
        return 'visits';
      case 'POS':
      case 'PDV':
        return 'pos';
      case 'RECEIPT':
      case 'BL':
        return 'receipts';
      default:
        return 'dashboard';
    }
  };

  const getTypeIcon = (type?: string) => {
    switch (type) {
      case 'TOUR':
        return <Compass className="w-4 h-4 text-cyan-400" />;
      case 'SUPPLY':
        return <Truck className="w-4 h-4 text-blue-400" />;
      case 'SALE':
        return <ShoppingCart className="w-4 h-4 text-emerald-400" />;
      case 'STOCK':
        return <Boxes className="w-4 h-4 text-amber-400" />;
      case 'VISIT':
        return <Calendar className="w-4 h-4 text-purple-400" />;
      case 'POS':
      case 'PDV':
        return <Store className="w-4 h-4 text-emerald-400" />;
      case 'RECEIPT':
      case 'BL':
        return <FileCheck2 className="w-4 h-4 text-blue-400" />;
      default:
        return <Info className="w-4 h-4 text-slate-400" />;
    }
  };

  const getTypeLabel = (type?: string) => {
    switch (type) {
      case 'TOUR':
        return 'Proposition de Tournée';
      case 'SUPPLY':
        return 'Approvisionnement';
      case 'SALE':
        return 'Vente Réalisée';
      case 'STOCK':
        return 'Alerte Stock';
      case 'VISIT':
        return 'Visite Terrain';
      case 'POS':
      case 'PDV':
        return 'Nouveau PDV';
      case 'RECEIPT':
      case 'BL':
        return 'Bon de Livraison';
      default:
        return 'Notification';
    }
  };

  const formatRelativeTime = (dateStr?: string) => {
    if (!dateStr) return 'À l\'instant';
    try {
      const date = new Date(dateStr.replace(' ', 'T'));
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      if (isNaN(diffMs)) return dateStr;
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'À l\'instant';
      if (diffMins < 60) return `Il y a ${diffMins} min`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `Il y a ${diffHours} h`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return 'Hier';
      if (diffDays < 7) return `Il y a ${diffDays} j`;
      return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
    } catch {
      return dateStr;
    }
  };

  const getActionLabel = (type?: string, link?: string) => {
    if (link === 'dp-supply-requests' || link === '/dp-supply-requests') {
      return user?.role === 'SALES_ADMIN' ? 'Voir mes commandes' : 'Voir les commandes stock';
    }
    switch (type) {
      case 'TOUR':
        return 'Examiner la proposition de tournée';
      case 'SUPPLY':
        return user?.role === 'VRS'
          ? 'Voir mes chargements'
          : user?.role === 'SALES_ADMIN'
          ? 'Voir les chargements VRS'
          : 'Voir les commandes stock';
      case 'SALE':
        return user?.role === 'VRS' ? 'Voir mes ventes' : 'Voir les ventes';
      case 'STOCK':
        return user?.role === 'VRS' ? 'Voir mon stock' : 'Voir les stocks';
      case 'VISIT':
        return 'Voir les visites';
      case 'POS':
      case 'PDV':
        return 'Consulter les points de vente';
      case 'RECEIPT':
      case 'BL':
        return 'Consulter les réceptions';
      default:
        return 'Accéder à la section';
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const filteredNotifications = filter === 'UNREAD'
    ? notifications.filter((n) => !n.is_read)
    : notifications;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-end md:p-4 bg-black/60 backdrop-blur-xs animate-modal-backdrop"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-800 rounded-none md:rounded-2xl w-full md:max-w-md h-full md:h-auto md:max-h-[85vh] flex flex-col shadow-2xl overflow-hidden mt-0 md:mt-16 animate-drawer-right md:animate-modal-content"
      >
        {/* Top Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 shrink-0">
          <div className="flex items-center gap-2.5">
            {selectedNotification ? (
              <button
                type="button"
                onClick={() => setSelectedNotification(null)}
                className="flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition mr-1 cursor-pointer"
                title="Retour à la liste"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-red-950/60 border border-red-800/40 flex items-center justify-center shrink-0">
                <Bell className="w-5 h-5 text-red-400" />
              </div>
            )}
            <div>
              <h2 className="font-bold text-white text-base font-display">
                {selectedNotification ? 'Détail de la Notification' : 'Notifications Système'}
              </h2>
              {!selectedNotification && (
                <div className="text-sm text-slate-400 font-medium">
                  {unreadCount > 0 ? `${unreadCount} non lue(s)` : 'Toutes les notifications sont lues'}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!selectedNotification && unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                className="text-sm text-slate-300 hover:text-emerald-400 flex items-center gap-1.5 transition px-3 py-2 rounded-xl hover:bg-slate-800 border border-slate-800 min-h-[44px] cursor-pointer font-medium"
                title="Tout marquer comme lu"
              >
                <CheckCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="hidden sm:inline">Tout marquer comme lu</span>
                <span className="sm:hidden">Tout lire</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
              title="Fermer"
              aria-label="Fermer"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Filter Bar (Only when list is visible) */}
        {!selectedNotification && (
          <div className="px-4 py-2 bg-slate-950/40 border-b border-slate-800/80 flex items-center justify-between gap-2 text-sm shrink-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer min-h-[36px] ${
                  filter === 'ALL'
                    ? 'bg-slate-800 text-white font-bold shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Toutes ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('UNREAD')}
                className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer min-h-[36px] ${
                  filter === 'UNREAD'
                    ? 'bg-red-950/60 text-red-300 border border-red-800/50 font-bold shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Non lues ({unreadCount})
              </button>
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                className="text-sm text-emerald-400 hover:text-emerald-300 hover:underline font-semibold cursor-pointer"
              >
                Tout marquer comme lu
              </button>
            )}
          </div>
        )}

        {/* Body content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
              <span className="text-sm">Chargement des notifications...</span>
            </div>
          ) : selectedNotification ? (
            /* Selected Notification Full Display */
            <div className="bg-slate-950/80 border border-slate-700/80 rounded-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">
                    {getTypeIcon(selectedNotification.type)}
                  </div>
                  <div>
                    <span className="text-sm font-bold uppercase tracking-[0.04em] px-2.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                      {getTypeLabel(selectedNotification.type)}
                    </span>
                    <div className="text-sm text-slate-400 mt-1 flex items-center gap-1.5 font-medium">
                      <Clock className="w-4 h-4 text-slate-500" />
                      <span>{formatRelativeTime(selectedNotification.created_at)}</span>
                    </div>
                  </div>
                </div>

                <span className="px-2.5 py-1 text-sm rounded-full font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1">
                  <Check className="w-4 h-4" />
                  Lue
                </span>
              </div>

              <div>
                <h3 className="text-base font-bold text-white leading-snug font-display">
                  {selectedNotification.title}
                </h3>
                <div className="mt-3 p-4 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {selectedNotification.message}
                </div>
              </div>

              {/* Action Button to navigate directly to the affected section */}
              <div className="pt-2 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => handleActionNavigate(selectedNotification)}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 transition cursor-pointer min-h-[44px]"
                >
                  <span>{getActionLabel(selectedNotification.type, selectedNotification.link)}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedNotification(null)}
                  className="w-full py-2.5 px-3 rounded-xl border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 text-sm font-medium transition cursor-pointer min-h-[44px]"
                >
                  Retour à la liste des notifications
                </button>
              </div>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm space-y-2">
              <CheckCircle2 className="w-8 h-8 mx-auto text-slate-600 mb-2" />
              <p>Aucune notification {filter === 'UNREAD' ? 'non lue' : 'enregistrée'}.</p>
            </div>
          ) : (
            filteredNotifications.map((n) => {
              const isRead = Boolean(n.is_read);
              return (
                <div
                  key={n.id}
                  onClick={() => handleClickNotification(n)}
                  className={`p-4 rounded-2xl border text-sm cursor-pointer transition transform active:scale-[0.99] ${
                    isRead
                      ? 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:bg-slate-900/60'
                      : 'bg-slate-800/90 border-slate-700 text-slate-200 ring-1 ring-red-500/30 hover:bg-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-700/80 flex items-center justify-center shrink-0 mt-0.5">
                        {getTypeIcon(n.type)}
                      </div>
                      <div>
                        <div className="font-bold text-white flex items-center gap-1.5 text-sm sm:text-base">
                          {!isRead && (
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 animate-pulse" />
                          )}
                          <span>{n.title}</span>
                        </div>
                        <div className="text-sm text-slate-400 mt-0.5 font-medium">
                          {getTypeLabel(n.type)}
                        </div>
                      </div>
                    </div>
                    <span className="text-sm font-mono text-slate-400 shrink-0 font-medium">
                      {formatRelativeTime(n.created_at)}
                    </span>
                  </div>

                  <p className="mt-2 text-sm leading-relaxed text-slate-300 line-clamp-2 pl-11">
                    {n.message}
                  </p>

                  <div className="mt-3 pl-11 flex items-center justify-between">
                    <span className="text-sm text-emerald-400 font-semibold flex items-center gap-1 hover:underline">
                      <span>Consulter</span>
                      <ArrowRight className="w-4 h-4" />
                    </span>

                    {!isRead && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkAsRead(n.id);
                        }}
                        className="text-sm text-slate-400 hover:text-emerald-400 hover:underline flex items-center gap-1 min-h-[36px] py-1 px-2 cursor-pointer font-medium"
                      >
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>Marquer comme lu</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

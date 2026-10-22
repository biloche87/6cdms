import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import {
  Search,
  X,
  Store,
  ShoppingCart,
  Boxes,
  Truck,
  Users,
  Compass,
  FileText,
  FileCheck2,
  Plus,
  ArrowRight,
  TrendingUp,
  MapPin,
  Clock,
  Loader2,
} from 'lucide-react';

interface GlobalSearchPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: string) => void;
  onOpenNewSale: (posId?: number) => void;
  onOpenNewPos: () => void;
  onOpenNewSupply: () => void;
  onOpenNewReceipt: () => void;
  onSelectPos?: (posId: number) => void;
}

export const GlobalSearchPalette: React.FC<GlobalSearchPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onOpenNewSale,
  onOpenNewPos,
  onOpenNewSupply,
  onOpenNewReceipt,
  onSelectPos,
}) => {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{
    pos: any[];
    sales: any[];
    products: any[];
    users: any[];
  }>({
    pos: [],
    sales: [],
    products: [],
    users: [],
  });

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setQuery('');
      setResults({ pos: [], sales: [], products: [], users: [] });
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Search when query changes
  useEffect(() => {
    if (!isOpen) return;
    const clean = query.trim().toLowerCase();
    if (!clean) {
      setResults({ pos: [], sales: [], products: [], users: [] });
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const [posRes, salesRes, prodRes, usersRes] = await Promise.allSettled([
          api.getPointsOfSale({ search: clean }),
          api.getSales({ search: clean, limit: 5 }),
          api.getProducts(),
          user?.role !== 'VRS' ? api.getUsers() : Promise.resolve({ users: [] }),
        ]);

        const matchedPos = posRes.status === 'fulfilled' ? (posRes.value.pointsOfSale || []).slice(0, 5) : [];
        const matchedSales = salesRes.status === 'fulfilled' ? (salesRes.value.sales || []).slice(0, 5) : [];
        const matchedProds = prodRes.status === 'fulfilled'
          ? (prodRes.value.products || [])
              .filter((p: any) => p.name?.toLowerCase().includes(clean) || p.code?.toLowerCase().includes(clean) || p.category?.toLowerCase().includes(clean))
              .slice(0, 4)
          : [];
        const matchedUsers = usersRes.status === 'fulfilled'
          ? (usersRes.value.users || [])
              .filter((u: any) => `${u.firstName} ${u.lastName}`.toLowerCase().includes(clean) || u.publicId?.toLowerCase().includes(clean))
              .slice(0, 4)
          : [];

        setResults({
          pos: matchedPos,
          sales: matchedSales,
          products: matchedProds,
          users: matchedUsers,
        });
      } catch {
        // quiet fallback
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query, isOpen, user?.role]);

  if (!isOpen) return null;

  const totalResults = results.pos.length + results.sales.length + results.products.length + results.users.length;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[70] flex items-start justify-center p-3 sm:p-6 sm:pt-16 bg-black/75 backdrop-blur-xs animate-modal-backdrop"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-modal-content"
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-800 bg-slate-950/70 gap-3">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un PDV, une vente, un produit, un utilisateur..."
            className="flex-1 bg-transparent text-sm sm:text-base text-white placeholder-slate-500 focus:outline-none"
          />
          {loading && <Loader2 className="w-4 h-4 text-emerald-400 animate-spin shrink-0" />}
          {query && !loading && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-slate-400 hover:text-white p-1 rounded transition"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <span className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-400 border border-slate-700">
            ESC
          </span>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Quick Actions if query is empty */}
          {!query && (
            <div className="space-y-4">
              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Actions Rapides Immédiates</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenNewSale();
                    }}
                    className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 hover:border-emerald-500/50 text-left transition group cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                      <ShoppingCart className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white group-hover:text-emerald-300">Enregistrer une Vente</div>
                      <div className="text-[11px] text-slate-400">Prise de commande déstockée</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenNewPos();
                    }}
                    className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 hover:border-blue-500/50 text-left transition group cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0">
                      <Store className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white group-hover:text-blue-300">Nouveau PDV</div>
                      <div className="text-[11px] text-slate-400">Nouveau client terrain géolocalisé</div>
                    </div>
                  </button>

                  {(user?.role === 'SALES_ADMIN' || user?.role === 'SALES_ADMIN_NATIONAL') && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenNewReceipt();
                      }}
                      className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 hover:border-purple-500/50 text-left transition group cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-lg bg-purple-500/15 text-purple-400 flex items-center justify-center shrink-0">
                        <FileCheck2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white group-hover:text-purple-300">Réception</div>
                        <div className="text-[11px] text-slate-400">Entrée en stock Dépôt</div>
                      </div>
                    </button>
                  )}

                  {user?.role === 'VRS' && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenNewSupply();
                      }}
                      className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 hover:border-amber-500/50 text-left transition group cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
                        <Truck className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white group-hover:text-amber-300">
                          Mon chargement
                        </div>
                        <div className="text-[11px] text-slate-400">Recharger le stock terrain</div>
                      </div>
                    </button>
                  )}
                </div>
              </div>

              {/* Quick Navigation Sections */}
              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Navigation Rapide
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {[
                    { id: 'dashboard', label: 'Tableau de bord', icon: TrendingUp },
                    { id: 'pos', label: 'Points de Vente', icon: Store },
                    { id: 'sales', label: user?.role === 'VRS' ? 'Mes ventes' : 'Ventes', icon: ShoppingCart },
                    { id: 'stocks', label: 'Stocks', icon: Boxes },
                    { id: 'tours', label: 'Tournées & Visites', icon: Compass },
                    { id: 'stats', label: 'Statistiques', icon: FileText },
                  ].map((nav) => {
                    const Icon = nav.icon;
                    return (
                      <button
                        key={nav.id}
                        type="button"
                        onClick={() => {
                          onClose();
                          onNavigate(nav.id);
                        }}
                        className="p-2.5 rounded-xl bg-slate-950/40 hover:bg-slate-800 border border-slate-800 text-left flex items-center gap-2 text-slate-300 hover:text-white transition cursor-pointer"
                      >
                        <Icon className="w-3.5 h-3.5 text-slate-400" />
                        <span className="truncate font-medium">{nav.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Results: Points of Sale */}
          {results.pos.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-blue-400" />
                  <span>Points de Vente ({results.pos.length})</span>
                </span>
                <span className="text-[11px] text-slate-500 font-mono">PDV</span>
              </div>
              <div className="space-y-1.5">
                {results.pos.map((p) => (
                  <div
                    key={`search-pos-${p.id}`}
                    onClick={() => {
                      onClose();
                      if (onSelectPos) {
                        onSelectPos(p.id);
                      } else {
                        onNavigate('pos');
                      }
                    }}
                    className="p-3 rounded-xl bg-slate-950/70 hover:bg-slate-800/90 border border-slate-800 flex items-center justify-between gap-3 cursor-pointer group transition"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-white group-hover:text-blue-300 flex items-center gap-2">
                        <span>{p.name}</span>
                        {p.code && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                            {p.code}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-3 mt-0.5 truncate">
                        {p.managerName && <span>Gérant: {p.managerName}</span>}
                        {p.sectorName && <span>• {p.sectorName}</span>}
                        {p.totalSalesCount !== undefined && (
                          <span className="text-emerald-400 font-medium">
                            • {p.totalSalesCount} vente(s)
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onClose();
                          onOpenNewSale(p.id);
                        }}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1 transition"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Vendre</span>
                      </button>
                      <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Results: Sales */}
          {results.sales.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <ShoppingCart className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Ventes Récentes ({results.sales.length})</span>
                </span>
                <span className="text-[11px] text-slate-500 font-mono">VENTES</span>
              </div>
              <div className="space-y-1.5">
                {results.sales.map((s) => (
                  <div
                    key={`search-sale-${s.id}`}
                    onClick={() => {
                      onClose();
                      onNavigate('sales');
                    }}
                    className="p-3 rounded-xl bg-slate-950/70 hover:bg-slate-800/90 border border-slate-800 flex items-center justify-between gap-3 cursor-pointer group transition"
                  >
                    <div>
                      <div className="font-bold text-sm text-white group-hover:text-emerald-300 flex items-center gap-2">
                        <span>{s.saleNumber || `VNT-${s.id}`}</span>
                        <span className="text-emerald-400 font-mono text-xs">
                          {Number(s.totalAmount || 0).toLocaleString('fr-FR')} FCFA
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                        <span>{s.pointOfSaleName || 'PDV Inconnu'}</span>
                        <span>•</span>
                        <span>{s.vrsName || 'Vendeur'}</span>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Results: Products */}
          {results.products.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Boxes className="w-3.5 h-3.5 text-amber-400" />
                  <span>Produits ({results.products.length})</span>
                </span>
                <span className="text-[11px] text-slate-500 font-mono">STOCK</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {results.products.map((prd) => (
                  <div
                    key={`search-prd-${prd.id}`}
                    onClick={() => {
                      onClose();
                      onNavigate('stocks');
                    }}
                    className="p-3 rounded-xl bg-slate-950/70 hover:bg-slate-800/90 border border-slate-800 flex items-center justify-between gap-2 cursor-pointer group transition"
                  >
                    <div>
                      <div className="font-bold text-xs text-white group-hover:text-amber-300 truncate">
                        {prd.name}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {Number(prd.pricePerCarton || 0).toLocaleString('fr-FR')} FCFA / carton
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Results: Users */}
          {results.users.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-teal-400" />
                  <span>Collaborateurs ({results.users.length})</span>
                </span>
                <span className="text-[11px] text-slate-500 font-mono">ÉQUIPE</span>
              </div>
              <div className="space-y-1.5">
                {results.users.map((u) => (
                  <div
                    key={`search-user-${u.id}`}
                    onClick={() => {
                      onClose();
                      onNavigate('users');
                    }}
                    className="p-3 rounded-xl bg-slate-950/70 hover:bg-slate-800/90 border border-slate-800 flex items-center justify-between gap-2 cursor-pointer group transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-slate-800 text-white font-bold text-xs flex items-center justify-center border border-slate-700">
                        {u.firstName?.[0] || 'U'}
                      </div>
                      <div>
                        <div className="font-semibold text-xs text-white group-hover:text-teal-300">
                          {u.firstName} {u.lastName}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {u.publicId} • {u.role}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state if query produced 0 results */}
          {query && !loading && totalResults === 0 && (
            <div className="p-8 text-center text-slate-400 space-y-2">
              <Search className="w-8 h-8 mx-auto text-slate-600 mb-2" />
              <p className="text-sm font-semibold text-white">Aucun résultat trouvé pour "{query}"</p>
              <p className="text-xs text-slate-500">
                Essayez avec un nom de magasin, un numéro de vente, un code produit ou un collaborateur.
              </p>
            </div>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono border border-slate-700">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono border border-slate-700">K</kbd> Recherche
            </span>
            <span className="hidden sm:inline">•</span>
            <span className="hidden sm:inline">6C DMS Pro Search</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

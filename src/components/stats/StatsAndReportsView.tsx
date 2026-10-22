import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api, getStoredToken } from '../../services/api.ts';
import { apiCache } from '../../services/apiCache.ts';
import {
  BarChart3,
  FileSpreadsheet,
  Download,
  Calendar,
  DollarSign,
  Boxes,
  TrendingUp,
  Store,
  FileText,
  CheckCircle2,
  RefreshCw,
  Loader2,
} from 'lucide-react';

interface StatsAndReportsProps {
  initialTab?: 'stats' | 'reports';
}

export const StatsAndReportsView: React.FC<StatsAndReportsProps> = ({
  initialTab = 'stats',
}) => {
  const { user } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'stats' | 'reports'>(initialTab);
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingType, setDownloadingType] = useState<string | null>(null);

  const loadStats = async (forceRefresh = false) => {
    setIsLoading(true);
    try {
      if (forceRefresh) {
        apiCache.invalidate('dashboard-stats');
      }
      const res = await api.getDashboardStats({ forceRefresh });
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStats(true);

    const handleSaleRecorded = () => {
      loadStats(true);
    };
    window.addEventListener('6c:sale-recorded', handleSaleRecorded);
    return () => window.removeEventListener('6c:sale-recorded', handleSaleRecorded);
  }, []);

  const handleDownloadCsv = async (type: 'sales' | 'stock' | 'pos') => {
    setDownloadingType(type);
    try {
      const token = getStoredToken();
      const response = await fetch(`/api/stats/export/csv?type=${type}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        throw new Error('Erreur lors du téléchargement du fichier CSV.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `6C_Distribution_${type}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(err.message || 'Échec du téléchargement.');
    } finally {
      setDownloadingType(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            {activeSubTab === 'stats' ? (
              <BarChart3 className="w-7 h-7 text-red-500" />
            ) : (
              <FileSpreadsheet className="w-7 h-7 text-emerald-500" />
            )}
            <span>
              {activeSubTab === 'stats'
                ? 'Statistiques'
                : 'Rapports'}
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Analyse des volumes de ventes, répartition par catégories et extraction des données certifiées.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveSubTab('stats')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
              activeSubTab === 'stats'
                ? 'bg-red-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Statistiques</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('reports')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
              activeSubTab === 'reports'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Rapports</span>
          </button>
          <button
            type="button"
            onClick={() => loadStats(true)}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg"
            title="Rafraîchir"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-16 text-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-red-500" />
          <span className="text-xs">Chargement des données analytiques...</span>
        </div>
      ) : activeSubTab === 'stats' ? (
        <div className="space-y-6">
          {/* Key Metric summary row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span>Ventes du Jour</span>
                <Calendar className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-white">
                {(data?.kpis?.salesTodayAmount || 0).toLocaleString('fr-FR')} <span className="text-xs font-normal text-slate-400">FCFA</span>
              </div>
              <div className="text-xs text-emerald-400 mt-1 font-medium">
                {data?.kpis?.salesTodayCount || 0} commandes • {data?.kpis?.salesTodayCartons || 0} cartons
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span>Chiffre d'Affaires Mensuel</span>
                <DollarSign className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-2xl font-bold text-white">
                {(data?.kpis?.salesMonthAmount || 0).toLocaleString('fr-FR')} <span className="text-xs font-normal text-slate-400">FCFA</span>
              </div>
              <div className="text-xs text-blue-400 mt-1 font-medium">
                {data?.kpis?.salesMonthCartons || 0} cartons distribués
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span>Stock Disponible Dépositaire</span>
                <Boxes className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-white">
                {(data?.kpis?.totalStockCartons || 0).toLocaleString('fr-FR')} <span className="text-xs font-normal text-slate-400">cartons</span>
              </div>
              <div className="text-xs text-amber-400 mt-1 font-medium">
                {data?.kpis?.lowStockAlerts || 0} référence(s) sous le seuil d'alerte
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span>Visites Terrain Réalisées</span>
                <TrendingUp className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-bold text-white">
                {data?.kpis?.visitsToday || 0}
              </div>
              <div className="text-xs text-purple-400 mt-1 font-medium">
                Pointages GPS aujourd'hui
              </div>
            </div>
          </div>

          {/* Breakdown Section: Top Products & Drop Points */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Products */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Boxes className="w-4 h-4 text-red-500" />
                <span>Top Produits les Plus Distribués</span>
              </h3>

              {data?.charts?.topProducts?.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  Aucune vente enregistrée pour le moment.
                </div>
              ) : (
                <div className="space-y-3">
                  {data?.charts?.topProducts?.map((item: any, idx: number) => (
                    <div key={idx} className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-white">{item.productName}</div>
                        <div className="text-[11px] text-slate-400">{item.category}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-emerald-400 font-bold">
                          {item.cartonsSold} cartons
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {item.totalRevenue.toLocaleString('fr-FR')} FCFA
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sales by Drop Point or VRS */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Store className="w-4 h-4 text-red-500" />
                <span>Performance par Drop Point (Dépôt)</span>
              </h3>

              {data?.charts?.salesByDropPoint?.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  Aucune donnée disponible.
                </div>
              ) : (
                <div className="space-y-3">
                  {data?.charts?.salesByDropPoint?.map((dp: any, idx: number) => (
                    <div key={idx} className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <span>{dp.dropPointName}</span>
                          <span className="text-[10px] px-1 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                            {dp.dropPointCode}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400">{dp.salesCount} ventes réalisées</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-white font-bold">
                          {dp.totalAmount.toLocaleString('fr-FR')} FCFA
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Exports CSV Section */
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-base font-bold text-white flex items-center gap-2 mb-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
              <span>Génération & Téléchargement des Données Certifiées</span>
            </h2>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Exportez à tout moment les extraits officiels au format CSV compatible avec Microsoft Excel, Google Sheets ou les systèmes comptables ERP de Nestlé / 6C.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              {/* Sales CSV */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 flex flex-col justify-between hover:border-emerald-500/50 transition">
                <div>
                  <div className="w-10 h-10 rounded-lg bg-emerald-950 border border-emerald-800/60 flex items-center justify-center text-emerald-400 mb-3">
                    <FileText className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-white text-sm">Journal des Ventes</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Historique exhaustif des transactions, montants en FCFA, vendeurs et points de vente livrés.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownloadCsv('sales')}
                  disabled={downloadingType === 'sales'}
                  className="mt-5 w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  {downloadingType === 'sales' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span>Télécharger (CSV)</span>
                </button>
              </div>

              {/* Stock CSV */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 flex flex-col justify-between hover:border-blue-500/50 transition">
                <div>
                  <div className="w-10 h-10 rounded-lg bg-blue-950 border border-blue-800/60 flex items-center justify-center text-blue-400 mb-3">
                    <Boxes className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-white text-sm">État des Stocks Dépositaires</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Inventaire en temps réel des dépôts, stocks disponibles par référence et seuils de rupture.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownloadCsv('stock')}
                  disabled={downloadingType === 'stock'}
                  className="mt-5 w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  {downloadingType === 'stock' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span>Télécharger (CSV)</span>
                </button>
              </div>

              {/* POS CSV */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 flex flex-col justify-between hover:border-purple-500/50 transition">
                <div>
                  <div className="w-10 h-10 rounded-lg bg-purple-950 border border-purple-800/60 flex items-center justify-center text-purple-400 mb-3">
                    <Store className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-white text-sm">Référentiel Points de Vente</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Boutiques et kiosques enrôlés, coordonnées GPS (latitude/longitude), contacts gérants et statuts.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownloadCsv('pos')}
                  disabled={downloadingType === 'pos'}
                  className="mt-5 w-full py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  {downloadingType === 'pos' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span>Télécharger (CSV)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

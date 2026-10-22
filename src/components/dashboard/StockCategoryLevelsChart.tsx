import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  Boxes,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Package,
  Layers,
  Percent,
  Warehouse,
  Truck,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { StockDot, StockStatusBadge } from '../stocks/StockStatusIndicator.tsx';
import { useAuth } from '../../context/AuthContext.tsx';

export interface CategoryProductStockItem {
  id: number;
  name: string;
  reference?: string;
  unitPrice: number;
  availableQuantity: number;
  dpAvailable?: number;
  vrsAvailable?: number;
  alertThreshold: number;
  level: 'optimal' | 'faible' | 'critique';
  totalValue: number;
}

export interface StockCategoryLevelData {
  categoryId: number;
  category: string;
  optimalCartons: number;
  faibleCartons: number;
  critiqueCartons: number;
  totalCartons: number;
  optimalCount: number;
  faibleCount: number;
  critiqueCount: number;
  totalProductsCount: number;
  totalValue: number;
  dp?: {
    optimalCartons: number;
    faibleCartons: number;
    critiqueCartons: number;
    totalCartons: number;
    optimalCount: number;
    faibleCount: number;
    critiqueCount: number;
  };
  vrs?: {
    optimalCartons: number;
    faibleCartons: number;
    critiqueCartons: number;
    totalCartons: number;
    optimalCount: number;
    faibleCount: number;
    critiqueCount: number;
  };
  products?: CategoryProductStockItem[];
}

interface StockCategoryLevelsChartProps {
  data: StockCategoryLevelData[];
  selectedDropPointName?: string;
  className?: string;
}

type ViewMetric = 'CARTONS' | 'PERCENT' | 'PRODUCTS';
type StockScope = 'GLOBAL' | 'DP' | 'VRS';

// Custom Recharts Tooltip extracted outside parent to prevent recreation on render
const CategoryCustomTooltip = React.memo(({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const item = payload[0].payload;
    const total = item.totalCartons;
    const optPct = total > 0 ? Math.round((item.optimalCartons / total) * 100) : 100;
    const faiPct = total > 0 ? Math.round((item.faibleCartons / total) * 100) : 0;
    const criPct = total > 0 ? Math.round((item.critiqueCartons / total) * 100) : 0;

    return (
      <div className="bg-[var(--chart-bg-tooltip)] border border-[var(--chart-border-tooltip)] text-[var(--text-primary)] rounded-xl p-2.5 sm:p-3.5 shadow-md text-xs w-[calc(100vw-48px)] max-w-[270px] sm:max-w-xs space-y-2 box-border overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-1.5 gap-2">
          <div className="min-w-0">
            <span className="font-bold text-[var(--text-primary)] uppercase tracking-wider text-xs sm:text-sm truncate block">
              Gamme {item.category}
            </span>
            <div className="text-[10px] sm:text-[11px] text-[var(--text-secondary)] font-mono truncate">
              {item.totalProductsCount} référence(s)
            </div>
          </div>
          <div className="text-right font-mono shrink-0">
            <span className="font-bold text-[var(--text-primary)] text-xs">{item.totalCartons} ctn</span>
            <div className="text-[10px] text-[var(--text-secondary)] truncate">
              {(item.totalValue || 0).toLocaleString('fr-FR')} F
            </div>
          </div>
        </div>

        {/* Breakdown Rows */}
        <div className="space-y-1 font-mono text-[11px]">
          <div className="flex items-center justify-between p-1 sm:p-1.5 rounded-lg bg-emerald-950/40 border border-emerald-800/30 text-emerald-300">
            <div className="flex items-center gap-1 sm:gap-1.5 truncate mr-1">
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400 shrink-0" />
              <span className="font-medium truncate">Optimal :</span>
            </div>
            <span className="font-bold shrink-0">
              {item.optimalCartons} ctn ({optPct}%)
            </span>
          </div>

          <div className="flex items-center justify-between p-1 sm:p-1.5 rounded-lg bg-amber-950/40 border border-amber-800/30 text-amber-300">
            <div className="flex items-center gap-1 sm:gap-1.5 truncate mr-1">
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-amber-400 shrink-0" />
              <span className="font-medium truncate">Faible :</span>
            </div>
            <span className="font-bold shrink-0">
              {item.faibleCartons} ctn ({faiPct}%)
            </span>
          </div>

          <div className="flex items-center justify-between p-1 sm:p-1.5 rounded-lg bg-rose-950/40 border border-rose-800/30 text-rose-300">
            <div className="flex items-center gap-1 sm:gap-1.5 truncate mr-1">
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-rose-500 shrink-0" />
              <span className="font-medium truncate">Critique :</span>
            </div>
            <span className="font-bold shrink-0">
              {item.critiqueCartons} ctn ({criPct}%)
            </span>
          </div>
        </div>

        {/* Product Previews in this category */}
        {item.products && item.products.length > 0 && (
          <div className="pt-1 border-t border-slate-800/80 space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Produits :</span>
            <div className="space-y-1 max-h-20 sm:max-h-24 overflow-y-auto pr-1">
              {item.products.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-300">
                  <div className="flex items-center gap-1 truncate mr-2">
                    <StockDot available={p.availableQuantity} threshold={p.alertThreshold} size="sm" />
                    <span className="truncate">{p.name}</span>
                  </div>
                  <span className="font-mono font-bold text-white shrink-0">
                    {p.availableQuantity} ctn
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
  return null;
});

export const StockCategoryLevelsChart: React.FC<StockCategoryLevelsChartProps> = React.memo(({
  data = [],
  selectedDropPointName,
  className = '',
}) => {
  const { user } = useAuth();
  const isVrs = user?.role === 'VRS';
  const [viewMetric, setViewMetric] = useState<ViewMetric>('CARTONS');
  const [stockScope, setStockScope] = useState<StockScope>(isVrs ? 'VRS' : 'GLOBAL');
  const [showTable, setShowTable] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<number | null>(null);

  // Transform data based on scope (GLOBAL, DP, VRS) - ALWAYS called unconditionally at top level
  const processedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map((cat) => {
      let optimal = cat.optimalCartons || 0;
      let faible = cat.faibleCartons || 0;
      let critique = cat.critiqueCartons || 0;
      let total = cat.totalCartons || 0;
      let optCount = cat.optimalCount || 0;
      let faiCount = cat.faibleCount || 0;
      let criCount = cat.critiqueCount || 0;

      if (stockScope === 'DP' && cat.dp) {
        optimal = cat.dp.optimalCartons || 0;
        faible = cat.dp.faibleCartons || 0;
        critique = cat.dp.critiqueCartons || 0;
        total = cat.dp.totalCartons || 0;
        optCount = cat.dp.optimalCount || 0;
        faiCount = cat.dp.faibleCount || 0;
        criCount = cat.dp.critiqueCount || 0;
      } else if (stockScope === 'VRS' && cat.vrs) {
        optimal = cat.vrs.optimalCartons || 0;
        faible = cat.vrs.faibleCartons || 0;
        critique = cat.vrs.critiqueCartons || 0;
        total = cat.vrs.totalCartons || 0;
        optCount = cat.vrs.optimalCount || 0;
        faiCount = cat.vrs.faibleCount || 0;
        criCount = cat.vrs.critiqueCount || 0;
      }

      const totalCalculated = optimal + faible + critique || 1;
      const pctOptimal = Math.round((optimal / totalCalculated) * 100);
      const pctFaible = Math.round((faible / totalCalculated) * 100);
      const pctCritique = Math.max(0, 100 - pctOptimal - pctFaible);

      return {
        ...cat,
        optimalCartons: optimal,
        faibleCartons: faible,
        critiqueCartons: critique,
        totalCartons: total,
        optimalCount: optCount,
        faibleCount: faiCount,
        critiqueCount: criCount,
        pctOptimal,
        pctFaible,
        pctCritique,
      };
    });
  }, [data, stockScope]);

  // Limit to at most 12 categories for performance
  const displayData = useMemo(() => processedData.slice(0, 12), [processedData]);

  if (!data || data.length === 0) {
    return (
      <div className={`bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center text-slate-400 ${className}`}>
        <Boxes className="w-8 h-8 mx-auto mb-2 text-slate-600" />
        <p className="text-sm font-medium">Aucune donnée de stock par catégorie disponible.</p>
      </div>
    );
  }

  // Overall totals
  const totalCartons = processedData.reduce((acc, c) => acc + c.totalCartons, 0);
  const totalOptimal = processedData.reduce((acc, c) => acc + c.optimalCartons, 0);
  const totalFaible = processedData.reduce((acc, c) => acc + c.faibleCartons, 0);
  const totalCritique = processedData.reduce((acc, c) => acc + c.critiqueCartons, 0);
  const totalValue = processedData.reduce((acc, c) => acc + (c.totalValue || 0), 0);

  const overallOptimalRate = totalCartons > 0 ? Math.round((totalOptimal / totalCartons) * 100) : 100;

  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm ${className}`}>
      {/* Header with Title & Dual Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
              Santé des Stocks
            </span>
            {selectedDropPointName && (
              <span className="text-xs text-slate-400 font-mono">
                • {selectedDropPointName}
              </span>
            )}
          </div>
          <h2 className="text-lg sm:text-xl font-black text-white mt-1 flex items-center gap-2">
            <span>Niveaux de Stocks par Catégorie de Produits</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Ventilation analytique de la disponibilité des gammes selon les états de stock : Optimal, Faible et Critique.
          </p>
        </div>

        {/* Action Controls: Scope & Metric Switchers */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Scope Selector */}
          {isVrs ? (
            <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs text-amber-400 font-semibold">
              <Truck className="w-3.5 h-3.5 text-amber-400" />
              <span>Mon Stock Personnel (VRS)</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setStockScope('GLOBAL')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold transition ${
                  stockScope === 'GLOBAL'
                    ? 'bg-slate-800 text-white font-bold shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Stocks cumulés Dépôts et Vendeurs"
              >
                <Boxes className="w-3.5 h-3.5" />
                <span>Global</span>
              </button>
              <button
                type="button"
                onClick={() => setStockScope('DP')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold transition ${
                  stockScope === 'DP'
                    ? 'bg-slate-800 text-white font-bold shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Stocks en entrepôt / Dépôt uniquement"
              >
                <Warehouse className="w-3.5 h-3.5 text-blue-400" />
                <span>Dépôts</span>
              </button>
              <button
                type="button"
                onClick={() => setStockScope('VRS')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold transition ${
                  stockScope === 'VRS'
                    ? 'bg-slate-800 text-white font-bold shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Stocks alloués aux vendeurs de terrain"
              >
                <Truck className="w-3.5 h-3.5 text-amber-400" />
                <span>Vendeurs (VRS)</span>
              </button>
            </div>
          )}

          {/* Metric Selector */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setViewMetric('CARTONS')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold transition ${
                viewMetric === 'CARTONS'
                  ? 'bg-emerald-600 text-white font-bold shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Volume en cartons par niveau"
            >
              <Package className="w-3.5 h-3.5" />
              <span>Cartons</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMetric('PERCENT')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold transition ${
                viewMetric === 'PERCENT'
                  ? 'bg-emerald-600 text-white font-bold shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Proportion relative (%)"
            >
              <Percent className="w-3.5 h-3.5" />
              <span>Ratio (%)</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMetric('PRODUCTS')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold transition ${
                viewMetric === 'PRODUCTS'
                  ? 'bg-emerald-600 text-white font-bold shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Nombre de références produits"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Références</span>
            </button>
          </div>
        </div>
      </div>

      {/* Aggregate Metric Mini-Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-5">
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Stock Total Disponible
          </div>
          <div className="text-base sm:text-lg font-black font-mono text-white mt-0.5 truncate">
            {totalCartons.toLocaleString('fr-FR')}{' '}
            <span className="text-[10px] font-normal text-slate-400">cartons</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 truncate">
            Valeur : {totalValue.toLocaleString('fr-FR')} FCFA
          </div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Niveau Optimal</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
          </div>
          <div className="text-base sm:text-lg font-black font-mono text-emerald-400 mt-0.5 truncate">
            {totalOptimal.toLocaleString('fr-FR')}{' '}
            <span className="text-[10px] font-normal text-slate-400">cartons</span>
          </div>
          <div className="text-[10px] text-emerald-400/90 mt-0.5">
            {overallOptimalRate}% du volume total
          </div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Niveau Faible</span>
            <span className="w-2 h-2 rounded-full bg-amber-400" />
          </div>
          <div className="text-base sm:text-lg font-black font-mono text-amber-400 mt-0.5 truncate">
            {totalFaible.toLocaleString('fr-FR')}{' '}
            <span className="text-[10px] font-normal text-slate-400">cartons</span>
          </div>
          <div className="text-[10px] text-amber-400/90 mt-0.5">
            {totalFaible > 0 ? 'Alerte réapprovisionnement' : 'Aucune alerte faible'}
          </div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Critique / Rupture</span>
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          </div>
          <div className="text-base sm:text-lg font-black font-mono text-rose-400 mt-0.5 truncate">
            {totalCritique.toLocaleString('fr-FR')}{' '}
            <span className="text-[10px] font-normal text-slate-400">cartons</span>
          </div>
          <div className="text-[10px] text-rose-400/90 mt-0.5">
            {totalCritique > 0 ? 'Intervention urgente requise' : 'Aucune rupture critique'}
          </div>
        </div>
      </div>

      {/* Simplified Mobile Chart (< 768px) - Zero Recharts overhead on mobile devices */}
      <div className="block md:hidden pt-2">
        <div className="space-y-3">
          {displayData.map((cat) => {
            const total = cat.totalCartons || 1;
            const optPct = Math.round((cat.optimalCartons / total) * 100);
            const faiPct = Math.round((cat.faibleCartons / total) * 100);
            const criPct = Math.max(0, 100 - optPct - faiPct);
            return (
              <div key={cat.categoryId} className="space-y-1.5 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white uppercase">{cat.category}</span>
                  <span className="font-mono text-slate-300 font-bold">{cat.totalCartons} ctn</span>
                </div>
                <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden flex">
                  {optPct > 0 && <div style={{ width: `${optPct}%` }} className="h-full bg-emerald-500" title={`Optimal: ${cat.optimalCartons} ctn`} />}
                  {faiPct > 0 && <div style={{ width: `${faiPct}%` }} className="h-full bg-amber-500" title={`Faible: ${cat.faibleCartons} ctn`} />}
                  {criPct > 0 && <div style={{ width: `${criPct}%` }} className="h-full bg-rose-500" title={`Critique: ${cat.critiqueCartons} ctn`} />}
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span className="text-emerald-400">Opt: {cat.optimalCartons}</span>
                  <span className="text-amber-400">Fai: {cat.faibleCartons}</span>
                  <span className="text-rose-400">Cri: {cat.critiqueCartons}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Desktop Recharts BarChart Container (>= 768px) */}
      <div className="hidden md:block h-72 sm:h-80 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={260}>
          {viewMetric === 'CARTONS' ? (
            <BarChart data={displayData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
              <XAxis
                dataKey="category"
                stroke="var(--chart-text)"
                fontSize={12}
                tickLine={false}
                axisLine={{ stroke: 'var(--chart-axis)' }}
              />
              <YAxis
                stroke="var(--chart-text)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
              />
              <Tooltip
                content={<CategoryCustomTooltip />}
                allowEscapeViewBox={{ x: false, y: false }}
                wrapperStyle={{ zIndex: 50, pointerEvents: 'none', maxWidth: 'calc(100vw - 32px)' }}
              />
              <Bar
                dataKey="optimalCartons"
                name="Optimal"
                stackId="stockStack"
                fill="var(--color-green-text)"
                isAnimationActive={false}
              />
              <Bar
                dataKey="faibleCartons"
                name="Faible"
                stackId="stockStack"
                fill="var(--color-orange-text)"
                isAnimationActive={false}
              />
              <Bar
                dataKey="critiqueCartons"
                name="Critique"
                stackId="stockStack"
                fill="var(--color-rouge-text)"
                radius={[6, 6, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          ) : viewMetric === 'PERCENT' ? (
            <BarChart data={displayData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
              <XAxis
                dataKey="category"
                stroke="var(--chart-text)"
                fontSize={12}
                tickLine={false}
                axisLine={{ stroke: 'var(--chart-axis)' }}
              />
              <YAxis
                stroke="var(--chart-text)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                content={<CategoryCustomTooltip />}
                allowEscapeViewBox={{ x: false, y: false }}
                wrapperStyle={{ zIndex: 50, pointerEvents: 'none', maxWidth: 'calc(100vw - 32px)' }}
              />
              <Bar
                dataKey="pctOptimal"
                name="Optimal (%)"
                stackId="pctStack"
                fill="var(--color-green-text)"
                isAnimationActive={false}
              />
              <Bar
                dataKey="pctFaible"
                name="Faible (%)"
                stackId="pctStack"
                fill="var(--color-orange-text)"
                isAnimationActive={false}
              />
              <Bar
                dataKey="pctCritique"
                name="Critique (%)"
                stackId="pctStack"
                fill="var(--color-rouge-text)"
                radius={[6, 6, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          ) : (
            <BarChart data={displayData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
              <XAxis
                dataKey="category"
                stroke="var(--chart-text)"
                fontSize={12}
                tickLine={false}
                axisLine={{ stroke: 'var(--chart-axis)' }}
              />
              <YAxis
                stroke="var(--chart-text)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                content={<CategoryCustomTooltip />}
                allowEscapeViewBox={{ x: false, y: false }}
                wrapperStyle={{ zIndex: 50, pointerEvents: 'none', maxWidth: 'calc(100vw - 32px)' }}
              />
              <Bar
                dataKey="optimalCount"
                name="Réf. Optimales"
                fill="var(--color-green-text)"
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
              <Bar
                dataKey="faibleCount"
                name="Réf. Faibles"
                fill="var(--color-orange-text)"
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
              <Bar
                dataKey="critiqueCount"
                name="Réf. Critiques"
                fill="var(--color-rouge-text)"
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Chart Footer with Interactive Legend & Detailed Breakdown Table Toggle */}
      <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-4 text-slate-400 font-mono text-[11px]">
          <div className="flex items-center gap-1.5" title="Quantité supérieure au seuil d'alerte configuré">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span className="text-emerald-300 font-bold">Optimal</span>
            <span className="text-slate-500 font-sans hidden md:inline">(Stock suffisant)</span>
          </div>
          <div className="flex items-center gap-1.5" title="Quantité inférieure ou égale au seuil d'alerte">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="text-amber-300 font-bold">Faible</span>
            <span className="text-slate-500 font-sans hidden md:inline">(Seuil d'alerte)</span>
          </div>
          <div className="flex items-center gap-1.5" title="Rupture immédiate ou réserve ≤ 40% du seuil">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-rose-300 font-bold">Critique</span>
            <span className="text-slate-500 font-sans hidden md:inline">(Rupture / Urgence)</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowTable(!showTable)}
          className="text-slate-400 hover:text-white font-medium inline-flex items-center gap-1 transition"
        >
          <span>{showTable ? 'Masquer la vue détaillée' : 'Afficher le détail par catégorie'}</span>
          {showTable ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Collapsible Detailed Category & Products Breakdown Table */}
      {showTable && (
        <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3 font-sans font-semibold">Gamme (Catégorie)</th>
                  <th className="py-2.5 px-3 text-right">Volume Total</th>
                  <th className="py-2.5 px-3 text-right text-emerald-400">Optimal</th>
                  <th className="py-2.5 px-3 text-right text-amber-400">Faible</th>
                  <th className="py-2.5 px-3 text-right text-rose-400">Critique</th>
                  <th className="py-2.5 px-3 text-right">Valeur Estimée</th>
                  <th className="py-2.5 px-3 text-center">État Global</th>
                  <th className="py-2.5 px-2 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {processedData.map((cat) => {
                  const isExpanded = expandedCategory === cat.categoryId;
                  const healthRate = cat.totalCartons > 0 ? Math.round((cat.optimalCartons / cat.totalCartons) * 100) : 100;

                  return (
                    <React.Fragment key={cat.categoryId}>
                      <tr className="hover:bg-slate-800/30 transition">
                        <td className="py-2.5 px-3 font-sans font-bold text-white">
                          <div className="flex items-center gap-2">
                            <span>{cat.category}</span>
                            <span className="text-[10px] font-mono text-slate-400 font-normal">
                              ({cat.totalProductsCount} réf)
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-white">
                          {cat.totalCartons} ctn
                        </td>
                        <td className="py-2.5 px-3 text-right text-emerald-400">
                          {cat.optimalCartons} ctn <span className="text-[10px] text-slate-400">({cat.optimalCount} réf)</span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-amber-400">
                          {cat.faibleCartons} ctn <span className="text-[10px] text-slate-400">({cat.faibleCount} réf)</span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-rose-400">
                          {cat.critiqueCartons} ctn <span className="text-[10px] text-slate-400">({cat.critiqueCount} réf)</span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-300">
                          {(cat.totalValue || 0).toLocaleString('fr-FR')} FCFA
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {cat.critiqueCartons > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
                              <ShieldAlert className="w-3 h-3" />
                              Critique
                            </span>
                          ) : cat.faibleCartons > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                              <AlertTriangle className="w-3 h-3" />
                              Sous Alerte
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                              <CheckCircle2 className="w-3 h-3" />
                              100% Sécurisé
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => setExpandedCategory(isExpanded ? null : cat.categoryId)}
                            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
                            title={isExpanded ? 'Replier les références' : 'Déplier les références'}
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>

                      {/* Nested products row when expanded */}
                      {isExpanded && cat.products && cat.products.length > 0 && (
                        <tr className="bg-slate-950/80">
                          <td colSpan={8} className="py-3 px-4">
                            <div className="space-y-2">
                              <div className="text-[11px] font-sans font-semibold text-slate-400 flex items-center gap-2">
                                <Info className="w-3.5 h-3.5 text-purple-400" />
                                <span>Détail des produits de la gamme {cat.category} :</span>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                {cat.products.map((prod) => (
                                  <div
                                    key={prod.id}
                                    className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-2"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <StockDot
                                        available={prod.availableQuantity}
                                        threshold={prod.alertThreshold}
                                        size="md"
                                      />
                                      <div className="min-w-0">
                                        <div className="font-sans font-bold text-white text-xs truncate">
                                          {prod.name}
                                        </div>
                                        <div className="text-[10px] text-slate-500 font-mono">
                                          Réf: {prod.reference || 'N/A'} • Seuil: {prod.alertThreshold} ctn
                                        </div>
                                      </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <div className="font-mono font-bold text-white text-xs">
                                        {prod.availableQuantity} ctn
                                      </div>
                                      <StockStatusBadge
                                        available={prod.availableQuantity}
                                        threshold={prod.alertThreshold}
                                        showIcon={false}
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
});

import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ComposedChart,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Target,
  Package,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
  BarChart3,
  LineChart as LineChartIcon,
} from 'lucide-react';

export interface MonthlySalesData {
  month: string;
  monthLabel: string;
  shortLabel: string;
  totalAmount: number;
  salesCount: number;
  cartonsSold: number;
  objectiveAmount: number;
  growthRate?: number;
}

export interface RecentTrendData {
  currentDay: number;
  isInsufficientData: boolean;
  currentPeriodAmount: number;
  previousPeriodAmount: number;
  percentage: number | null;
  label: string;
}

interface MonthlySalesChartProps {
  data: MonthlySalesData[];
  selectedDropPointName?: string;
  className?: string;
  recentTrend?: RecentTrendData;
}

type ViewMode = 'REVENUE' | 'CARTONS' | 'OBJECTIVE';

// Format currency helpers
const formatMillions = (val: number) => {
  if (val >= 1_000_000) {
    return `${(val / 1_000_000).toFixed(1)}M`;
  }
  if (val >= 1_000) {
    return `${Math.round(val / 1_000)}k`;
  }
  return String(val);
};

// Separated and memoized CustomTooltip to prevent recreating component inside render
const MonthlyCustomTooltip = React.memo(({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const item: MonthlySalesData = payload[0].payload;
    const targetPercent = item.objectiveAmount
      ? Math.round((item.totalAmount / item.objectiveAmount) * 100)
      : 100;

    return (
      <div className="bg-[var(--chart-bg-tooltip)] border border-[var(--chart-border-tooltip)] text-[var(--text-primary)] rounded-xl p-3.5 shadow-md text-xs min-w-[210px] space-y-2">
        <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-1.5">
          <span className="font-bold text-[var(--text-primary)] uppercase tracking-wider">{item.monthLabel}</span>
          {item.growthRate !== undefined && item.growthRate !== 0 && (
            <span
              className={`font-mono font-bold px-1.5 py-0.5 rounded text-[10px] flex items-center gap-0.5 ${
                item.growthRate >= 0
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/40'
                  : 'bg-rose-950 text-rose-300 border border-rose-800/40'
              }`}
            >
              {item.growthRate >= 0 ? '+' : ''}
              {item.growthRate}%
            </span>
          )}
        </div>

        <div className="space-y-1.5 font-mono">
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-slate-400">Chiffre d'Affaires :</span>
            <span className="font-bold text-emerald-400">
              {item.totalAmount.toLocaleString('fr-FR')} FCFA
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-300">
            <span className="text-slate-400">Volume :</span>
            <span className="font-bold text-blue-400">{item.cartonsSold} cartons</span>
          </div>

          <div className="flex items-center justify-between text-slate-300">
            <span className="text-slate-400">Commandes :</span>
            <span className="text-slate-200">{item.salesCount} ventes</span>
          </div>

          {item.objectiveAmount > 0 && (
            <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Objectif ({formatMillions(item.objectiveAmount)}) :</span>
              <span
                className={`font-bold ${
                  targetPercent >= 100 ? 'text-[#54a835]' : 'text-amber-400'
                }`}
              >
                {targetPercent}% atteint
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
});

export const MonthlySalesChart: React.FC<MonthlySalesChartProps> = React.memo(({
  data = [],
  selectedDropPointName,
  className = '',
  recentTrend,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('REVENUE');
  const [showTable, setShowTable] = useState(false);

  // Limit to 12 points per curve (monthly aggregation)
  const displayData = React.useMemo(() => (data || []).slice(-12), [data]);

  if (!displayData || displayData.length === 0) {
    return (
      <div className={`bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center text-slate-400 ${className}`}>
        <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-600" />
        <p className="text-sm font-medium">Aucune donnée mensuelle disponible pour la période.</p>
      </div>
    );
  }

  // Calculated aggregated KPIs based on displayed months
  const totalPeriodRevenue = displayData.reduce((acc, item) => acc + (item.totalAmount || 0), 0);
  const totalPeriodCartons = displayData.reduce((acc, item) => acc + (item.cartonsSold || 0), 0);
  const totalPeriodOrders = displayData.reduce((acc, item) => acc + (item.salesCount || 0), 0);
  const averageMonthlyRevenue = Math.round(totalPeriodRevenue / displayData.length);
  const averageMonthlyCartons = Math.round(totalPeriodCartons / displayData.length);

  // Peak month
  const peakMonth: MonthlySalesData = displayData.reduce(
    (max, item) => (item.totalAmount > max.totalAmount ? item : max),
    displayData[0]
  );

  // Latest month vs previous month
  const latestMonth = displayData[displayData.length - 1];
  const previousMonth = displayData.length > 1 ? displayData[displayData.length - 2] : null;
  const latestGrowth =
    previousMonth && previousMonth.totalAmount > 0
      ? Math.round(((latestMonth.totalAmount - previousMonth.totalAmount) / previousMonth.totalAmount) * 100)
      : 0;

  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm ${className}`}>
      {/* Header with Title & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#54a835]/20 text-[#54a835] border border-[#54a835]/30 uppercase tracking-wider">
              Analyse Temporelle
            </span>
            {selectedDropPointName && (
              <span className="text-xs text-slate-400 font-mono">
                • {selectedDropPointName}
              </span>
            )}
          </div>
          <h2 className="text-lg sm:text-xl font-black text-white mt-1 flex items-center gap-2">
            <span>Évolution des Ventes Mensuelles</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Suivi consolidé du chiffre d'affaires, des volumes distribués et du taux de réalisation des objectifs.
          </p>
        </div>

        {/* View Mode Switcher */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setViewMode('REVENUE')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              viewMode === 'REVENUE'
                ? 'bg-[#54a835] text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Chiffre d'Affaires</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('CARTONS')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              viewMode === 'CARTONS'
                ? 'bg-[#54a835] text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Volumes (Cartons)</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('OBJECTIVE')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              viewMode === 'OBJECTIVE'
                ? 'bg-[#54a835] text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span>Vs Objectifs</span>
          </button>
        </div>
      </div>

      {/* Aggregate Metric Mini-Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-5">
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Total Période (6M)
          </div>
          <div className="text-base sm:text-lg font-black font-mono text-white mt-0.5 truncate">
            {totalPeriodRevenue.toLocaleString('fr-FR')} <span className="text-[10px] font-normal text-slate-400">FCFA</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {totalPeriodCartons} cartons • {totalPeriodOrders} ventes
          </div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Moyenne Mensuelle
          </div>
          <div className="text-base sm:text-lg font-black font-mono text-emerald-400 mt-0.5 truncate">
            {averageMonthlyRevenue.toLocaleString('fr-FR')} <span className="text-[10px] font-normal text-slate-400">FCFA</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            ~{averageMonthlyCartons} cartons / mois
          </div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Mois Record (Pic)
          </div>
          <div className="text-base sm:text-lg font-black font-mono text-[#54a835] mt-0.5 truncate">
            {peakMonth.totalAmount.toLocaleString('fr-FR')} <span className="text-[10px] font-normal text-slate-400">FCFA</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 truncate">
            {peakMonth.monthLabel} ({peakMonth.cartonsSold} ctn)
          </div>
        </div>

        {(() => {
          const now = new Date();
          const currentDay = recentTrend?.currentDay ?? now.getDate();
          const isInsufficient = recentTrend?.isInsufficientData ?? (currentDay < 5);
          const trendLabel = recentTrend?.label ?? `J1-J${currentDay} vs J1-J${currentDay} du mois précédent`;
          const trendPercent = recentTrend?.percentage !== undefined ? recentTrend.percentage : (
            !isInsufficient && previousMonth && previousMonth.totalAmount > 0
              ? Math.round(((latestMonth.totalAmount - previousMonth.totalAmount) / previousMonth.totalAmount) * 100)
              : null
          );

          return (
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Tendance Récente
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                {isInsufficient ? (
                  <span className="text-sm font-bold text-slate-400">
                    Données insuffisantes
                  </span>
                ) : trendPercent !== null && trendPercent >= 0 ? (
                  <span className="text-base sm:text-lg font-black font-mono text-emerald-400 flex items-center gap-1">
                    <TrendingUp className="w-4 h-4" />
                    +{trendPercent}%
                  </span>
                ) : trendPercent !== null ? (
                  <span className="text-base sm:text-lg font-black font-mono text-rose-400 flex items-center gap-1">
                    <TrendingDown className="w-4 h-4" />
                    {trendPercent}%
                  </span>
                ) : (
                  <span className="text-base sm:text-lg font-black font-mono text-slate-400">
                    —
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {trendLabel}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Simplified Mobile Chart (< 768px) - Zero Recharts overhead on mobile devices */}
      <div className="block md:hidden pt-2">
        <div className="space-y-2">
          {displayData.map((item) => {
            const maxVal = Math.max(...displayData.map((d) => viewMode === 'CARTONS' ? d.cartonsSold : d.totalAmount)) || 1;
            const currentVal = viewMode === 'CARTONS' ? item.cartonsSold : item.totalAmount;
            const pct = Math.max(4, Math.round((currentVal / maxVal) * 100));
            return (
              <div key={item.month} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-slate-300">{item.shortLabel}</span>
                  <span className="text-emerald-400 font-bold">
                    {viewMode === 'CARTONS'
                      ? `${item.cartonsSold} ctn`
                      : `${(item.totalAmount || 0).toLocaleString('fr-FR')} FCFA`}
                  </span>
                </div>
                <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className={`h-full rounded-full ${
                      viewMode === 'CARTONS' ? 'bg-blue-500' : 'bg-red-600'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Desktop Recharts Container (>= 768px) */}
      <div className="hidden md:block h-72 sm:h-80 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={260}>
          {viewMode === 'REVENUE' ? (
            <AreaChart data={displayData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-series-1)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--chart-series-1)" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
              <XAxis
                dataKey="shortLabel"
                stroke="var(--chart-text)"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: 'var(--chart-axis)' }}
              />
              <YAxis
                stroke="var(--chart-text)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatMillions}
              />
              <Tooltip content={<MonthlyCustomTooltip />} />
              <ReferenceLine
                y={averageMonthlyRevenue}
                stroke="var(--color-blue-text)"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: `Moyenne (${formatMillions(averageMonthlyRevenue)})`,
                  fill: 'var(--color-blue-text)',
                  fontSize: 10,
                  position: 'insideTopRight',
                }}
              />
              <Area
                type="monotone"
                dataKey="totalAmount"
                name="Chiffre d'Affaires"
                stroke="var(--chart-series-1)"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#revenueGradient)"
                isAnimationActive={false}
                activeDot={{ r: 6, fill: 'var(--chart-series-1)', stroke: 'var(--bg-card)', strokeWidth: 2 }}
              />
            </AreaChart>
          ) : viewMode === 'CARTONS' ? (
            <BarChart data={displayData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
              <XAxis
                dataKey="shortLabel"
                stroke="var(--chart-text)"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: 'var(--chart-axis)' }}
              />
              <YAxis
                stroke="var(--chart-text)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<MonthlyCustomTooltip />} />
              <ReferenceLine
                y={averageMonthlyCartons}
                stroke="var(--color-orange-text)"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: `Moy. ${averageMonthlyCartons} ctn`,
                  fill: 'var(--color-orange-text)',
                  fontSize: 10,
                  position: 'insideTopRight',
                }}
              />
              <Bar
                dataKey="cartonsSold"
                name="Cartons Vendus"
                fill="var(--chart-series-2)"
                radius={[6, 6, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          ) : (
            <ComposedChart data={displayData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="composedGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-series-1)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--chart-series-1)" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
              <XAxis
                dataKey="shortLabel"
                stroke="var(--chart-text)"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: 'var(--chart-axis)' }}
              />
              <YAxis
                stroke="var(--chart-text)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatMillions}
              />
              <Tooltip content={<MonthlyCustomTooltip />} />
              <Bar
                dataKey="totalAmount"
                name="CA Réalisé"
                fill="var(--chart-series-1)"
                radius={[6, 6, 0, 0]}
                barSize={28}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="objectiveAmount"
                name="Objectif Fixé"
                stroke="var(--chart-series-3)"
                strokeWidth={2.5}
                strokeDasharray="5 5"
                dot={{ r: 4, fill: 'var(--chart-series-3)' }}
                isAnimationActive={false}
              />
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Chart Footer with Legend & Table Toggle */}
      <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-4 text-slate-400 font-mono text-[11px]">
          {viewMode === 'REVENUE' && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--chart-series-1)]" />
                <span className="text-[var(--text-primary)]">CA Réalisé (FCFA)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-[var(--color-blue-text)]" />
                <span className="text-[var(--text-secondary)]">Moyenne 6 Mois</span>
              </div>
            </>
          )}
          {viewMode === 'CARTONS' && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span className="text-slate-300">Cartons Vendus</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-amber-500" />
                <span className="text-slate-400">Moyenne Cartons</span>
              </div>
            </>
          )}
          {viewMode === 'OBJECTIVE' && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#54a835]" />
                <span className="text-slate-300">CA Réalisé</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 border-t border-dashed border-amber-500" />
                <span className="text-slate-400">Objectif Commercial</span>
              </div>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowTable(!showTable)}
          className="text-slate-400 hover:text-white font-medium inline-flex items-center gap-1 transition"
        >
          <span>{showTable ? 'Masquer les détails mensuels' : 'Afficher le détail par mois'}</span>
          {showTable ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Collapsible Detailed Monthly Breakdown Table */}
      {showTable && (
        <div className="mt-4 pt-3 border-t border-slate-800/80 overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] border-b border-slate-800">
              <tr>
                <th className="py-2 px-3 font-sans font-semibold">Mois</th>
                <th className="py-2 px-3 text-right">CA Réalisé</th>
                <th className="py-2 px-3 text-right">Objectif</th>
                <th className="py-2 px-3 text-right">Taux</th>
                <th className="py-2 px-3 text-right">Volumes</th>
                <th className="py-2 px-3 text-right">Commandes</th>
                <th className="py-2 px-3 text-right">Évolution MoM</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {data.map((item) => {
                const targetPercent = item.objectiveAmount
                  ? Math.round((item.totalAmount / item.objectiveAmount) * 100)
                  : 100;
                return (
                  <tr key={item.month} className="hover:bg-slate-800/30 transition">
                    <td className="py-2.5 px-3 font-sans font-bold text-white">
                      {item.monthLabel}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-400">
                      {item.totalAmount.toLocaleString('fr-FR')} FCFA
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-400">
                      {item.objectiveAmount ? `${item.objectiveAmount.toLocaleString('fr-FR')} FCFA` : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          targetPercent >= 100
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/40'
                            : 'bg-amber-950 text-amber-300 border border-amber-800/40'
                        }`}
                      >
                        {targetPercent}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-blue-400 font-semibold">
                      {item.cartonsSold} ctn
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-300">
                      {item.salesCount}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {item.growthRate !== undefined ? (
                        <span
                          className={`font-semibold ${
                            item.growthRate > 0
                              ? 'text-emerald-400'
                              : item.growthRate < 0
                              ? 'text-rose-400'
                              : 'text-slate-400'
                          }`}
                        >
                          {item.growthRate > 0 ? '+' : ''}
                          {item.growthRate}%
                        </span>
                      ) : (
                        '-'
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
  );
});

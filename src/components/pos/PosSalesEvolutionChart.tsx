import React, { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Layers,
  ShoppingCart,
  Package,
  Award,
} from 'lucide-react';
import { PosMonthlySalesData } from '../../types/index.ts';

interface PosSalesEvolutionChartProps {
  data: PosMonthlySalesData[];
  posName?: string;
  className?: string;
}

type MetricMode = 'REVENUE' | 'CARTONS' | 'SALES_COUNT';

export const PosSalesEvolutionChart: React.FC<PosSalesEvolutionChartProps> = ({
  data = [],
  posName,
  className = '',
}) => {
  const [metricMode, setMetricMode] = useState<MetricMode>('REVENUE');

  // Compute aggregations across the 6-month period
  const totalRevenue = data.reduce((acc, item) => acc + (item.totalAmount || 0), 0);
  const totalCartons = data.reduce((acc, item) => acc + (item.cartonsSold || 0), 0);
  const totalSalesCount = data.reduce((acc, item) => acc + (item.salesCount || 0), 0);

  const monthCount = data.length || 6;
  const avgMonthlyRevenue = Math.round(totalRevenue / monthCount);
  const avgMonthlyCartons = Math.round(totalCartons / monthCount);

  // Peak month
  const peakMonth = data.reduce(
    (max, item) => (item.totalAmount > max.totalAmount ? item : max),
    data[0] || { totalAmount: 0, monthLabel: 'N/A', shortLabel: 'N/A' }
  );

  // Growth comparison (latest month vs previous month)
  const latestMonth = data.length > 0 ? data[data.length - 1] : null;
  const previousMonth = data.length > 1 ? data[data.length - 2] : null;

  const currentGrowthRate = latestMonth?.growthRate ?? 0;
  const hasAnySales = totalSalesCount > 0 || totalRevenue > 0;

  // Chart metric config
  const metricConfig = {
    REVENUE: {
      dataKey: 'totalAmount',
      name: "Chiffre d'Affaires",
      unit: 'FCFA',
      stroke: 'var(--color-green-text)',
      activeColor: 'var(--color-green-text)',
      formatter: (v: number) => `${v.toLocaleString('fr-FR')} FCFA`,
      yAxisFormatter: (v: number) => {
        if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
        if (v >= 1000) return `${Math.round(v / 1000)}k`;
        return `${v}`;
      },
      average: avgMonthlyRevenue,
    },
    CARTONS: {
      dataKey: 'cartonsSold',
      name: 'Cartons vendus',
      unit: 'cartons',
      stroke: 'var(--color-orange-text)',
      activeColor: 'var(--color-orange-text)',
      formatter: (v: number) => `${v.toLocaleString('fr-FR')} carton${v > 1 ? 's' : ''}`,
      yAxisFormatter: (v: number) => `${v}`,
      average: avgMonthlyCartons,
    },
    SALES_COUNT: {
      dataKey: 'salesCount',
      name: 'Nombre de ventes',
      unit: 'ventes',
      stroke: 'var(--color-blue-text)',
      activeColor: 'var(--color-blue-text)',
      formatter: (v: number) => `${v} vente${v > 1 ? 's' : ''}`,
      yAxisFormatter: (v: number) => `${v}`,
      average: Math.round(totalSalesCount / monthCount),
    },
  }[metricMode];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const item: PosMonthlySalesData = payload[0].payload;
      return (
        <div className="bg-[var(--chart-bg-tooltip)] border border-[var(--chart-border-tooltip)] text-[var(--text-primary)] rounded-xl p-3 shadow-2xl backdrop-blur-md min-w-[200px] text-xs">
          <div className="font-bold text-[var(--text-primary)] border-b border-[var(--border-color)] pb-1.5 mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
              <span>{item.monthLabel || label}</span>
            </span>
            {item.growthRate !== undefined && item.growthRate !== 0 && (
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  item.growthRate > 0
                    ? 'bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40'
                    : 'bg-red-950/20 text-red-600 dark:text-red-400 border border-red-500/40'
                }`}
              >
                {item.growthRate > 0 ? `+${item.growthRate}%` : `${item.growthRate}%`}
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[var(--text-secondary)]">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Chiffre d'Affaires :</span>
              </span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {(item.totalAmount || 0).toLocaleString('fr-FR')} FCFA
              </span>
            </div>

            <div className="flex items-center justify-between text-[var(--text-secondary)]">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Cartons livrés :</span>
              </span>
              <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                {item.cartonsSold || 0} carton{(item.cartonsSold || 0) > 1 ? 's' : ''}
              </span>
            </div>

            <div className="flex items-center justify-between text-[var(--text-secondary)]">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-500" />
                <span>Commandes / Ventes :</span>
              </span>
              <span className="font-mono font-semibold text-sky-600 dark:text-sky-400">
                {item.salesCount || 0} vente{(item.salesCount || 0) > 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`p-4 sm:p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4 ${className}`}>
      {/* Header with Title and Metric Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-slate-100 flex items-center gap-2">
              <span>Évolution des Ventes (6 derniers mois)</span>
              {posName && (
                <span className="text-[11px] text-slate-400 font-normal hidden sm:inline">
                  • {posName}
                </span>
              )}
            </h4>
            <p className="text-[11px] text-slate-400">
              Graphique linéaire des transactions enregistrées sur les 6 derniers mois
            </p>
          </div>
        </div>

        {/* Metric Mode Switcher */}
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setMetricMode('REVENUE')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
              metricMode === 'REVENUE'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Chiffre d'Affaires
          </button>
          <button
            type="button"
            onClick={() => setMetricMode('CARTONS')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
              metricMode === 'CARTONS'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Cartons
          </button>
          <button
            type="button"
            onClick={() => setMetricMode('SALES_COUNT')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
              metricMode === 'SALES_COUNT'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Ventes
          </button>
        </div>
      </div>

      {/* KPI Highlights Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
        <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800">
          <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
            <Layers className="w-3 h-3 text-emerald-400" />
            <span>Total 6 Mois</span>
          </div>
          <div className="text-xs sm:text-sm font-bold font-mono text-emerald-400 mt-1 truncate">
            {totalRevenue.toLocaleString('fr-FR')} FCFA
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800">
          <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
            <Calendar className="w-3 h-3 text-sky-400" />
            <span>Moyenne / Mois</span>
          </div>
          <div className="text-xs sm:text-sm font-bold font-mono text-slate-200 mt-1 truncate">
            {avgMonthlyRevenue.toLocaleString('fr-FR')} FCFA
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800">
          <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
            <Package className="w-3 h-3 text-amber-400" />
            <span>Volume Livré</span>
          </div>
          <div className="text-xs sm:text-sm font-bold font-mono text-amber-400 mt-1 truncate">
            {totalCartons} carton{totalCartons > 1 ? 's' : ''} ({totalSalesCount} vente{totalSalesCount > 1 ? 's' : ''})
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800">
          <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
            <Award className="w-3 h-3 text-purple-400" />
            <span>Pic Mensuel</span>
          </div>
          <div className="text-xs sm:text-sm font-bold text-slate-200 mt-1 truncate">
            {peakMonth.totalAmount > 0 ? (
              <span className="font-mono text-purple-300">
                {peakMonth.shortLabel} ({(peakMonth.totalAmount || 0).toLocaleString('fr-FR')} F)
              </span>
            ) : (
              <span className="text-slate-500 font-normal">Aucun pic</span>
            )}
          </div>
        </div>
      </div>

      {/* Main Linear Recharts Component */}
      <div className="relative w-full h-64 sm:h-72 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 12, right: 14, left: -10, bottom: 0 }}
          >
            <defs>
              <linearGradient id={`gradient-${metricMode}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={metricConfig.stroke} stopOpacity={0.4} />
                <stop offset="95%" stopColor={metricConfig.stroke} stopOpacity={0.0} />
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
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: 'var(--chart-axis)' }}
              tickFormatter={metricConfig.yAxisFormatter}
              allowDecimals={false}
            />

            <Tooltip content={<CustomTooltip />} />

            {/* Average Reference Line when sales exist */}
            {hasAnySales && metricConfig.average > 0 && (
              <ReferenceLine
                y={metricConfig.average}
                stroke="var(--chart-text)"
                strokeDasharray="4 4"
                label={{
                  value: `Moy: ${metricConfig.yAxisFormatter(metricConfig.average)}`,
                  fill: 'var(--chart-text)',
                  fontSize: 10,
                  position: 'right',
                }}
              />
            )}

            {/* The primary Recharts Line */}
            <Line
              type="monotone"
              dataKey={metricConfig.dataKey}
              name={metricConfig.name}
              stroke={metricConfig.stroke}
              strokeWidth={3}
              dot={{
                r: 4,
                strokeWidth: 2,
                stroke: 'var(--bg-card)',
                fill: metricConfig.stroke,
              }}
              activeDot={{
                r: 6,
                strokeWidth: 2,
                stroke: '#ffffff',
                fill: metricConfig.activeColor,
              }}
              animationDuration={800}
            />
          </LineChart>
        </ResponsiveContainer>

        {/* Overlay notice when 0 sales have been made for this POS */}
        {!hasAnySales && (
          <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-[2px] rounded-xl flex flex-col items-center justify-center p-4 text-center border border-dashed border-slate-800">
            <div className="w-9 h-9 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-amber-400 mb-2">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <p className="text-xs sm:text-sm font-semibold text-amber-300">
              Pas de vente réalisé pour le moment dans ce point de vente
            </p>
            <p className="text-[11px] text-slate-400 max-w-sm mt-1 leading-relaxed">
              Le graphique linéaire de l'évolution sur 6 mois est prêt et s'actualisera en temps réel dès la première vente enregistrée.
            </p>
          </div>
        )}
      </div>

      {/* Footer Details */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-400 border-t border-slate-800/60 pt-2.5">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
          <span>Données consolidées en temps réel sur les 6 derniers mois d'exercice</span>
        </span>
        {latestMonth && previousMonth && (
          <span className="flex items-center gap-1">
            <span>Tendance récente :</span>
            {currentGrowthRate > 0 ? (
              <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3" /> +{currentGrowthRate}%
              </span>
            ) : currentGrowthRate < 0 ? (
              <span className="text-red-400 font-bold flex items-center gap-0.5">
                <TrendingDown className="w-3 h-3" /> {currentGrowthRate}%
              </span>
            ) : (
              <span className="text-slate-400 font-medium">Stable</span>
            )}
          </span>
        )}
      </div>
    </div>
  );
};

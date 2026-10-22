import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.ts';
import { AcceptanceScenarioResult } from '../../types/index.ts';
import {
  CheckCircle2,
  XCircle,
  Play,
  RotateCw,
  X,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Terminal,
} from 'lucide-react';

interface AcceptanceTestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AcceptanceTestModal: React.FC<AcceptanceTestModalProps> = ({ isOpen, onClose }) => {
  const [results, setResults] = useState<AcceptanceScenarioResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [summary, setSummary] = useState<string>('');
  const [passed, setPassed] = useState<boolean>(true);
  const [expandedScenarios, setExpandedScenarios] = useState<Record<number, boolean>>({
    1: true,
    4: true,
    5: true,
    6: true,
    7: true,
  });

  const loadStatus = async () => {
    try {
      const data = await api.getAcceptanceTestsStatus();
      setResults(data.results);
      setSummary(data.summary);
      setPassed(data.passed);
    } catch {
      // fallback
    }
  };

  const handleRunTests = async () => {
    setIsRunning(true);
    try {
      const data = await api.runAcceptanceTests();
      setResults(data.results);
      setSummary(data.summary);
      setPassed(data.passed);
    } catch (err: any) {
      alert(err.message || 'Erreur lors du lancement des tests.');
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadStatus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleExpand = (num: number) => {
    setExpandedScenarios((prev) => ({ ...prev, [num]: !prev[num] }));
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs overflow-y-auto animate-modal-backdrop"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] my-auto animate-modal-content"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-700/60 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Suite de Tests des Scénarios d'Acceptation
                <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  Section 62
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Validation automatisée en direct des 10 critères d'acceptation fonctionnels
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRunTests}
              disabled={isRunning}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 transition shadow"
            >
              {isRunning ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Exécution en cours...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Relancer les 10 Tests</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Global summary badge */}
        <div className="px-6 py-3 bg-slate-950/40 border-b border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 font-medium">
            {passed ? (
              <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <CheckCircle2 className="w-4 h-4" />
                SUCCÈS TOTAL — {summary}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-red-400 font-bold">
                <XCircle className="w-4 h-4" />
                {summary}
              </span>
            )}
          </div>
          <div className="text-slate-400 font-mono text-[11px]">
            Base SQLite WAL • Transactionnel • Backend Express
          </div>
        </div>

        {/* Scenarios List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {results.map((res) => {
            const isExpanded = !!expandedScenarios[res.scenarioNumber];
            return (
              <div
                key={res.scenarioNumber}
                className={`rounded-xl border transition overflow-hidden ${
                  res.passed
                    ? 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    : 'bg-red-950/30 border-red-800/80'
                }`}
              >
                <div
                  className="flex items-center justify-between p-3.5 cursor-pointer select-none"
                  onClick={() => toggleExpand(res.scenarioNumber)}
                >
                  <div className="flex items-center gap-3">
                    {res.passed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-400 shrink-0" />
                    )}
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                          SCÉNARIO {res.scenarioNumber}
                        </span>
                        {res.title}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {res.details}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-slate-400">
                    <span className="text-[10px] uppercase tracking-wider font-semibold font-mono">
                      {res.logs.length} logs
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>

                {/* Expanded Logs */}
                {isExpanded && res.logs.length > 0 && (
                  <div className="px-4 pb-3 pt-1 border-t border-slate-800/60 bg-slate-950/80 text-[11px] font-mono space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-500 text-[10px] mb-1">
                      <Terminal className="w-3 h-3" />
                      <span>Trace d'exécution :</span>
                    </div>
                    {res.logs.map((log, lIdx) => (
                      <div
                        key={lIdx}
                        className={`pl-2 border-l-2 ${
                          log.startsWith('✓')
                            ? 'border-emerald-500 text-emerald-300'
                            : log.startsWith('•')
                            ? 'border-blue-500 text-slate-300'
                            : 'border-red-500 text-red-300'
                        }`}
                      >
                        {log}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div>
            Commande CLI disponible : <code className="font-mono bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">npm run test:acceptance</code>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

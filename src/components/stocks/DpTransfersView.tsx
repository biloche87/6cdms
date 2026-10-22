import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import { DpTransfer, DropPoint } from '../../types/index.ts';
import { formatDateTime } from '../../utils/date.ts';
import {
  Truck,
  CheckCircle2,
  Clock,
  Building2,
  PackageCheck,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Boxes,
  Loader2,
  X,
  FileText,
  Lock,
} from 'lucide-react';

export const DpTransfersView: React.FC = () => {
  const { user } = useAuth();
  const [transfers, setTransfers] = useState<DpTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [dropPoints, setDropPoints] = useState<DropPoint[]>([]);
  const [dropPointFilter, setDropPointFilter] = useState('');

  // Setting state
  const [shippingConditioned, setShippingConditioned] = useState<boolean>(false);
  const [updatingSetting, setUpdatingSetting] = useState(false);

  // Transfer action state
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Detail modal
  const [selectedTransfer, setSelectedTransfer] = useState<DpTransfer | null>(null);

  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [trfRes, setRes] = await Promise.all([
        api.getDpTransfers({
          status: statusFilter || undefined,
          dropPointId: dropPointFilter ? parseInt(dropPointFilter, 10) : undefined,
        }),
        api.getDpSupplySettings(),
      ]);
      setTransfers(trfRes.transfers || []);
      setShippingConditioned(!!setRes.shippingConditionedOnPayment);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    if (user?.role === 'SALES_ADMIN_NATIONAL') {
      api.getDropPoints().then((res) => setDropPoints(res.dropPoints || [])).catch(console.error);
    }
  }, [statusFilter, dropPointFilter]);

  const handleToggleSetting = async () => {
    if (user?.role !== 'SALES_ADMIN_NATIONAL') return;
    setUpdatingSetting(true);
    setErrorMsg(null);
    try {
      const nextVal = !shippingConditioned;
      const res = await api.updateDpSupplySettings({ shippingConditionedOnPayment: nextVal });
      setShippingConditioned(res.shippingConditionedOnPayment);
      setSuccessMsg(
        `Règle modifiée : Expédition conditionnée au paiement est désormais ${
          res.shippingConditionedOnPayment ? 'ACTIVÉE' : 'DÉSACTIVÉE'
        }.`
      );
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erreur lors de la modification du paramètre.');
    } finally {
      setUpdatingSetting(false);
    }
  };

  const handleUpdateStatus = async (transfer: DpTransfer, newStatus: 'EN_TRANSIT' | 'RECU') => {
    setProcessingId(transfer.id);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await api.updateDpTransferStatus(transfer.id, { newStatus });
      setSuccessMsg(res.message);
      loadData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erreur lors du changement de statut logistique.');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl sm:text-2xl font-black text-white">
            Transferts
          </h1>
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-950 text-blue-300 border border-blue-800">
            {transfers.length}
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-0.5">
          Suivi logistique strict : 6C Distribution débitée à « En transit », Drop Point crédité uniquement à la confirmation « Réception 6C Distribution » (Reçu).
        </p>
      </div>

      {/* Conditioned Shipping Setting Banner (SAN only) */}
      {user?.role === 'SALES_ADMIN_NATIONAL' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                shippingConditioned
                  ? 'bg-amber-950/70 text-amber-400 border-amber-800/80'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {shippingConditioned ? <Lock className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
            </div>
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <span>Règle : Expédition conditionnée au paiement</span>
                <span
                  className={`text-[10px] px-2 py-0.2 rounded-full font-bold uppercase tracking-wider ${
                    shippingConditioned
                      ? 'bg-amber-950 text-amber-300 border border-amber-800'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {shippingConditioned ? 'Active' : 'Désactivée (Par défaut)'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {shippingConditioned
                  ? "Bloque strictement le départ 'En transit' si la facture n'est pas intégralement réglée par le Drop Point."
                  : "Permet l'expédition 'En transit' même si le règlement est en cours ou différé."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggleSetting}
            disabled={updatingSetting}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition shrink-0 ${
              shippingConditioned
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                : 'bg-amber-950 hover:bg-amber-900 text-amber-200 border-amber-800 shadow-sm'
            }`}
          >
            {updatingSetting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : shippingConditioned ? (
              'Désactiver la condition'
            ) : (
              'Activer la condition'
            )}
          </button>
        </div>
      )}

      {/* Messages */}
      {errorMsg && (
        <div className="p-4 bg-rose-950/70 border border-rose-800 rounded-xl text-xs text-rose-200 flex items-center gap-2.5 shadow-sm">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <div className="font-semibold">{errorMsg}</div>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-950/70 border border-emerald-800 rounded-xl text-xs text-emerald-200 flex items-center gap-2.5 shadow-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <div className="font-semibold">{successMsg}</div>
        </div>
      )}

      {/* Filter bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setStatusFilter('')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              statusFilter === ''
                ? 'bg-slate-800 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            Tous les transferts
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('PREPARE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
              statusFilter === 'PREPARE'
                ? 'bg-blue-950 text-blue-300 border border-blue-800'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            <span>Préparés</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('EN_TRANSIT')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
              statusFilter === 'EN_TRANSIT'
                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Truck className="w-3.5 h-3.5 text-amber-400" />
            <span>En transit</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('RECU')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
              statusFilter === 'RECU'
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Reçus</span>
          </button>
        </div>

        {user?.role === 'SALES_ADMIN_NATIONAL' && (
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-400" />
            <select
              value={dropPointFilter}
              onChange={(e) => setDropPointFilter(e.target.value)}
              className="p-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Tous les Drop Points</option>
              {dropPoints.map((dp) => (
                <option key={dp.id} value={dp.id}>
                  {dp.name} ({dp.code})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Transfers List */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
          <span className="text-xs">Chargement des transferts logistiques...</span>
        </div>
      ) : transfers.length === 0 ? (
        <div className="py-16 text-center bg-slate-900 border border-slate-800 rounded-2xl p-8">
          <Truck className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-300">Aucun transfert</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Les transferts logistiques sont créés automatiquement lorsque le SAN valide une commande de stock.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {transfers.map((trf) => {
            const isPrepared = trf.status === 'PREPARE';
            const isTransit = trf.status === 'EN_TRANSIT';
            const isReceived = trf.status === 'RECU';

            return (
              <div
                key={trf.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4"
              >
                {/* Left Info */}
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono text-sm font-bold text-white tracking-wide">
                      {trf.transfer_number}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-medium">
                      {trf.dropPointName} ({trf.dropPointCode})
                    </span>

                    {/* Step Status Badge */}
                    <span
                      className={`status-badge ${
                        isReceived
                          ? 'status-badge-green'
                          : isTransit
                          ? 'status-badge-brown'
                          : 'status-badge-brown'
                      }`}
                    >
                      {isReceived && <CheckCircle2 className="w-4 h-4 text-white" />}
                      {isTransit && <Truck className="w-4 h-4 text-white" />}
                      {isPrepared && <Boxes className="w-4 h-4 text-white" />}
                      <span>
                        {isReceived ? 'Reçu' : isTransit ? 'En transit' : 'Préparé'}
                      </span>
                    </span>

                    {/* Associated Invoice & Payment badge */}
                    {trf.invoiceNumber && (
                      <span
                        className={`status-badge font-mono ${
                          trf.invoicePaymentStatus === 'PAYE'
                            ? 'status-badge-green'
                            : trf.invoicePaymentStatus === 'PARTIELLEMENT_PAYE'
                            ? 'status-badge-brown'
                            : 'status-badge-grey'
                        }`}
                      >
                        Facture {trf.invoiceNumber} : {trf.invoicePaymentStatus === 'PAYE' ? 'Payée' : trf.invoicePaymentStatus === 'PARTIELLEMENT_PAYE' ? 'Partiellement payée' : 'À payer'}
                      </span>
                    )}
                  </div>

                  {/* Flow Timeline & Stock Rules */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                    <span>
                      Cartons : <strong className="text-white font-mono">{trf.totalCartons || 0} ctn</strong>
                    </span>
                    {trf.prepared_at && <span>Préparé le : {formatDateTime(trf.prepared_at)}</span>}
                    {trf.shipped_at && (
                      <span className="text-amber-300">
                        Expédié le : <strong>{formatDateTime(trf.shipped_at)}</strong>
                      </span>
                    )}
                    {trf.received_at && (
                      <span className="text-emerald-400">
                        Réceptionné le : <strong>{formatDateTime(trf.received_at)}</strong> ({trf.receiverName})
                      </span>
                    )}
                  </div>

                  {/* Operational Notes */}
                  {trf.notes && (
                    <p className="text-xs text-slate-300 bg-slate-950/70 p-2 rounded-xl border border-slate-800/60 italic">
                      « {trf.notes} »
                    </p>
                  )}
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  {/* Action SAN: Ship transfer -> En transit */}
                  {user?.role === 'SALES_ADMIN_NATIONAL' && isPrepared && (
                    <button
                      type="button"
                      disabled={processingId === trf.id}
                      onClick={() => handleUpdateStatus(trf, 'EN_TRANSIT')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md transition disabled:opacity-50"
                      title="Débite le stock 6C Distribution et met en transit"
                    >
                      {processingId === trf.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Truck className="w-4 h-4" />
                      )}
                      <span>Expédier (En transit)</span>
                    </button>
                  )}

                  {/* Action Sales Admin: Confirm reception -> Reçu */}
                  {(user?.role === 'SALES_ADMIN' || user?.role === 'SALES_ADMIN_NATIONAL') && isTransit && (
                    <button
                      type="button"
                      disabled={processingId === trf.id}
                      onClick={() => handleUpdateStatus(trf, 'RECU')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition disabled:opacity-50"
                      title="Réceptionne le stock 6C Distribution et crédite le Drop Point"
                    >
                      {processingId === trf.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      <span>Réception 6C Distribution (Reçu)</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setSelectedTransfer(trf)}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                  >
                    <span>Contenu</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Content Modal */}
      {selectedTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
              <div>
                <h3 className="text-base font-bold text-white">
                  Contenu du Transfert #{selectedTransfer.transfer_number}
                </h3>
                <p className="text-xs text-slate-400">
                  Destination : {selectedTransfer.dropPointName} ({selectedTransfer.dropPointCode})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTransfer(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-3 max-h-[70vh] overflow-y-auto">
              {(selectedTransfer.items || []).map((it) => (
                <div
                  key={it.id}
                  className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-bold text-white">{it.productName}</div>
                    <div className="text-[11px] text-slate-400 font-mono">Réf : {it.productReference}</div>
                  </div>
                  <div className="font-mono font-bold text-white text-sm">
                    {it.quantity_approved || it.quantity_requested} cartons
                  </div>
                </div>
              ))}
            </div>

            <div className="px-6 py-3 border-t border-slate-800 flex items-center justify-end bg-slate-900/90">
              <button
                type="button"
                onClick={() => setSelectedTransfer(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

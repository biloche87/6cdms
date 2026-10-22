import React, { useState, useEffect } from 'react';
import { Sale } from '../../types/index.ts';
import { api } from '../../services/api.ts';
import {
  Printer,
  X,
  Share2,
  Copy,
  Check,
  Download,
  Receipt,
  Store,
  Building2,
  UserCheck,
  Clock,
  Sparkles,
  Maximize2,
  Minimize2,
} from 'lucide-react';

interface SaleReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale | null;
  saleId?: number;
}

export const SaleReceiptModal: React.FC<SaleReceiptModalProps> = ({
  isOpen,
  onClose,
  sale: initialSale,
  saleId,
}) => {
  const [sale, setSale] = useState<Sale | null>(initialSale);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isThermalScale, setIsThermalScale] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (initialSale && initialSale.items && initialSale.items.length > 0) {
      setSale(initialSale);
    } else {
      const targetId = saleId || initialSale?.id;
      if (targetId) {
        loadFullSale(targetId);
      }
    }
  }, [isOpen, initialSale, saleId]);

  const loadFullSale = async (id: number) => {
    setLoading(true);
    try {
      const res = await api.getSale(id);
      if (res.sale) {
        setSale(res.sale);
      }
    } catch (err) {
      console.error('Erreur chargement reçu vente:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const receiptDate = sale?.createdAt ? new Date(sale.createdAt) : new Date();
  const formattedDate = receiptDate.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const formattedTime = receiptDate.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const rawTotal = sale?.totalAmount ?? 0;
  const discount = sale?.discount ?? 0;
  const totalCartons = sale?.totalCartons ?? sale?.items?.reduce((acc, it) => acc + (it.quantityCartons || 0), 0) ?? 0;

  const copyReceiptText = () => {
    if (!sale) return;
    const lines = [
      '================================',
      '       6C DISTRIBUTION          ',
      '    RESEAU NATIONAL COMMERCIAL   ',
      '================================',
      `TICKET DE VENTE : ${sale.saleNumber}`,
      `DATE : ${formattedDate} à ${formattedTime}`,
      '--------------------------------',
      `DEPÔT : ${sale.dropPointName || 'Dépôt Affilié'} (${sale.dropPointCode || 'DP'})`,
      `VENDEUR : ${sale.vrsName} (${sale.vrsPublicId})`,
      `POINT DE VENTE : ${sale.posName} (${sale.posCode})`,
      `GERANT : ${sale.posOwner || 'Client'}`,
      `LOCALISATION : ${sale.posNeighborhood || sale.posAddress || 'Zone commerciale'}`,
      '--------------------------------',
      'ARTICLES VENDUS :',
      ...(sale.items || []).map(
        (it) =>
          `- ${it.productName || 'Produit'} : ${it.quantityCartons} ctn x ${Number(it.unitPrice).toLocaleString('fr-FR')} = ${Number(it.totalPrice).toLocaleString('fr-FR')} FCFA`
      ),
      '--------------------------------',
      `TOTAL CARTONS : ${totalCartons} cartons`,
      discount > 0 ? `REMISE : -${discount.toLocaleString('fr-FR')} FCFA` : null,
      `NET A PAYER : ${Number(rawTotal).toLocaleString('fr-FR')} FCFA`,
      'PAIEMENT : COMPTANT / ESPECES (VALIDE)',
      '================================',
      'Marchandise reçue conforme.',
      'Merci pour votre fidélité !',
    ].filter(Boolean);

    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadReceipt = () => {
    if (!sale) return;
    const lines = [
      '==========================================',
      '               6C DMS                     ',
      '   DISTRIBUTION MANAGEMENT SYSTEM         ',
      '==========================================',
      `TICKET DE VENTE : ${sale.saleNumber}`,
      `DATE            : ${formattedDate} à ${formattedTime}`,
      '------------------------------------------',
      `DEPÔT           : ${sale.dropPointName || '6C Distribution'} (${sale.dropPointCode || 'DP'})`,
      `VENDEUR         : ${sale.vrsName} (${sale.vrsPublicId})`,
      `POINT DE VENTE  : ${sale.posName} (${sale.posCode})`,
      `GERANT          : ${sale.posOwner || 'Client'}`,
      `LOCALISATION    : ${sale.posNeighborhood || sale.posAddress || '-'}`,
      '------------------------------------------',
      'ARTICLES VENDUS :',
      ...(sale.items || []).map(
        (it) =>
          `- ${it.productName || 'Produit'} : ${it.quantityCartons} ctn x ${Number(it.unitPrice).toLocaleString('fr-FR')} = ${Number(it.totalPrice).toLocaleString('fr-FR')} FCFA`
      ),
      '------------------------------------------',
      `TOTAL CARTONS   : ${totalCartons} cartons`,
      discount > 0 ? `REMISE          : -${discount.toLocaleString('fr-FR')} FCFA` : null,
      `NET A PAYER     : ${Number(rawTotal).toLocaleString('fr-FR')} FCFA`,
      'REGLEMENT       : ESPECES (VALIDE)',
      '==========================================',
      'Marchandise reçue conforme.',
      'Merci pour votre confiance !',
    ].filter(Boolean);

    const blob = new Blob([lines.join('\r\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Recu_Vente_${sale.saleNumber || sale.id}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    if (!sale) return;
    const text = `Reçu 6C Distribution #${sale.saleNumber} pour ${sale.posName} - Montant: ${Number(rawTotal).toLocaleString('fr-FR')} FCFA. Vendeur: ${sale.vrsName}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Reçu de vente ${sale.saleNumber}`,
          text,
        });
      } catch {
        copyReceiptText();
      }
    } else {
      copyReceiptText();
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static animate-modal-backdrop"
    >
      {/* Styles for direct 80x55mm thermal printing */}
      <style>{`
        @media print {
          @page {
            size: 80mm auto;
            margin: 0;
          }
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          body * {
            visibility: hidden;
          }
          #thermal-receipt-printable, #thermal-receipt-printable * {
            visibility: visible;
          }
          #thermal-receipt-printable {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            max-width: 80mm !important;
            padding: 3mm 4mm !important;
            margin: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
            border: none !important;
            font-family: 'Courier New', Courier, monospace !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[95vh] print:max-w-none print:border-none print:shadow-none print:bg-white print:rounded-none print:m-0"
      >
        {/* Modal Header (Hidden during print) */}
        <div className="no-print flex-shrink-0 flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Reçu de Vente</h3>
              </div>
              <p className="text-[11px] text-slate-400">
                Ticket officiel de vente terrain & encaissement
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsThermalScale(!isThermalScale)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              title={isThermalScale ? 'Agrandir la vue' : 'Vue échelle 80mm'}
            >
              {isThermalScale ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 bg-slate-950/60 flex flex-col items-center print:p-0 print:bg-white">
          {loading || !sale ? (
            <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
              <span>Chargement du reçu de vente...</span>
            </div>
          ) : (
            <div className="w-full flex justify-center">
              {/* THE THERMAL RECEIPT CONTAINER */}
              <div
                id="thermal-receipt-printable"
                className={`w-full bg-white text-black font-mono shadow-2xl p-4 sm:p-5 text-[11px] leading-tight select-text transition-all duration-200 border-t-4 border-b-4 border-slate-300 ${
                  isThermalScale
                    ? 'max-w-[320px] rounded-none text-[10px]'
                    : 'max-w-[360px] sm:max-w-[380px] rounded-sm'
                }`}
                style={{
                  minHeight: '220px',
                  fontFamily: '"Courier New", Courier, monospace, monospace',
                }}
              >
                {/* 1. Header with Brand Logo */}
                <div className="text-center pb-2 border-b border-dashed border-black space-y-1">
                  <div className="flex items-center justify-center gap-1.5 pt-0.5">
                    <span className="inline-block bg-[#0a2342] text-white font-black text-xs px-2 py-0.5 tracking-tighter rounded-xs">
                      6C
                    </span>
                    <span className="font-black text-xs tracking-wider text-[#54a835] uppercase">
                      DMS
                    </span>
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-black font-black">
                    TICKET DE VENTE
                  </div>
                </div>

                {/* 2. Drop Point & Seller Affiliation */}
                <div className="py-2 border-b border-dashed border-black text-[10px] space-y-1">
                  <div className="flex justify-between">
                    <span className="font-bold">DEPÔT AFFILIÉ :</span>
                    <span className="font-bold truncate text-right">
                      {sale.dropPointName || '6C Distribution'} ({sale.dropPointCode || 'DKN'})
                    </span>
                  </div>
                  {sale.dropPointCity && (
                    <div className="flex justify-between text-[9px] text-black/80">
                      <span>Localisation :</span>
                      <span>{sale.dropPointCity}</span>
                    </div>
                  )}
                  {sale.dropPointPhone && (
                    <div className="flex justify-between text-[9px] text-black/80">
                      <span>Tél Dépôt :</span>
                      <span>{sale.dropPointPhone}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-1 border-t border-dotted border-black/40">
                    <span className="font-bold">VENDEUR (VRS) :</span>
                    <span className="font-bold truncate text-right">{sale.vrsName}</span>
                  </div>
                  <div className="flex justify-between text-[9px]">
                    <span>Matricule :</span>
                    <span className="font-mono">{sale.vrsPublicId}</span>
                  </div>
                  {sale.vrsPhone && (
                    <div className="flex justify-between text-[9px]">
                      <span>Contact Vendeur :</span>
                      <span>{sale.vrsPhone}</span>
                    </div>
                  )}
                </div>

                {/* 3. Point of Sale (Client) Details */}
                <div className="py-2 border-b border-dashed border-black text-[10px] space-y-1">
                  <div className="flex justify-between items-start">
                    <span className="font-bold">CLIENT (PDV) :</span>
                    <span className="font-bold text-right max-w-[65%] truncate">
                      {sale.posName}
                    </span>
                  </div>
                  <div className="flex justify-between text-[9px]">
                    <span>Code PDV :</span>
                    <span>{sale.posCode}</span>
                  </div>
                  {sale.posOwner && (
                    <div className="flex justify-between text-[9px]">
                      <span>Gérant / Proprio :</span>
                      <span>{sale.posOwner}</span>
                    </div>
                  )}
                  {(sale.posNeighborhood || sale.posAddress) && (
                    <div className="flex justify-between text-[9px]">
                      <span>Quartier :</span>
                      <span className="truncate max-w-[65%]">
                        {sale.posNeighborhood || sale.posAddress}
                      </span>
                    </div>
                  )}
                  {sale.posPhone && (
                    <div className="flex justify-between text-[9px]">
                      <span>Téléphone PDV :</span>
                      <span>{sale.posPhone}</span>
                    </div>
                  )}
                </div>

                {/* 4. Sale Info Header */}
                <div className="py-2 border-b border-dashed border-black text-[10px] flex justify-between items-center">
                  <div>
                    <span className="font-bold block text-[11px]">
                      REÇU #{sale.saleNumber}
                    </span>
                    <span className="text-[9px] text-black/70">
                      {formattedDate} à {formattedTime}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-1 py-0.5 border border-black text-[8px] font-bold uppercase">
                      {sale.status === 'COMPLETED' ? 'VALIDÉ' : sale.status}
                    </span>
                  </div>
                </div>

                {/* 5. Itemized Table */}
                <div className="py-2 border-b border-dashed border-black">
                  <div className="flex justify-between font-bold text-[9px] uppercase border-b border-black pb-1 mb-1">
                    <span className="w-1/2">Désignation</span>
                    <span className="w-1/6 text-center">Qté</span>
                    <span className="w-1/3 text-right">Montant</span>
                  </div>

                  <div className="space-y-1.5 text-[10px]">
                    {(sale.items || []).map((it, idx) => {
                      const qty = it.quantityCartons ?? (it as any).quantity_cartons ?? 0;
                      const unitP = Number(it.unitPrice ?? (it as any).unit_price ?? 0);
                      const totalP = Number(it.totalPrice ?? (it as any).total_price ?? 0);
                      const name = it.productName || (it as any).product_name || 'Produit';

                      return (
                        <div key={idx} className="leading-tight">
                          <div className="flex justify-between items-start">
                            <span className="w-1/2 truncate font-semibold" title={name}>
                              {name}
                            </span>
                            <span className="w-1/6 text-center font-bold">
                              {qty} ctn
                            </span>
                            <span className="w-1/3 text-right font-bold">
                              {totalP.toLocaleString('fr-FR')} F
                            </span>
                          </div>
                          <div className="text-[8px] text-black/60 pl-1">
                            {unitP.toLocaleString('fr-FR')} FCFA/carton
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 6. Totals & Payment */}
                <div className="py-2 border-b border-dashed border-black space-y-1 text-[10px]">
                  <div className="flex justify-between">
                    <span>Volume Total :</span>
                    <span className="font-bold">{totalCartons} carton(s)</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-black">
                      <span>Remise Accordée :</span>
                      <span>-{discount.toLocaleString('fr-FR')} FCFA</span>
                    </div>
                  )}
                  <div className="flex justify-between items-baseline pt-1 border-t border-black text-xs font-black">
                    <span className="uppercase text-[11px]">NET A PAYER :</span>
                    <span className="text-sm tracking-tight">
                      {Number(rawTotal).toLocaleString('fr-FR')} FCFA
                    </span>
                  </div>
                  <div className="flex justify-between text-[9px] pt-1 text-black/80">
                    <span>Mode de Paiement :</span>
                    <span className="font-bold">COMPTANT (Espèces)</span>
                  </div>
                </div>

                {/* 7. Footer & Verification Digital Stamp */}
                <div className="pt-2 text-center text-[8px] space-y-1">
                  <div className="flex items-center justify-center gap-2 py-1">
                    <div className="w-10 h-10 border border-black p-0.5 flex items-center justify-center">
                      {/* Stylized pure SVG barcode/QR representation */}
                      <svg viewBox="0 0 32 32" className="w-full h-full">
                        <rect x="0" y="0" width="32" height="32" fill="none" stroke="black" strokeWidth="1" />
                        <rect x="3" y="3" width="8" height="8" fill="black" />
                        <rect x="5" y="5" width="4" height="4" fill="white" />
                        <rect x="21" y="3" width="8" height="8" fill="black" />
                        <rect x="23" y="5" width="4" height="4" fill="white" />
                        <rect x="3" y="21" width="8" height="8" fill="black" />
                        <rect x="5" y="23" width="4" height="4" fill="white" />
                        <line x1="14" y1="4" x2="18" y2="4" stroke="black" strokeWidth="2" />
                        <line x1="14" y1="8" x2="14" y2="16" stroke="black" strokeWidth="2" />
                        <line x1="18" y1="12" x2="26" y2="12" stroke="black" strokeWidth="2" />
                        <line x1="14" y1="20" x2="22" y2="20" stroke="black" strokeWidth="2" />
                        <line x1="18" y1="24" x2="28" y2="24" stroke="black" strokeWidth="2" />
                      </svg>
                    </div>
                    <div className="text-left text-[8px] leading-tight">
                      <div className="font-bold">SIGNATURE DIGITALE</div>
                      <div className="font-mono text-[7px] text-black/70">
                        HASH: {sale.saleNumber}-{sale.pointOfSaleId}
                      </div>
                      <div className="text-[7px]">Authentifié par 6C System</div>
                    </div>
                  </div>

                  <p className="font-bold uppercase tracking-wider text-[8px]">
                    *** MARCHANDISE REÇUE CONFORME ***
                  </p>
                  <p className="text-[8px] text-black/70">
                    Merci pour votre confiance et fidélité !
                  </p>
                  <div className="pt-1 text-[7px] text-black/60 font-mono">
                    Système Certifié 6C DMS
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Action Footer (Hidden during print) */}
        <div className="no-print flex-shrink-0 p-3.5 sm:p-4 border-t border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadReceipt}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-950/80 hover:bg-emerald-900/90 text-emerald-300 text-xs font-semibold rounded-xl border border-emerald-700/60 transition active:scale-95"
              title="Télécharger le ticket de vente (TXT)"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Télécharger</span>
            </button>
            <button
              type="button"
              onClick={copyReceiptText}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition active:scale-95"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copié !' : 'Copier'}</span>
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition active:scale-95"
            >
              <Share2 className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">Partager</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition"
            >
              Fermer
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#54a835] hover:bg-[#46912b] text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-950/50 transition active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimer le Reçu</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

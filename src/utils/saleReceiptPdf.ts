import { jsPDF } from 'jspdf';
import { formatDateTime } from './date.ts';

interface SaleReceiptData {
  saleNumber: string;
  createdAt: string;
  totalAmount: number;
  paymentMethod?: string;
  posName?: string;
  posCode?: string;
  managerName?: string;
  managerPhone?: string;
  sellerName?: string;
  sellerPhone?: string;
  items?: Array<{
    productName: string;
    quantityCartons: number;
    unitPrice: number;
    subtotal: number;
  }>;
}

export function exportSaleReceiptPdf(sale: SaleReceiptData): void {
  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, 200], // 80mm standard receipt / POS roll format
    });

    const margin = 5;
    const contentWidth = 70;
    let y = 8;

    // Header brand
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text('6C DISTRIBUTION', 40, y, { align: 'center' });
    y += 5;

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('DMS • Snack & Produits Alimentaires', 40, y, { align: 'center' });
    y += 4;
    doc.text('Tél: (+223) 76 00 00 00 • Bamako', 40, y, { align: 'center' });
    y += 5;

    // Divider
    doc.setDrawColor(203, 213, 225);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(margin, y, margin + contentWidth, y);
    doc.setLineDashPattern([], 0);
    y += 5;

    // Receipt details
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(`TICKET DE VENTE: ${sale.saleNumber}`, margin, y);
    y += 4.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Date : ${formatDateTime(sale.createdAt)}`, margin, y);
    y += 4;
    doc.text(`PDV  : ${sale.posName || 'Client Comptoir'} (${sale.posCode || '—'})`, margin, y);
    y += 4;
    if (sale.sellerName) {
      doc.text(`Vendeur : ${sale.sellerName}`, margin, y);
      y += 4;
    }
    if (sale.paymentMethod) {
      doc.text(`Règlement : ${sale.paymentMethod}`, margin, y);
      y += 4;
    }

    // Divider
    doc.line(margin, y, margin + contentWidth, y);
    y += 5;

    // Items table header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Article', margin, y);
    doc.text('Qté', 42, y, { align: 'center' });
    doc.text('P.U', 56, y, { align: 'right' });
    doc.text('Total', margin + contentWidth, y, { align: 'right' });
    y += 4;

    doc.line(margin, y, margin + contentWidth, y);
    y += 4;

    // Items list
    doc.setFont('helvetica', 'normal');
    const items = sale.items || [];
    items.forEach((item) => {
      doc.setTextColor(15, 23, 42);
      const name = item.productName.length > 20 ? item.productName.slice(0, 18) + '..' : item.productName;
      doc.text(name, margin, y);
      doc.text(String(item.quantityCartons), 42, y, { align: 'center' });
      doc.text(Number(item.unitPrice).toLocaleString('fr-FR'), 56, y, { align: 'right' });
      doc.text(Number(item.subtotal).toLocaleString('fr-FR'), margin + contentWidth, y, { align: 'right' });
      y += 4.5;
    });

    if (items.length === 0) {
      doc.text('Vente directe standard', margin, y);
      doc.text('1', 42, y, { align: 'center' });
      doc.text(Number(sale.totalAmount).toLocaleString('fr-FR'), 56, y, { align: 'right' });
      doc.text(Number(sale.totalAmount).toLocaleString('fr-FR'), margin + contentWidth, y, { align: 'right' });
      y += 4.5;
    }

    // Divider
    doc.setLineDashPattern([1, 1], 0);
    doc.line(margin, y, margin + contentWidth, y);
    doc.setLineDashPattern([], 0);
    y += 5;

    // Total
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('TOTAL À PAYER:', margin, y);
    doc.text(`${Number(sale.totalAmount).toLocaleString('fr-FR')} FCFA`, margin + contentWidth, y, { align: 'right' });
    y += 7;

    // Footer note
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Merci de votre confiance !', 40, y, { align: 'center' });
    y += 3.5;
    doc.text('Marchandise vendue certifiée et géolocalisée 6C DMS', 40, y, { align: 'center' });

    doc.save(`Recu_${sale.saleNumber}.pdf`);
  } catch (err) {
    console.error('Erreur export reçu PDF:', err);
    window.print();
  }
}

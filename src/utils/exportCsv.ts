/**
 * Robust CSV export utility with UTF-8 BOM encoding for seamless Excel compatibility in French.
 */

export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]): void {
  if (typeof window === 'undefined') return;

  const escapeCell = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const csvContent = rows.map((row) => row.map(escapeCell).join(';')).join('\r\n');
  // Prepend UTF-8 BOM so Microsoft Excel automatically parses accents (é, è, à, etc.) properly
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportSalesToCsv(sales: any[], filenamePrefix: string = '6C_Ventes'): void {
  const headers = [
    'N° Vente',
    'Date & Heure',
    'Point de Vente',
    'Code PDV',
    'Vendeur (VRS)',
    'Dépôt / Drop Point',
    'Montant Total (FCFA)',
    'Mode de Paiement',
    'Statut',
    'Nombre Articles',
    'Détail Articles',
  ];

  const rows = sales.map((s) => {
    const itemsSummary = Array.isArray(s.items)
      ? s.items.map((i: any) => `${i.productName || i.product_name || 'Article'} (x${i.quantityCartons || i.quantity || 1})`).join(' | ')
      : '';

    return [
      s.saleNumber || s.sale_number || `VNT-${s.id}`,
      s.createdAt || s.created_at || '',
      s.pointOfSaleName || s.pos_name || s.point_of_sale_name || '',
      s.pointOfSaleCode || s.pos_code || '',
      s.vrsName || s.vrs_name || s.sellerName || '',
      s.dropPointName || s.drop_point_name || '',
      s.totalAmount || s.total_amount || 0,
      s.paymentMethod || s.payment_method || 'ESPECES',
      s.status || 'VALIDE',
      Array.isArray(s.items) ? s.items.length : 0,
      itemsSummary,
    ];
  });

  const dateStr = new Date().toISOString().slice(0, 10);
  downloadCsv(`${filenamePrefix}_${dateStr}.csv`, [headers, ...rows]);
}

export function exportPosToCsv(pointsOfSale: any[], filenamePrefix: string = '6C_Points_De_Vente'): void {
  const headers = [
    'ID',
    'Code PDV',
    'Nom du Point de Vente',
    'Statut',
    'Dépôt de Rattachement',
    'Secteur Géographique',
    'Gestionnaire / Gérant',
    'Téléphone Gérant',
    'Vendeur Affecté',
    'Total Ventes Réalisées',
    'Chiffre d Affaires Réalisé (FCFA)',
    'Latitude GPS',
    'Longitude GPS',
    'Date de Création',
  ];

  const rows = pointsOfSale.map((p) => [
    p.publicId || p.id,
    p.code || '',
    p.name || '',
    p.status || 'ACTIF',
    p.dropPointName || p.drop_point_name || '',
    p.sectorName || p.sector_name || '',
    p.managerName || p.manager_name || '',
    p.managerPhone || p.manager_phone || '',
    p.assignedVrsName || p.assigned_vrs_name || '',
    p.totalSalesCount || p.total_sales_count || 0,
    p.totalSalesAmount || p.total_sales_amount || 0,
    p.latitude || '',
    p.longitude || '',
    p.createdAt || p.created_at || '',
  ]);

  const dateStr = new Date().toISOString().slice(0, 10);
  downloadCsv(`${filenamePrefix}_${dateStr}.csv`, [headers, ...rows]);
}

export function exportStocksToCsv(stocks: any[], filenamePrefix: string = '6C_Inventaire_Stocks'): void {
  const headers = [
    'Code Produit',
    'Désignation Produit',
    'Catégorie',
    'Prix Carton (FCFA)',
    'Stock Dépôt DAKAN (Cartons)',
    'Stock Vendeurs Terrain VRS (Cartons)',
    'Stock Global Entreprise (Cartons)',
    'Valeur Totale Stock (FCFA)',
    'Statut Seuil Alerte',
  ];

  const rows = stocks.map((item) => {
    const dpStock = Number(item.dropPointStock || item.stock_quantity || 0);
    const vrsStock = Number(item.vrsStock || item.vrs_stock || 0);
    const totalStock = dpStock + vrsStock;
    const price = Number(item.pricePerCarton || item.unit_price || 0);
    const totalValue = totalStock * price;
    const alertStatus = totalStock <= 10 ? 'CRITIQUE' : totalStock <= 30 ? 'ATTENTION' : 'OPTIMAL';

    return [
      item.code || item.sku || `PRD-${item.id}`,
      item.name || '',
      item.category || 'Général',
      price,
      dpStock,
      vrsStock,
      totalStock,
      totalValue,
      alertStatus,
    ];
  });

  const dateStr = new Date().toISOString().slice(0, 10);
  downloadCsv(`${filenamePrefix}_${dateStr}.csv`, [headers, ...rows]);
}

export function exportReceiptsToCsv(receipts: any[], filenamePrefix: string = '6C_Receptions_BL'): void {
  const headers = [
    'N° Bon de Livraison (BL)',
    'N° Facture / Fournisseur',
    'Fournisseur',
    'Dépôt de Réception',
    'Date de Réception',
    'Réceptionné par',
    'Statut',
    'Quantité Totale Cartons',
    'Valeur Marchandise (FCFA)',
    'Commentaires & Réserves',
  ];

  const rows = receipts.map((r) => [
    r.receiptNumber || r.receipt_number || `BL-${r.id}`,
    r.supplierInvoiceNumber || r.supplier_invoice_number || '',
    r.supplierName || r.supplier_name || '6C Distribution',
    r.dropPointName || r.drop_point_name || 'Drop Point DAKAN',
    r.receiptDate || r.receipt_date || r.createdAt || '',
    r.receivedByName || r.received_by_name || '',
    r.status || 'VALIDE',
    r.totalQuantity || r.total_quantity || 0,
    r.totalAmount || r.total_amount || 0,
    r.notes || '',
  ]);

  const dateStr = new Date().toISOString().slice(0, 10);
  downloadCsv(`${filenamePrefix}_${dateStr}.csv`, [headers, ...rows]);
}

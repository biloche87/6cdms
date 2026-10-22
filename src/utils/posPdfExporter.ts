import { jsPDF } from 'jspdf';
import { PointOfSale, Sale, Visit, User } from '../types/index.ts';

interface ExportPosPdfOptions {
  pos: PointOfSale;
  salesHistory?: Sale[];
  visitsHistory?: Visit[];
  currentUser?: User | null;
}

export const exportPosToPdf = async ({
  pos,
  salesHistory = [],
  visitsHistory = [],
  currentUser,
}: ExportPosPdfOptions): Promise<boolean> => {
  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
    const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
    const margin = 14;
    const contentWidth = pageWidth - margin * 2; // 182mm

    // Helper colors
    const primaryDark = [15, 23, 42]; // slate-900
    const primaryNavy = [30, 41, 59]; // slate-800
    const accentAmber = [217, 119, 6]; // amber-600
    const textDark = [30, 41, 59];
    const textMuted = [100, 116, 139]; // slate-500
    const bgLight = [248, 250, 252]; // slate-50
    const borderLight = [226, 232, 240]; // slate-200

    let currentY = 14;

    // --- TOP BANNER ---
    doc.setFillColor(primaryDark[0], primaryDark[1], primaryDark[2]);
    doc.rect(margin, currentY, contentWidth, 24, 'F');

    // Accent line on top
    doc.setFillColor(accentAmber[0], accentAmber[1], accentAmber[2]);
    doc.rect(margin, currentY, contentWidth, 2.5, 'F');

    // Brand Title
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('6C DIS-LOG • DISTRIBUTION & LOGISTIQUE', margin + 6, currentY + 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(203, 213, 225);
    doc.text('FICHE RÉCAPITULATIVE OFFICIELLE DU POINT DE VENTE', margin + 6, currentY + 18);

    // Date & Ref on right side of banner
    const nowStr = new Date().toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    doc.setFontSize(7.5);
    doc.setTextColor(226, 232, 240);
    doc.text(`Réf : ${pos.code || `PDV-${pos.id}`}`, pageWidth - margin - 6, currentY + 11, { align: 'right' });
    doc.text(`Édité le : ${nowStr}`, pageWidth - margin - 6, currentY + 18, { align: 'right' });

    currentY += 28;

    // --- POS TITLE & STATUS BOX ---
    doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
    doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
    doc.roundedRect(margin, currentY, contentWidth, 18, 2, 2, 'FD');

    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(pos.name || 'Point de Vente Sans Nom', margin + 6, currentY + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    const subtitle = `Gérant / Contact : ${pos.ownerName || 'Non renseigné'} • Tél : ${pos.phone || 'Non renseigné'}`;
    doc.text(subtitle, margin + 6, currentY + 14);

    // Status Badge on the right
    const status = pos.status || 'EN ATTENTE';
    let statusBg = [245, 158, 11]; // amber-500
    let statusText = [255, 255, 255];
    if (status === 'ACTIF' || status === 'VALIDE') {
      statusBg = [16, 185, 129]; // emerald-500
    } else if (status === 'SUPPRIME' || status === 'REJETE' || status === 'INACTIF') {
      statusBg = [239, 68, 68]; // red-500
    }

    doc.setFillColor(statusBg[0], statusBg[1], statusBg[2]);
    const badgeWidth = 38;
    const badgeX = pageWidth - margin - badgeWidth - 4;
    doc.roundedRect(badgeX, currentY + 4, badgeWidth, 10, 2, 2, 'F');
    doc.setTextColor(statusText[0], statusText[1], statusText[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(status, badgeX + badgeWidth / 2, currentY + 10, { align: 'center' });

    currentY += 22;

    // --- SECTION 1: INFORMATIONS GÉNÉRALES & LOCALISATION (2 COLUMNS) ---
    const colWidth = (contentWidth - 6) / 2;
    const col1X = margin;
    const col2X = margin + colWidth + 6;
    const infoBoxHeight = 44;

    // Column 1: Coordonnées & Localisation
    doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
    doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
    doc.roundedRect(col1X, currentY, colWidth, infoBoxHeight, 2, 2, 'FD');

    // Section 1 Header
    doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
    doc.rect(col1X, currentY, colWidth, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('INFORMATIONS GÉNÉRALES', col1X + 4, currentY + 4.8);

    doc.setFontSize(7.5);
    let lineY = currentY + 12;
    const addInfoRow = (label: string, value: string, xPos: number, yPos: number, maxW: number = 80) => {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
      doc.text(label, xPos, yPos);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      const truncated = doc.splitTextToSize(value || '-', maxW);
      doc.text(truncated[0] || '-', xPos + 24, yPos);
    };

    addInfoRow('Code PDV :', pos.code || `PDV-${pos.id}`, col1X + 4, lineY);
    lineY += 6;
    addInfoRow('Secteur :', pos.sectorName || (pos.sectorId ? `Secteur #${pos.sectorId}` : 'Non assigné'), col1X + 4, lineY);
    lineY += 6;
    addInfoRow('Quartier :', pos.neighborhood || 'Non renseigné', col1X + 4, lineY);
    lineY += 6;
    addInfoRow('Adresse :', pos.address || 'Non renseignée', col1X + 4, lineY);
    lineY += 6;
    addInfoRow('Dépôt / Hub :', pos.dropPointName || 'Dépôt principal', col1X + 4, lineY);

    // Column 2: Données GPS & Traçabilité
    doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
    doc.roundedRect(col2X, currentY, colWidth, infoBoxHeight, 2, 2, 'FD');

    doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
    doc.rect(col2X, currentY, colWidth, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('GÉOLOCALISATION & ENRÔLEMENT', col2X + 4, currentY + 4.8);

    lineY = currentY + 12;
    const latStr = pos.latitude ? `${Number(pos.latitude).toFixed(6)}°` : 'Non certifié';
    const lngStr = pos.longitude ? `${Number(pos.longitude).toFixed(6)}°` : 'Non certifié';
    const gpsStatus = pos.latitude && pos.longitude ? 'GPS Réellement Certifié' : 'Position non enregistrée';

    addInfoRow('Statut GPS :', gpsStatus, col2X + 4, lineY);
    lineY += 6;
    addInfoRow('Latitude :', latStr, col2X + 4, lineY);
    lineY += 6;
    addInfoRow('Longitude :', lngStr, col2X + 4, lineY);
    lineY += 6;
    const createdDateStr = pos.createdAt ? new Date(pos.createdAt).toLocaleDateString('fr-FR') : 'Non daté';
    addInfoRow('Enrôlé le :', createdDateStr, col2X + 4, lineY);
    lineY += 6;
    addInfoRow('Vendeur VRS :', pos.vrsName || 'Non assigné', col2X + 4, lineY);

    currentY += infoBoxHeight + 6;

    // --- SECTION 2: SYNTHÈSE DES VENTES ET VISITES (KPI CARDS) ---
    const totalSalesCount = salesHistory.length || pos.totalSalesCount || 0;
    const totalAmount = salesHistory.reduce((sum, s) => sum + (s.totalAmount || 0), 0) || pos.totalSalesAmount || 0;
    const avgBasket = totalSalesCount > 0 ? Math.round(totalAmount / totalSalesCount) : 0;
    const totalVisitsCount = visitsHistory.length;

    const kpiCardWidth = (contentWidth - 9) / 4;
    const kpiHeight = 16;

    const drawKpiCard = (x: number, title: string, value: string, color: number[]) => {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
      doc.roundedRect(x, currentY, kpiCardWidth, kpiHeight, 2, 2, 'FD');

      // Top colored bar
      doc.setFillColor(color[0], color[1], color[2]);
      doc.rect(x, currentY, kpiCardWidth, 1.5, 'F');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
      doc.text(title, x + 3, currentY + 6);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.text(value, x + 3, currentY + 12);
    };

    drawKpiCard(margin, 'TOTAL VENTES', `${totalSalesCount} vente(s)`, accentAmber);
    drawKpiCard(margin + kpiCardWidth + 3, 'CHIFFRE D\'AFFAIRES', `${totalAmount.toLocaleString('fr-FR')} F`, [16, 185, 129]);
    drawKpiCard(margin + (kpiCardWidth + 3) * 2, 'PANIER MOYEN', `${avgBasket.toLocaleString('fr-FR')} F`, [59, 130, 246]);
    drawKpiCard(margin + (kpiCardWidth + 3) * 3, 'VISITES TERRAIN', `${totalVisitsCount} visite(s)`, [139, 92, 246]);

    currentY += kpiHeight + 6;

    // --- OPTIONAL PHOTO SECTION (If photo exists, render thumbnail) ---
    let hasPhotoRendered = false;
    if (pos.photo && pos.photo.startsWith('data:image/')) {
      try {
        const photoBoxHeight = 36;
        const photoBoxWidth = 50;

        doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
        doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
        doc.roundedRect(margin, currentY, contentWidth, photoBoxHeight, 2, 2, 'FD');

        // Add Image
        doc.addImage(pos.photo, 'JPEG', margin + 3, currentY + 3, photoBoxWidth, photoBoxHeight - 6);

        // Photo info text
        const textX = margin + photoBoxWidth + 8;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(textDark[0], textDark[1], textDark[2]);
        doc.text('Photo de la Façade du Point de Vente', textX, currentY + 10);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
        doc.text('Photo certifiée prise sur le terrain pour identifier visuellement l\'enseigne.', textX, currentY + 16);
        doc.text(`Enregistrée avec coordonnées GPS : ${latStr}, ${lngStr}`, textX, currentY + 22);

        currentY += photoBoxHeight + 6;
        hasPhotoRendered = true;
      } catch (imgErr) {
        console.warn('Impossible d\'insérer la photo dans le PDF:', imgErr);
      }
    }

    // --- SECTION 3: DERNIÈRES VENTES RÉALISÉES ---
    const salesTableHeight = Math.min(salesHistory.length, 6) * 6 + 12;
    doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
    doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
    doc.roundedRect(margin, currentY, contentWidth, Math.max(salesTableHeight, 22), 2, 2, 'FD');

    // Header
    doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
    doc.rect(margin, currentY, contentWidth, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('HISTORIQUE DES DERNIÈRES TRANSACTIONS DE VENTE', margin + 4, currentY + 4.8);

    let tableY = currentY + 12;

    if (salesHistory.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
      doc.text('Aucune vente enregistrée pour ce point de vente à ce jour.', margin + 6, tableY);
      currentY += 24;
    } else {
      // Table Header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
      doc.text('N° Vente', margin + 4, tableY);
      doc.text('Date & Heure', margin + 35, tableY);
      doc.text('Vendeur (VRS)', margin + 75, tableY);
      doc.text('Statut', margin + 120, tableY);
      doc.text('Montant', pageWidth - margin - 4, tableY, { align: 'right' });

      // Divider
      doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
      doc.line(margin + 4, tableY + 2, pageWidth - margin - 4, tableY + 2);

      tableY += 6;
      const recentSales = salesHistory.slice(0, 6);
      recentSales.forEach((sale) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(textDark[0], textDark[1], textDark[2]);

        const saleNum = sale.saleNumber || `VTE-${sale.id}`;
        const saleDate = (sale as any).createdAt ? new Date((sale as any).createdAt).toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }) : '-';
        const vrsName = sale.vrsName || `Agent #${sale.vrsId || '-'}`;
        const statusLabel = sale.status === 'COMPLETED' ? 'Finalisée' : (sale.status || 'Validée');
        const amtStr = `${(sale.totalAmount || 0).toLocaleString('fr-FR')} FCFA`;

        doc.text(saleNum, margin + 4, tableY);
        doc.text(saleDate, margin + 35, tableY);
        doc.text(vrsName, margin + 75, tableY);
        doc.text(statusLabel, margin + 120, tableY);
        doc.setFont('helvetica', 'bold');
        doc.text(amtStr, pageWidth - margin - 4, tableY, { align: 'right' });

        tableY += 5.5;
      });

      currentY = tableY + 3;
    }

    // --- SECTION 4: VISITES TERRAIN (If space permits on Page 1, else Page 2) ---
    if (visitsHistory.length > 0) {
      if (currentY + 28 > pageHeight - 20) {
        doc.addPage();
        currentY = 14;
      }

      const visitsHeight = Math.min(visitsHistory.length, 4) * 6 + 12;
      doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
      doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
      doc.roundedRect(margin, currentY, contentWidth, Math.max(visitsHeight, 22), 2, 2, 'FD');

      doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
      doc.rect(margin, currentY, contentWidth, 7, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('DERNIÈRES VISITES TERRAIN EFFECTUÉES', margin + 4, currentY + 4.8);

      let vTableY = currentY + 12;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
      doc.text('Date', margin + 4, vTableY);
      doc.text('Agent VRS', margin + 35, vTableY);
      doc.text('Objectif / Résultat', margin + 75, vTableY);

      doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
      doc.line(margin + 4, vTableY + 2, pageWidth - margin - 4, vTableY + 2);

      vTableY += 6;
      visitsHistory.slice(0, 4).forEach((v) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(textDark[0], textDark[1], textDark[2]);
        const vDate = v.startedAt ? new Date(v.startedAt).toLocaleDateString('fr-FR') : '-';
        const vAgent = v.vrsName || `Agent #${v.vrsId || '-'}`;
        const vNotes = (v.notes || (v.status === 'TERMINEE' ? 'Visite terrain terminée avec succès' : 'Visite terrain enregistrée')).substring(0, 55);

        doc.text(vDate, margin + 4, vTableY);
        doc.text(vAgent, margin + 35, vTableY);
        doc.text(vNotes, margin + 75, vTableY);
        vTableY += 5.5;
      });

      currentY = vTableY + 4;
    }

    // --- FOOTER ON ALL PAGES ---
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
      doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);

      const userIdentifier = currentUser ? `${currentUser.firstName} ${currentUser.lastName} (${currentUser.role})` : 'Responsable 6C DIS-LOG';
      const footerLeft = `Document généré par : ${userIdentifier} • 6C DIS-LOG • Strictement Confidentiel`;
      doc.text(footerLeft, margin, pageHeight - 7);

      const footerRight = `Page ${i} sur ${totalPages}`;
      doc.text(footerRight, pageWidth - margin, pageHeight - 7, { align: 'right' });
    }

    // Generate safe filename
    const safeName = (pos.name || 'point_de_vente').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    const safeCode = (pos.code || `pdv_${pos.id}`).replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    const fileName = `fiche_${safeCode}_${safeName}.pdf`;

    // Trigger download
    doc.save(fileName);
    return true;
  } catch (error) {
    console.error('Erreur lors de la génération du PDF du point de vente:', error);
    return false;
  }
};

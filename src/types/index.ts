export type Role = 'SALES_ADMIN_NATIONAL' | 'SALES_ADMIN' | 'FSS' | 'VRS';

export interface User {
  id: number;
  publicId: string;
  role: Role;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  photo?: string;
  dropPointId: number | null;
  dropPointName?: string;
  dropPointCode?: string;
  salesAdminId: number | null;
  salesAdminName?: string;
  fssId: number | null;
  fssName?: string;
  sectorId: number | null;
  sectorName?: string;
  status: 'ACTIF' | 'EN TOURNÉE' | 'HORS LIGNE' | 'SUSPENDU' | 'INACTIF';
  lastLatitude?: number | null;
  lastLongitude?: number | null;
  lastLocationAccuracy?: number | null;
  lastLocationUpdatedAt?: string | null;
  createdAt?: string;
}

export interface VrsLiveLocation {
  id: number;
  publicId: string;
  firstName: string;
  lastName: string;
  phone: string;
  photo?: string;
  role: Role;
  status: string;
  lastLatitude: number | null;
  lastLongitude: number | null;
  lastLocationAccuracy: number | null;
  lastLocationSpeed: number | null;
  lastLocationUpdatedAt: string | null;
  dropPointId: number | null;
  dropPointName?: string;
  dropPointCode?: string;
  sectorName?: string;
  completedSalesCount: number;
  totalSalesAmount: number;
  liveStatus: 'LIVE' | 'RECENT' | 'OFFLINE' | 'NO_GPS';
  minutesAgo: number | null;
}

export interface VrsTrajectoryPoint {
  id: number;
  vrsId: number;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  actionContext: string;
  recordedAt: string;
  formattedTime: string;
  distanceFromPrevMeters?: number;
}

export interface VrsTrajectorySummary {
  totalPoints: number;
  totalDistanceKm: number;
  startTime: string | null;
  endTime: string | null;
  totalDurationMinutes: number;
  averageSpeedKmh: number;
  maxSpeedKmh: number;
  stopsCount: number;
}

export interface VrsTrajectoryResponse {
  user: {
    id: number;
    publicId: string;
    firstName: string;
    lastName: string;
    phone: string;
    photo?: string;
    dropPointName?: string;
    sectorName?: string;
  };
  date: string;
  trajectory: VrsTrajectoryPoint[];
  summary: VrsTrajectorySummary;
  associatedEvents: {
    sales: Array<{
      id: number;
      saleNumber: string;
      latitude: number | null;
      longitude: number | null;
      totalAmount: number;
      posName?: string;
      createdAt: string;
      formattedTime: string;
    }>;
    visits: Array<{
      id: number;
      latitude: number | null;
      longitude: number | null;
      posName?: string;
      startedAt: string;
      formattedTime: string;
    }>;
  };
  availableDates: string[];
}

export interface DropPoint {
  id: number;
  code: string;
  name: string;
  city: string;
  neighborhood: string;
  address: string;
  phone: string;
  latitude: number | null;
  longitude: number | null;
  status: 'ACTIF' | 'INACTIF';
  salesAdminName?: string;
  vrsCount?: number;
  fssCount?: number;
  posCount?: number;
  createdAt?: string;
}

export interface Sector {
  id: number;
  dropPointId: number;
  neighborhood: string;
  code: string;
  name: string;
  posCount?: number;
  vrsCount?: number;
}

export interface Product {
  id: number;
  categoryId: number;
  categoryName: string;
  subCategory: string;
  name: string;
  reference: string;
  unit: string;
  unitsPerCarton: number;
  unitPrice: number;
  dpCessionPrice?: number;
  vrsCessionPrice?: number;
  status: 'ACTIF' | 'INACTIF';
  dropPointId?: number | null;
  dropPointName?: string;
  dropPointCode?: string;
  availableStock?: number;
  createdAt?: string;
}

export interface StockItem {
  id: number;
  dropPointId?: number;
  dropPointName?: string;
  vrsId?: number;
  vrsName?: string;
  productId: number;
  productName: string;
  productRef: string;
  subCategory: string;
  categoryName: string;
  unit: string;
  unitsPerCarton: number;
  unitPrice: number;
  availableQuantity: number;
  reservedQuantity: number;
  alertThreshold: number;
  isLowStock: boolean;
  dropPointAvailableQuantity?: number;
  sales30dCartons?: number;
  hasPendingRequest?: boolean;
  updatedAt: string;
}

export interface StockMovement {
  id: number;
  reference: string;
  movementType: 'RECEIPT' | 'TRANSFER' | 'SALE' | 'RETURN' | 'ADJUSTMENT' | 'SUPPLY' | 'CANCELLATION';
  sourceRole?: string;
  targetRole?: string;
  dropPointName: string;
  productName: string;
  productRef: string;
  categoryName: string;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  notes?: string;
  createdByName?: string;
  createdAt: string;
}

export interface StockReceiptItem {
  id: number;
  productId: number;
  productName: string;
  productRef: string;
  categoryName: string;
  quantityCartons: number;
}

export interface StockReceipt {
  id: number;
  receiptNumber: string;
  deliveryNoteNumber: string;
  dropPointId: number;
  dropPointName: string;
  dropPointCode: string;
  supplier: string;
  receiptDate: string;
  observations?: string;
  attachmentUrl?: string;
  createdByName: string;
  itemCount: number;
  totalCartons: number;
  items?: StockReceiptItem[];
  createdAt: string;
}

export interface SupplyRequestItem {
  id?: number;
  productId: number;
  productName?: string;
  productRef?: string;
  categoryName?: string;
  quantityRequested: number;
  quantityApproved?: number;
  availableDropPointStock?: number;
}

export interface SupplyRequest {
  id: number;
  requestNumber: string;
  vrsId: number;
  vrsName: string;
  vrsPublicId: string;
  requesterRole?: 'VRS' | 'SALES_ADMIN';
  requesterName?: string;
  requesterPublicId?: string;
  requesterUserRole?: string;
  dropPointId: number;
  dropPointName: string;
  dropPointCode: string;
  status: 'Demandée' | 'Validée' | 'Partiellement validée' | 'Rejetée' | 'Chargée' | 'BROUILLON' | 'ENVOYÉE' | 'EN ATTENTE' | 'APPROUVÉE' | 'PRÉPARÉE' | 'LIVRÉE' | 'RÉCEPTIONNÉE' | 'REJETÉE' | string;
  totalCartons: number;
  desiredLoadingDate?: string;
  rejectionReason?: string;
  notes?: string;
  blNumber?: string;
  blAttachment?: string;
  blFileName?: string;
  blFileType?: string;
  items?: SupplyRequestItem[];
  createdAt: string;
}

export interface PointOfSale {
  id: number;
  publicId: string;
  name: string;
  code: string;
  ownerName: string;
  phone: string;
  photo?: string;
  address: string;
  neighborhood: string;
  sectorId: number | null;
  sectorName?: string;
  sectorCode?: string;
  dropPointId: number;
  dropPointName?: string;
  assignedVrsId: number | null;
  vrsName?: string;
  vrsPublicId?: string;
  createdByUserId?: number | null;
  latitude: number | null;
  longitude: number | null;
  status: 'EN ATTENTE' | 'VALIDE' | 'ACTIF' | 'REJETE' | 'SUSPENDU' | 'INACTIF' | 'SUPPRIME';
  isDeleted?: boolean | number;
  deletedAt?: string | null;
  deletedBy?: number | null;
  deletionStatus?: 'EN_ATTENTE_APPROBATION' | 'APPROUVEE' | 'REJETEE' | null;
  deletionReason?: string | null;
  deletionRequestedBy?: number | null;
  deletionRequestedAt?: string | null;
  deletionRequesterName?: string | null;
  deletionReviewedBy?: number | null;
  deletionReviewedAt?: string | null;
  deletionReviewNote?: string | null;
  totalSalesCount?: number;
  totalSalesAmount?: number;
  lastVisitDate?: string;
  monthlySales?: PosMonthlySalesData[];
  createdAt: string;
}

export interface PosMonthlySalesData {
  month: string;
  monthLabel: string;
  shortLabel: string;
  totalAmount: number;
  salesCount: number;
  cartonsSold: number;
  growthRate?: number;
}

export interface SaleItem {
  id?: number;
  productId: number;
  productName?: string;
  productRef?: string;
  categoryName?: string;
  quantityCartons: number;
  unitPrice: number;
  totalPrice: number;
  stockBefore?: number | null;
  stockAfter?: number | null;
}

export interface Sale {
  id: number;
  saleNumber: string;
  vrsId: number;
  vrsName: string;
  vrsPublicId: string;
  vrsPhone?: string;
  dropPointId: number;
  dropPointName: string;
  dropPointCode: string;
  dropPointCity?: string;
  dropPointAddress?: string;
  dropPointPhone?: string;
  pointOfSaleId: number;
  posName: string;
  posCode: string;
  posOwner: string;
  posPhone?: string;
  posAddress?: string;
  posNeighborhood?: string;
  totalAmount: number;
  discount: number;
  notes?: string;
  status: 'COMPLETED' | 'CANCELLED';
  latitude?: number | null;
  longitude?: number | null;
  locationAccuracy?: number | null;
  itemCount: number;
  totalCartons: number;
  items?: SaleItem[];
  createdAt: string;
}

export interface PerformanceCriteria {
  volumeScore: number;
  coverageScore: number;
  regularityScore: number;
  reliabilityScore: number;
}

export interface SellerPerformance {
  userId: number;
  vrsName: string;
  publicId: string;
  role: Role;
  dropPointName?: string;
  dropPointCode?: string;
  sectorName?: string;
  ratingScore: number; // Note sur 10 (ex: 8.8)
  ratingAppreciation: string;
  ratingColor: string;
  badgeLabel: string;
  totalSalesCount: number;
  cancelledSalesCount: number;
  totalRevenue: number;
  totalCartons: number;
  distinctPosServed: number;
  averageBasket: number;
  completedVisits: number;
  posCoveragePercent: number;
  criteria: PerformanceCriteria;
  strengths: string[];
  recommendations: string[];
}

export interface TourPlanVisitItem {
  id: number;
  pointOfSaleId?: number;
  posName: string;
  posAddress?: string;
  status: string;
  notes?: string;
}

export interface TourPlan {
  id: number;
  name: string;
  dayOfWeek?: string;
  dropPointId: number;
  dropPointName: string;
  dropPointCode?: string;
  neighborhood?: string;
  sectorId: number;
  sectorName: string;
  sectorCode?: string;
  vrsId: number;
  vrsName: string;
  vrsPublicId?: string;
  assignedVrsId?: number;
  assignedVrsName?: string;
  startDate?: string;
  endDate?: string;
  pdvCount?: number;
  targetVisitsCount?: number;
  status?: string;
  notes?: string;
  createdAt?: string;
  reviewedAt?: string;
  reviewedBy?: number;
  reviewedByName?: string;
  visits?: TourPlanVisitItem[];
}

export interface Visit {
  id: number;
  vrsId: number;
  vrsName: string;
  vrsPublicId: string;
  pointOfSaleId: number;
  posName: string;
  posCode: string;
  posOwner: string;
  posPhone: string;
  posAddress: string;
  dropPointId: number;
  dropPointName: string;
  startedAt: string;
  endedAt?: string;
  durationMinutes?: number;
  latitude?: number;
  longitude?: number;
  photo?: string;
  notes?: string;
  saleId?: number;
  saleNumber?: string;
  saleAmount?: number;
  status: 'EN_COURS' | 'TERMINEE';
}

export interface NotificationItem {
  id: number;
  title: string;
  message: string;
  type: string;
  is_read: number;
  link?: string;
  created_at: string;
}

export interface ActivityLogItem {
  id: number;
  user_id?: number;
  user_public_id: string;
  action: string;
  resource: string;
  details?: string;
  ip_address?: string;
  created_at: string;
}

export interface AcceptanceScenarioResult {
  scenarioNumber: number;
  title: string;
  passed: boolean;
  details: string;
  logs: string[];
}

export interface RecentTrendData {
  currentDay: number;
  isInsufficientData: boolean;
  currentPeriodAmount: number;
  previousPeriodAmount: number;
  percentage: number | null;
  label: string;
}

export interface DashboardKPIs {
  totalDropPoints: number;
  totalSalesAdmins: number;
  totalFSS: number;
  totalVRS: number;
  totalPos: number;
  pendingPos: number;
  activePos: number;
  salesTodayCount: number;
  salesTodayAmount: number;
  salesTodayCartons: number;
  salesSameDayLastWeekCount?: number;
  salesSameDayLastWeekAmount?: number;
  salesSameDayLastWeekGrowth?: number | null;
  salesMonthCount: number;
  salesMonthAmount: number;
  salesMonthCartons: number;
  totalSalesAllTimeAmount: number;
  totalStockCartons: number;
  dailyAverageCartons30d?: number;
  stockCoverageDays?: number;
  stockCoverageStatus?: 'RUPTURE' | 'BAS' | 'NORMAL' | 'SURSTOCK';
  stockCoverageLabel?: string;
  recentTrend?: RecentTrendData;
  lowStockAlerts: number;
  visitsToday: number;
  pendingSupplyRequests: number;
  creancesDropPoints?: {
    total: number;
    breakdown: Array<{
      dropPointId: number;
      dropPointName: string;
      dropPointCode: string;
      amount: number;
    }>;
  };
  pendingDpSupplyCount?: number;
  pendingPosRequestsCount?: number;
}

export interface DpSupplyRequestItem {
  id: number;
  request_id: number;
  product_id: number;
  productName?: string;
  productReference?: string;
  unitPrice?: number;
  quantity_requested: number;
  quantity_approved: number;
  unit_cession_price: number;
}

export interface DpSupplyRequest {
  id: number;
  request_number: string;
  drop_point_id: number;
  dropPointName?: string;
  dropPointCode?: string;
  dropPointCity?: string;
  created_by_user_id: number;
  requesterName?: string;
  requesterPublicId?: string;
  status: 'DEMANDEE' | 'VALIDEE' | 'REFUSEE';
  desired_date?: string;
  comments?: string;
  rejection_reason?: string;
  validation_notes?: string;
  reviewed_by_user_id?: number;
  reviewerName?: string;
  reviewed_at?: string;
  total_cartons_requested: number;
  total_cartons_approved: number;
  total_amount: number;
  created_at: string;
  updated_at: string;
  items?: DpSupplyRequestItem[];
  invoiceId?: number;
  invoiceNumber?: string;
  invoicePaymentStatus?: 'A_PAYER' | 'PARTIELLEMENT_PAYE' | 'PAYE';
  invoiceTotalAmount?: number;
  invoicePaidAmount?: number;
  invoiceRemainingAmount?: number;
  transferId?: number;
  transferNumber?: string;
  transferStatus?: 'PREPARE' | 'EN_TRANSIT' | 'RECU';
}

export interface DpInvoicePayment {
  id: number;
  invoice_id: number;
  drop_point_id: number;
  recorded_by_user_id: number;
  recordedByName?: string;
  amount: number;
  payment_date: string;
  payment_method: 'ESPECES' | 'VIREMENT' | 'MOBILE_MONEY';
  reference?: string;
  status?: 'CONFIRME' | 'ANNULE';
  cancelled_at?: string;
  cancelled_by_user_id?: number;
  cancellation_reason?: string;
  created_at: string;
}

export interface DpInvoice {
  id: number;
  invoice_number: string;
  request_id: number;
  requestNumber?: string;
  drop_point_id: number;
  dropPointName?: string;
  dropPointCode?: string;
  dropPointCity?: string;
  totalCartons?: number;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  payment_status: 'A_PAYER' | 'PARTIELLEMENT_PAYE' | 'PAYE';
  is_generated?: number;
  generated_at?: string;
  generated_by_user_id?: number;
  tva_applicable?: number;
  tva_rate?: number;
  tva_amount?: number;
  total_ht?: number;
  total_ttc?: number;
  status?: 'ACTIVE' | 'ANNULEE_AVOIR';
  credit_note_number?: string;
  credit_note_date?: string;
  credit_note_reason?: string;
  created_at: string;
  updated_at: string;
  payments?: DpInvoicePayment[];
  items?: any[];
  transferNumber?: string;
  transferStatus?: 'PREPARE' | 'EN_TRANSIT' | 'RECU';
}

export interface VrsInvoicePayment {
  id: number;
  invoice_id: number;
  vrs_id: number;
  vrsName?: string;
  drop_point_id: number;
  amount: number;
  payment_date: string;
  payment_method: 'ESPECES' | 'VIREMENT' | 'MOBILE_MONEY';
  reference?: string;
  notes?: string;
  status?: 'CONFIRME' | 'ANNULE';
  cancelled_at?: string;
  cancelled_by_user_id?: number;
  cancellation_reason?: string;
  created_at: string;
}

export interface VrsInvoice {
  id: number;
  invoice_number: string;
  request_id: number;
  requestNumber?: string;
  vrs_id: number;
  vrsName?: string;
  vrsPublicId?: string;
  vrsPhone?: string;
  drop_point_id: number;
  dropPointName?: string;
  dropPointCode?: string;
  dropPointCity?: string;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  payment_status: 'A_PAYER' | 'PARTIELLEMENT_PAYE' | 'PAYE';
  is_generated?: number;
  generated_at?: string;
  generated_by_user_id?: number;
  tva_applicable?: number;
  tva_rate?: number;
  tva_amount?: number;
  total_ht?: number;
  total_ttc?: number;
  status?: 'ACTIVE' | 'ANNULEE_AVOIR';
  credit_note_number?: string;
  credit_note_date?: string;
  credit_note_reason?: string;
  created_at: string;
  updated_at: string;
  payments?: VrsInvoicePayment[];
  items?: any[];
}

export interface DpTransfer {
  id: number;
  transfer_number: string;
  request_id: number;
  requestNumber?: string;
  totalCartons?: number;
  invoice_id: number;
  invoiceNumber?: string;
  invoicePaymentStatus?: 'A_PAYER' | 'PARTIELLEMENT_PAYE' | 'PAYE';
  invoiceTotalAmount?: number;
  invoicePaidAmount?: number;
  invoiceRemainingAmount?: number;
  drop_point_id: number;
  dropPointName?: string;
  dropPointCode?: string;
  dropPointCity?: string;
  status: 'PREPARE' | 'EN_TRANSIT' | 'RECU';
  shipping_blocked_unpaid?: number;
  prepared_at?: string;
  shipped_at?: string;
  received_at?: string;
  received_by_user_id?: number;
  receiverName?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  items?: Array<{
    id: number;
    product_id: number;
    productName: string;
    productReference: string;
    quantity_approved: number;
    quantity_requested: number;
  }>;
}

export interface PosCreationRequest {
  id: number;
  request_number: string;
  name: string;
  owner_name: string;
  phone: string;
  store_type?: string;
  neighborhood: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  photo?: string;
  vrs_id: number;
  vrsName?: string;
  vrsPublicId?: string;
  drop_point_id: number;
  dropPointName?: string;
  dropPointCode?: string;
  dropPointCity?: string;
  sector_id?: number;
  sectorName?: string;
  sectorCode?: string;
  status: 'EN_ATTENTE' | 'VALIDEE' | 'REFUSEE';
  rejection_reason?: string;
  fss_note?: string;
  fss_reviewed_by?: number;
  fssReviewerName?: string;
  fss_reviewed_at?: string;
  reviewed_by_user_id?: number;
  reviewerName?: string;
  reviewed_at?: string;
  created_pos_id?: number;
  posCode?: string;
  posPublicId?: string;
  created_at: string;
  updated_at: string;
}

export type GiftTier = 'AUCUN' | 'BRONZE' | 'OR';
export type DeliveryStatus = 'A_PROGRAMMER' | 'PROGRAMMEE' | 'REMISE_EFFECTUEE' | 'RECU';

export interface VrsScoringSettings {
  id: number;
  weight_turnover: number;
  weight_regularity: number;
  weight_payments: number;
  weight_new_pos: number;
  weight_rigor: number;
  updated_at?: string;
  updated_by_user_id?: number | null;
}

export interface Semester {
  id: number;
  code: string;
  name: string;
  start_date: string;
  end_date: string;
  closing_date: string;
  status: 'EN_COURS' | 'CLOTURE';
  closed_at?: string | null;
  closed_by_user_id?: number | null;
  created_at?: string;
  total_vrs_scored?: number;
  cards_generated_count?: number;
  cards_revealed_count?: number;
  gifts_delivered_count?: number;
}

export interface VrsSemesterScore {
  id: number;
  vrs_id: number;
  semester_id: number;
  vrs_public_id?: string;
  vrs_first_name?: string;
  vrs_last_name?: string;
  vrs_phone?: string;
  drop_point_id?: number | null;
  drop_point_name?: string;
  drop_point_code?: string;
  turnover_score: number;
  regularity_score: number;
  payments_score: number;
  new_pos_score: number;
  rigor_score: number;
  total_score: number;
  target_turnover: number;
  actual_turnover: number;
  working_days: number;
  active_sales_days: number;
  overdue_payments_count: number;
  unpaid_balance: number;
  new_pos_validated_count: number;
  target_new_pos: number;
  stock_discrepancies_count: number;
  rejected_requests_count: number;
  tier: GiftTier;
  is_frozen: number;
  correction_reason?: string | null;
  corrected_by_user_id?: number | null;
  corrected_at?: string | null;
  previous_total_score?: number | null;
  progression?: number | null;
  card_id?: number | null;
  card_code?: string | null;
  card_is_revealed?: number | null;
  card_revealed_at?: string | null;
  delivery_status?: DeliveryStatus | null;
  delivery_date?: string | null;
  delivery_location?: string | null;
  delivered_by?: string | null;
  gift_name?: string | null;
  gift_svg_key?: string | null;
  gift_custom_photo?: string | null;
  gift_photo_url?: string | null;
  gift_estimated_value?: number | null;
}

export interface GiftCatalogItem {
  id: number;
  name: string;
  tier: 'BRONZE' | 'OR';
  description?: string;
  estimated_value_fcfa?: number;
  quantity?: number;
  photo_url?: string | null;
  svg_key: string;
  custom_photo?: string | null;
  status: 'ACTIF' | 'INACTIF';
  created_at?: string;
  updated_at?: string;
}

export interface ScratchCard {
  id: number;
  code: string;
  semester_id: number;
  vrs_id: number;
  gift_id: number;
  tier: 'BRONZE' | 'OR';
  final_score: number;
  is_revealed: number;
  revealed_at?: string | null;
  revealed_method?: 'SCRATCH' | 'BUTTON' | null;
  delivery_status: DeliveryStatus;
  delivery_date?: string | null;
  delivery_location?: string | null;
  delivered_by?: string | null;
  delivery_comment?: string | null;
  delivered_at?: string | null;
  vrs_confirmed_at?: string | null;
  gift_name?: string | null;
  gift_tier?: 'BRONZE' | 'OR' | null;
  gift_description?: string | null;
  gift_svg_key?: string | null;
  gift_custom_photo?: string | null;
  gift_photo_url?: string | null;
  gift_estimated_value?: number | null;
  semester_name?: string;
  semester_code?: string;
  semester_status?: 'EN_COURS' | 'CLOTURE';
  vrs_name?: string | null;
  vrs_public_id?: string;
  vrs_first_name?: string;
  vrs_last_name?: string;
  vrs_phone?: string;
  vrs_photo?: string;
  drop_point_name?: string;
  drop_point_code?: string;
}



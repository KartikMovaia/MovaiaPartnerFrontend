// Analytics — partner-scoped dashboard stats + Movaia-staff cross-partner views.
import { api } from './api.service';

export type ScanStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

// A single point on the "Analyses over time" chart.
export interface TrendPoint {
  label: string;
  scans: number;
}

// A resolved date window (null/null = all-time). Sent as ?from&to query params.
export interface RangeParams {
  from?: string;
  to?: string;
}

export interface AnalyticsOverview {
  // storeId is set when the caller is an OUTLET_ADMIN (scoped to one store).
  scope: { partnerId: string; storeId: string | null };
  // Echo of the applied window; windowDays spans the totals for a range-correct avg/week.
  range: { from: string | null; to: string | null };
  windowDays: number;
  totals: { scans: number; reportsSent: number };
  funnel: { pending: number; processing: number; completed: number; failed: number };
  byStore: Array<{ storeId: string | null; storeName: string | null; scans: number }>;
  trend: TrendPoint[];
}

// One scan row. Customer contact is PII.
export interface ScanRow {
  id: string;
  storeId: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  status: ScanStatus;
  emailSentAt: string | null;
  createdAt: string;
  movaiaAnalysisId: string;
  store: { name: string } | null;
}

export interface ScanPage {
  items: ScanRow[];
  page: number;
  pageSize: number;
  totalCount: number;
}

// Partner-staff analytics (PARTNER_ADMIN sees the whole partner; OUTLET_ADMIN is
// scoped to their store server-side).
export const analyticsService = {
  async overview(range: RangeParams = {}): Promise<AnalyticsOverview> {
    const { data } = await api.get('/analytics/overview', { params: range });
    return data as AnalyticsOverview;
  },
  async scans(
    params: { page?: number; pageSize?: number; storeId?: string; status?: ScanStatus } = {}
  ): Promise<ScanPage> {
    const { data } = await api.get('/analytics/scans', { params });
    return data as ScanPage;
  },
};

// ── Movaia-staff-only cross-partner analytics ("Our Admin") ────────────────
export interface PartnerRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  storeCount: number;
  scanCount: number; // scoped to the requested range (all-time when unbounded)
  reportsSent?: number;
  last30Days: number;
}

export interface PartnersOverview {
  range: { from: string | null; to: string | null };
  totals: { partners: number; activePartners: number; scans: number; reportsSent: number; last30Days: number };
  partners: PartnerRow[];
  trend: TrendPoint[];
}

export interface PartnerAnalyticsDetail {
  partner: { id: string; name: string; slug: string; status: string; createdAt: string };
  totals: { allTime: number; last30Days: number };
  funnel: { pending: number; processing: number; completed: number; failed: number };
  byStore: Array<{ storeId: string; storeName: string; isActive: boolean; scans: number }>;
  recentScans: ScanRow[];
}

export const adminAnalyticsService = {
  async partnersOverview(range: RangeParams = {}): Promise<PartnersOverview> {
    const { data } = await api.get('/admin-analytics/partners', { params: range });
    return data as PartnersOverview;
  },
  async partnerDetail(id: string): Promise<PartnerAnalyticsDetail> {
    const { data } = await api.get(`/admin-analytics/partners/${id}`);
    return data as PartnerAnalyticsDetail;
  },
};

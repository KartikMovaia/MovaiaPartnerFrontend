// Analytics — partner-scoped dashboard stats + Movaia-staff cross-partner views.
import { api } from './api.service';

export type ScanStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

// A single point on the "Analyses over time" chart.
export interface TrendPoint {
  label: string;
  scans: number;
}

export interface AnalyticsOverview {
  // storeId is set when the caller is an OUTLET_ADMIN (scoped to one store).
  scope: { partnerId: string; storeId: string | null };
  totals: { allTime: number; last30Days: number; reportsSent: number };
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
  async overview(): Promise<AnalyticsOverview> {
    const { data } = await api.get('/analytics/overview');
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
  scanCount: number;
  last30Days: number;
}

export interface PartnersOverview {
  totals: { partners: number; scans: number; last30Days: number };
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
  async partnersOverview(): Promise<PartnersOverview> {
    const { data } = await api.get('/admin-analytics/partners');
    return data as PartnersOverview;
  },
  async partnerDetail(id: string): Promise<PartnerAnalyticsDetail> {
    const { data } = await api.get(`/admin-analytics/partners/${id}`);
    return data as PartnerAnalyticsDetail;
  },
};

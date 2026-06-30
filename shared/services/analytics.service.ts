import { api } from './api.service';

export interface AnalyticsOverview {
  totals: { allTime: number; last30Days: number };
  funnel: { pending: number; processing: number; completed: number; failed: number };
  byStore: Array<{ storeId: string | null; scans: number }>;
}

export const analyticsService = {
  async overview(): Promise<AnalyticsOverview> {
    const { data } = await api.get('/analytics/overview');
    return data;
  },
};

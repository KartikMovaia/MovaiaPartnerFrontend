// Partner + store/outlet-admin management — real API (reads Phase 2, writes Phase 3).
import { api } from './api.service';
import { PartnerRow } from './analytics.service';

// A branch as the management UI needs it: identity + activity + its outlet admin
// (with the admin's id so the row can manage it). Composed from /stores,
// /analytics/overview (scan counts), and /stores/admins.
export interface Store {
  id: string;
  name: string;
  location: string | null;
  isActive: boolean;
  scans: number;
  outletAdmin: { id: string; email: string; firstName: string; lastName: string } | null;
}

export interface OutletAdmin {
  id: string;
  storeId: string;
  storeName: string;
  email: string;
  firstName: string;
  lastName: string;
}

// Movaia-staff-only partner management.
export const partnerService = {
  // Driven by the clean admin-analytics list (exact PartnerRow incl. last30Days;
  // never exposes the per-partner webhookSecret).
  async list(): Promise<PartnerRow[]> {
    const { data } = await api.get('/admin-analytics/partners');
    return data.partners as PartnerRow[];
  },
  // Management detail (stores + partnerUsers + branding); webhookSecret is
  // stripped server-side.
  async get(id: string) {
    const { data } = await api.get(`/partners/${id}`);
    return data.partner;
  },
  async create(input: { name: string; slug: string }): Promise<PartnerRow> {
    const { data } = await api.post('/partners', input);
    const p = data.partner;
    return { id: p.id, name: p.name, slug: p.slug, status: p.status, storeCount: 0, scanCount: 0, last30Days: 0 };
  },
  async update(id: string, patch: { name: string }): Promise<void> {
    await api.patch(`/partners/${id}`, patch);
  },
  async suspend(id: string): Promise<void> {
    await api.post(`/partners/${id}/suspend`);
  },
  async reactivate(id: string): Promise<void> {
    await api.post(`/partners/${id}/reactivate`);
  },
  // Throws (409) if the partner still has branches/scan history — the caller
  // surfaces that message.
  async remove(id: string): Promise<void> {
    await api.delete(`/partners/${id}`);
  },
  async provisionAdmin(input: {
    partnerId: string;
    email: string;
    firstName: string;
    lastName: string;
  }): Promise<{ partnerUserId: string; tempPassword: string }> {
    const { data } = await api.post('/partners/admins', input);
    return data;
  },
};

export const storeService = {
  // Compose the branches view from the real endpoints: identity/active from
  // /stores, per-store scan counts from the analytics overview, and each
  // branch's outlet admin (with id) from /stores/admins.
  async list(): Promise<Store[]> {
    const [storesRes, adminsRes, overviewRes] = await Promise.all([
      api.get('/stores'),
      api.get('/stores/admins'),
      api.get('/analytics/overview'),
    ]);

    const scansByStore = new Map<string, number>(
      (overviewRes.data.byStore as Array<{ storeId: string | null; scans: number }>)
        .filter((b): b is { storeId: string; scans: number } => !!b.storeId)
        .map((b) => [b.storeId, b.scans])
    );
    const adminByStore = new Map<string, { id: string; email: string; firstName: string; lastName: string }>(
      (adminsRes.data.admins as Array<{ id: string; storeId: string; email: string; firstName: string; lastName: string }>).map(
        (a) => [a.storeId, { id: a.id, email: a.email, firstName: a.firstName, lastName: a.lastName }]
      )
    );

    return (
      storesRes.data.stores as Array<{ id: string; name: string; location: string | null; isActive: boolean }>
    ).map((s) => ({
      id: s.id,
      name: s.name,
      location: s.location,
      isActive: s.isActive,
      scans: scansByStore.get(s.id) ?? 0,
      outletAdmin: adminByStore.get(s.id) ?? null,
    }));
  },

  async create(input: { name: string; location?: string }): Promise<Store> {
    const { data } = await api.post('/stores', input);
    const s = data.store;
    return { id: s.id, name: s.name, location: s.location, isActive: s.isActive, scans: 0, outletAdmin: null };
  },
  async update(id: string, patch: { name?: string; location?: string; isActive?: boolean }): Promise<void> {
    await api.patch(`/stores/${id}`, patch);
  },
  async listOutletAdmins(storeId?: string): Promise<OutletAdmin[]> {
    const { data } = await api.get('/stores/admins', { params: storeId ? { storeId } : {} });
    return (
      data.admins as Array<{ id: string; storeId: string; store: { name: string } | null; email: string; firstName: string; lastName: string }>
    ).map((a) => ({
      id: a.id,
      storeId: a.storeId,
      storeName: a.store?.name ?? '',
      email: a.email,
      firstName: a.firstName,
      lastName: a.lastName,
    }));
  },
  async provisionOutletAdmin(input: {
    storeId: string;
    email: string;
    firstName: string;
    lastName: string;
  }): Promise<{ partnerUserId: string; tempPassword: string }> {
    const { data } = await api.post('/stores/admins', input);
    return data;
  },
  async removeOutletAdmin(id: string): Promise<void> {
    await api.delete(`/stores/admins/${id}`);
  },
  async resetOutletAdmin(id: string): Promise<{ tempPassword: string }> {
    const { data } = await api.post(`/stores/admins/${id}/reset`);
    return data;
  },
  async resendOutletInvite(id: string): Promise<void> {
    await api.post(`/stores/admins/${id}/resend`);
  },
  async reassignOutletAdmin(id: string, storeId: string): Promise<void> {
    await api.patch(`/stores/admins/${id}`, { storeId });
  },
};

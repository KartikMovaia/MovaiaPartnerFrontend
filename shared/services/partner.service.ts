import { api } from './api.service';

// Movaia-staff-only partner management.
export const partnerService = {
  async list() {
    const { data } = await api.get('/partners');
    return data.partners as Array<any>;
  },
  async get(id: string) {
    const { data } = await api.get(`/partners/${id}`);
    return data.partner;
  },
  async create(input: { name: string; slug: string }) {
    const { data } = await api.post('/partners', input);
    return data.partner;
  },
  async provisionAdmin(input: { partnerId: string; email: string; firstName: string; lastName: string }) {
    const { data } = await api.post('/partners/admins', input);
    return data as { partnerUserId: string; tempPassword: string };
  },
};

export const storeService = {
  async list() {
    const { data } = await api.get('/stores');
    return data.stores as Array<any>;
  },
  async create(input: { name: string; location?: string }) {
    const { data } = await api.post('/stores', input);
    return data.store;
  },
  async update(id: string, patch: { name?: string; location?: string; isActive?: boolean }) {
    await api.patch(`/stores/${id}`, patch);
  },
};

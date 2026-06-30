import { api, tokenStore } from './api.service';

export interface Staff {
  id: string;
  kind: 'PARTNER' | 'MOVAIA';
  email: string;
  partnerId?: string;
  partnerSlug?: string;
  partnerName?: string;
  role?: string;
  mustChangePassword?: boolean;
}

export const partnerAuthService = {
  // Audience-scoped: partner staff hit /login, Movaia internal staff hit
  // /staff-login. The two never authenticate against each other's table.
  async login(email: string, password: string, kind: 'PARTNER' | 'MOVAIA' = 'PARTNER'): Promise<Staff> {
    const path = kind === 'MOVAIA' ? '/partner-auth/staff-login' : '/partner-auth/login';
    const { data } = await api.post(path, { email, password });
    tokenStore.set(data.accessToken);
    return data.staff;
  },
  async me(): Promise<Staff> {
    const { data } = await api.get('/partner-auth/me');
    return data.staff;
  },
  async setPassword(newPassword: string): Promise<void> {
    await api.post('/partner-auth/set-password', { newPassword });
  },
  async logout(): Promise<void> {
    try {
      await api.post('/partner-auth/logout');
    } finally {
      tokenStore.clear();
    }
  },
};

// Staff auth (partner admins + Movaia staff). Login/refresh return Bearer tokens
// (stored via api.service); these calls exchange the staff profile the UI renders.
import { api, tokens } from './api.service';

export interface Staff {
  id: string;
  kind: 'PARTNER' | 'MOVAIA';
  email: string;
  partnerId?: string;
  partnerSlug?: string;
  partnerName?: string;
  // Set for OUTLET_ADMIN staff — their single outlet's id + name.
  storeId?: string;
  storeName?: string;
  role?: string;
  mustChangePassword?: boolean;
}

// In-memory snapshot of the signed-in staff, synced from login/me responses.
let current: Staff | null = null;
export function currentStaff(): Staff | null {
  return current;
}

export const partnerAuthService = {
  // Audience-scoped login: PARTNER → /login, MOVAIA → /staff-login. Stores the
  // returned tokens; returns the staff profile.
  async login(email: string, password: string, kind: 'PARTNER' | 'MOVAIA' = 'PARTNER'): Promise<Staff> {
    const path = kind === 'MOVAIA' ? '/partner-auth/staff-login' : '/partner-auth/login';
    const { data } = await api.post(path, { email, password });
    tokens.set(data.accessToken, data.refreshToken);
    current = data.staff as Staff;
    return current;
  },

  async me(): Promise<Staff> {
    const { data } = await api.get('/partner-auth/me');
    current = data.staff as Staff;
    return current;
  },

  async setPassword(newPassword: string): Promise<void> {
    await api.post('/partner-auth/set-password', { newPassword });
  },

  async logout(): Promise<void> {
    try {
      await api.post('/partner-auth/logout');
    } finally {
      current = null;
      tokens.clear();
    }
  },
};

// Staff auth state (partner admins + Movaia staff). Mirrors Movaia's AuthContext.
import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { partnerAuthService, Staff } from '@shared/services/partnerAuth.service';

interface AuthValue {
  staff: Staff | null;
  loading: boolean;
  login: (email: string, password: string, kind?: 'PARTNER' | 'MOVAIA') => Promise<Staff>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthValue>({
  staff: null,
  loading: true,
  login: async () => {
    throw new Error('not ready');
  },
  logout: async () => {},
  refresh: async () => {},
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [staff, setStaff] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    // The httpOnly cookie isn't readable here, so always probe /me. If the
    // access token expired, the axios layer silently refreshes; only a truly
    // signed-out user falls through to staff=null.
    try {
      setStaff(await partnerAuthService.me());
    } catch {
      setStaff(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string, kind: 'PARTNER' | 'MOVAIA' = 'PARTNER') => {
    const s = await partnerAuthService.login(email, password, kind);
    setStaff(s);
    return s;
  }, []);

  const logout = useCallback(async () => {
    await partnerAuthService.logout();
    setStaff(null);
  }, []);

  return <AuthContext.Provider value={{ staff, loading, login, logout, refresh }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);

// Route guard for staff apps. `kind` optionally restricts to one staff type.
import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@shared/contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner';

export default function ProtectedRoute({
  children,
  kind,
  loginPath,
  // The set-password route opts out so it doesn't redirect-loop into itself.
  enforcePasswordChange = true,
}: {
  children: ReactNode;
  kind?: 'PARTNER' | 'MOVAIA';
  loginPath: string;
  enforcePasswordChange?: boolean;
}) {
  const { staff, loading } = useAuth();
  if (loading) return <LoadingSpinner label="Loading…" />;
  if (!staff) return <Navigate to={loginPath} replace />;
  if (kind && staff.kind !== kind) return <Navigate to={loginPath} replace />;
  // Force the temp-password change before any dashboard is reachable, even via
  // a direct URL or page refresh.
  if (enforcePasswordChange && staff.mustChangePassword) {
    return <Navigate to="/set-password" replace />;
  }
  return <>{children}</>;
}

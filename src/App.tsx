// Top-level router. Three surfaces share one SPA:
//   /admin/*       → Movaia internal staff (partner management)
//   /partner/*     → partner admins (branding, stores, analytics)
//   /kiosk/:slug   → walk-up customer scan flow (themed by partner slug)
import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from '@shared/components/ProtectedRoute';
import LoadingSpinner from '@shared/components/LoadingSpinner';

// Auth
const StaffLogin = lazy(() => import('@apps/partner-admin/src/pages/StaffLogin'));
const SetPassword = lazy(() => import('@apps/partner-admin/src/pages/SetPassword'));

// Movaia admin
const PartnerList = lazy(() => import('@apps/movaia-admin/src/pages/PartnerList'));
const PartnerCreate = lazy(() => import('@apps/movaia-admin/src/pages/PartnerCreate'));
const PartnerDetail = lazy(() => import('@apps/movaia-admin/src/pages/PartnerDetail'));

// Partner admin
const BrandingSettings = lazy(() => import('@apps/partner-admin/src/pages/BrandingSettings'));
const StoreManagement = lazy(() => import('@apps/partner-admin/src/pages/StoreManagement'));
const AnalyticsDashboard = lazy(() => import('@apps/partner-admin/src/pages/AnalyticsDashboard'));

// Kiosk
const KioskApp = lazy(() => import('@apps/kiosk/src/pages/KioskApp'));

export default function App() {
  return (
    <Suspense fallback={<LoadingSpinner label="Loading…" />}>
      <Routes>
        <Route path="/" element={<Navigate to="/admin" replace />} />

        {/* Shared staff login (resolves PARTNER vs MOVAIA by email server-side) */}
        <Route path="/admin/login" element={<StaffLogin defaultRedirect="/admin" kind="MOVAIA" />} />
        <Route path="/partner/login" element={<StaffLogin defaultRedirect="/partner" kind="PARTNER" />} />

        {/* Forced password change — authenticated, but exempt from the password
            gate so it can't redirect-loop into itself. Works for both kinds. */}
        <Route
          path="/set-password"
          element={
            <ProtectedRoute loginPath="/partner/login" enforcePasswordChange={false}>
              <SetPassword />
            </ProtectedRoute>
          }
        />

        {/* Movaia internal staff */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute kind="MOVAIA" loginPath="/admin/login">
              <PartnerList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/partners/new"
          element={
            <ProtectedRoute kind="MOVAIA" loginPath="/admin/login">
              <PartnerCreate />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/partners/:id"
          element={
            <ProtectedRoute kind="MOVAIA" loginPath="/admin/login">
              <PartnerDetail />
            </ProtectedRoute>
          }
        />

        {/* Partner admins */}
        <Route
          path="/partner"
          element={
            <ProtectedRoute kind="PARTNER" loginPath="/partner/login">
              <AnalyticsDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/partner/branding"
          element={
            <ProtectedRoute kind="PARTNER" loginPath="/partner/login">
              <BrandingSettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/partner/stores"
          element={
            <ProtectedRoute kind="PARTNER" loginPath="/partner/login">
              <StoreManagement />
            </ProtectedRoute>
          }
        />

        {/* Public kiosk — themed by partner slug, no staff login */}
        <Route path="/kiosk/:slug/*" element={<KioskApp />} />

        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </Suspense>
  );
}

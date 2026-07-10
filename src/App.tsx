// Top-level router. Three surfaces share one SPA:
//   /admin/*       → Movaia internal staff (partner management)
//   /partner/*     → partner admins (branding, stores, analytics)
//   /kiosk/:slug   → walk-up customer scan flow (themed by partner slug)
import { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from '@shared/components/ProtectedRoute';
import LoadingSpinner from '@shared/components/LoadingSpinner';
import ErrorBoundary from '@shared/components/ErrorBoundary';
import { lazyWithRetry } from '@shared/utils/lazyWithRetry';

// Auth
const StaffLogin = lazyWithRetry(() => import('@apps/partner-admin/src/pages/StaffLogin'));
const SetPassword = lazyWithRetry(() => import('@apps/partner-admin/src/pages/SetPassword'));

// Movaia admin
const MovaiaDashboard = lazyWithRetry(() => import('@apps/movaia-admin/src/pages/MovaiaDashboard'));
const PartnerList = lazyWithRetry(() => import('@apps/movaia-admin/src/pages/PartnerList'));
const PartnerDetail = lazyWithRetry(() => import('@apps/movaia-admin/src/pages/PartnerDetail'));
const Billing = lazyWithRetry(() => import('@apps/movaia-admin/src/pages/Billing'));

// Partner admin
const BrandingSettings = lazyWithRetry(() => import('@apps/partner-admin/src/pages/BrandingSettings'));
const StoreManagement = lazyWithRetry(() => import('@apps/partner-admin/src/pages/StoreManagement'));
const AnalyticsDashboard = lazyWithRetry(() => import('@apps/partner-admin/src/pages/AnalyticsDashboard'));

// Kiosk
const KioskApp = lazyWithRetry(() => import('@apps/kiosk/src/pages/KioskApp'));

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingSpinner label="Loading…" />}>
        <Routes>
        <Route path="/" element={<Navigate to="/partner" replace />} />

        {/* One StaffLogin component, mounted twice. `kind` (from the route, not the
            email) selects the audience: it sets the chrome and is passed to the
            login call so the backend authenticates against the right staff type. */}
        <Route path="/admin/login" element={<StaffLogin defaultRedirect="/admin" kind="MOVAIA" />} />
        <Route path="/partner/login" element={<StaffLogin defaultRedirect="/partner" kind="PARTNER" />} />

        {/* Set-password page for staff still on a temporary password
            (staff.mustChangePassword). It's behind ProtectedRoute, so you must be
            signed in to reach it — but it passes enforcePasswordChange={false}.
            Every OTHER protected route redirects must-change users here; if this
            route did too, /set-password would redirect into itself forever. No
            `kind` prop, so the one page serves both Movaia and partner staff. */}
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
              <MovaiaDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/partners"
          element={
            <ProtectedRoute kind="MOVAIA" loginPath="/admin/login">
              <PartnerList />
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
        <Route
          path="/admin/billing"
          element={
            <ProtectedRoute kind="MOVAIA" loginPath="/admin/login">
              <Billing />
            </ProtectedRoute>
          }
        />

        {/* Partner surface. The dashboard is shared by PARTNER_ADMIN and
            OUTLET_ADMIN (it renders a scoped view for outlets); the management
            pages below are PARTNER_ADMIN-only. */}
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
            <ProtectedRoute kind="PARTNER" role="PARTNER_ADMIN" loginPath="/partner/login">
              <BrandingSettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/partner/stores"
          element={
            <ProtectedRoute kind="PARTNER" role="PARTNER_ADMIN" loginPath="/partner/login">
              <StoreManagement />
            </ProtectedRoute>
          }
        />

        {/* Kiosk — themed by partner slug. The walk-up customer flow is public
            (no per-customer login), but the iPad must first be bound to an outlet
            by a one-time outlet-admin device sign-in (see DeviceGate in KioskApp).
            That device auth lives inside the kiosk app, so this route sits outside
            ProtectedRoute (the staff route guard). */}
        <Route path="/kiosk/:slug/*" element={<KioskApp />} />

        {/* Unknown path → send to the partner surface (partners are the common case). */}
        <Route path="*" element={<Navigate to="/partner" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

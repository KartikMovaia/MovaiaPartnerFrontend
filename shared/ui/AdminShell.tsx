// Sidebar dashboard shell shared by the partner and Movaia admin surfaces. Both
// use the same light chrome (white sidebar, Movaia logo, green accents). `variant`
// is accepted for API compatibility but currently doesn't change the styling.
//
// Responsive: the sidebar is a persistent column on desktop (≥lg) and collapses
// into a slide-in drawer on tablet/phone, opened from a top bar hamburger. The
// drawer closes on navigation, backdrop tap, or Escape.
import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LogOut, Menu, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import i18n from '@shared/i18n';
import LanguageSwitcher from '@shared/ui/LanguageSwitcher';
import type { Staff } from '@shared/services/partnerAuth.service';

export interface NavItem {
  icon: ReactNode;
  label: string;
  to?: string;
  active?: boolean;
  onClick?: () => void;
}

export interface ShellUser {
  name: string;
  role: string;
}

export default function AdminShell({
  nav,
  user,
  onSignOut,
  children,
}: {
  variant: 'partner' | 'movaia';
  nav: NavItem[];
  user: ShellUser;
  onSignOut?: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation('common');
  const logo = '/assets/movaia-logo.png';
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close the drawer on navigation so tapping a nav row on mobile lands on the page.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // If the viewport grows to the desktop breakpoint (lg), the sidebar becomes a
  // persistent column — close the drawer so the scroll-lock below is released
  // (the mobile close affordances are hidden there).
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = (e: MediaQueryListEvent) => e.matches && setDrawerOpen(false);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // While the drawer is open, lock body scroll and allow Escape to dismiss it.
  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawerOpen(false);
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [drawerOpen]);

  return (
    <div className="flex min-h-screen flex-col lg:flex-row" style={{ background: '#fff' }}>
      {/* Mobile top bar — hidden on desktop, where the sidebar is always visible. */}
      <header
        className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 lg:hidden"
        style={{ background: '#fff', borderBottom: '1px solid #ececec' }}
      >
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label={t('actions.openMenu')}
          aria-controls="admin-sidebar"
          aria-expanded={drawerOpen}
          className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px]"
          style={{ color: '#141414' }}
        >
          <Menu size={22} />
        </button>
        <img src={logo} alt="Movaia" style={{ height: 20 }} />
      </header>

      {/* Backdrop — only rendered (and only visible) while the drawer is open on mobile. */}
      {drawerOpen && (
        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          onClick={() => setDrawerOpen(false)}
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
        />
      )}

      {/* Sidebar — static column on desktop, off-canvas drawer on mobile/tablet. */}
      <aside
        id="admin-sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex w-64 max-w-[82%] flex-none flex-col gap-1 overflow-y-auto p-4 pt-4 transition-transform duration-200 ease-out lg:static lg:z-auto lg:w-56 lg:max-w-none lg:translate-x-0 lg:pt-[22px] lg:transition-none ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ background: '#fff', borderRight: '1px solid #ececec' }}
      >
        {/* Drawer header: logo + close button (close hidden on desktop). */}
        <div className="mb-5 flex items-center justify-between">
          <img src={logo} alt="Movaia" style={{ height: 20 }} className="ml-1.5 mt-0.5" />
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label={t('actions.closeMenu')}
            className="flex h-9 w-9 items-center justify-center rounded-[10px] lg:hidden"
            style={{ color: '#9a9a9a' }}
          >
            <X size={20} />
          </button>
        </div>

        {nav.map((item, i) => {
          const body = (
            <>
              {item.active && (
                <span className="absolute bottom-2 left-0 top-2 w-[3px] rounded-sm" style={{ background: '#ABD037' }} />
              )}
              <span className="text-base leading-none">{item.icon}</span>
              <span>{item.label}</span>
            </>
          );
          const cls = 'relative flex items-center gap-[11px] rounded-[10px] px-[14px] py-[11px] text-sm';
          const style: React.CSSProperties = item.active
            ? { background: '#f2f7e3', color: '#5a7d16', fontWeight: 700 }
            : { color: '#686868', fontWeight: 500 };

          return item.to ? (
            <Link key={i} to={item.to} className={cls} style={style} onClick={() => setDrawerOpen(false)}>
              {body}
            </Link>
          ) : (
            <button
              key={i}
              onClick={() => {
                item.onClick?.();
                setDrawerOpen(false);
              }}
              className={cls}
              style={{ ...style, textAlign: 'left' }}
            >
              {body}
            </button>
          );
        })}

        {/* Language — sits directly under the nav (below Branding on the partner surface) */}
        <LanguageSwitcher variant="admin" />

        <div className="flex-1" />

        {/* User block */}
        <div className="mt-1 flex items-center gap-2.5 p-2.5" style={{ borderTop: '1px solid #f0f0f0' }}>
          <div className="flex min-w-0 flex-1 flex-col">
            <b className="truncate text-[13px]" style={{ color: '#000' }}>
              {user.name}
            </b>
            <span className="truncate text-[11px]" style={{ color: '#9a9a9a' }}>
              {user.role}
            </span>
          </div>
          {onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              title={t('actions.signOut')}
              aria-label={t('actions.signOut')}
              className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px] transition-colors"
              style={{ color: '#9a9a9a' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f2f2f2')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </aside>

      {/* Content */}
      <main
        className="flex min-w-0 flex-1 flex-col gap-5 p-4 sm:p-5 lg:p-[26px] lg:px-[30px]"
        style={{ background: '#f7f7f5' }}
      >
        {children}
      </main>
    </div>
  );
}

// Derive the sidebar user block from the real signed-in staff. The backend
// carries no person name, so we show the org/branch (partner staff) or email
// (Movaia staff) and a human-readable role label.
export function shellUserFromStaff(staff: Staff | null): ShellUser {
  if (!staff) return { name: i18n.t('common:loading'), role: '' };
  const role =
    staff.kind === 'MOVAIA'
      ? 'Movaia staff' // internal surface stays English (out of localization scope)
      : staff.role === 'OUTLET_ADMIN'
        ? i18n.t('partner:roles.outletAdmin')
        : i18n.t('partner:roles.partnerAdmin');
  const name =
    staff.kind === 'MOVAIA'
      ? staff.email
      : staff.role === 'OUTLET_ADMIN'
        ? staff.storeName || staff.partnerName || staff.email
        : staff.partnerName || staff.email;
  return { name, role };
}

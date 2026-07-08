// Sidebar dashboard shell shared by the partner and Movaia admin surfaces. Both
// use the same light chrome (white sidebar, Movaia logo, green accents). `variant`
// is accepted for API compatibility but currently doesn't change the styling.
import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { LogOut } from 'lucide-react';
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
  const logo = '/assets/movaia-logo.png';

  return (
    <div className="flex min-h-screen" style={{ background: '#fff' }}>
      {/* Sidebar */}
      <aside
        className="flex w-56 flex-none flex-col gap-1 p-4 pt-[22px]"
        style={{ background: '#fff', borderRight: '1px solid #ececec' }}
      >
        <img src={logo} alt="Movaia" style={{ height: 20 }} className="mb-5 ml-1.5 mt-0.5 self-start" />
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
            <Link key={i} to={item.to} className={cls} style={style}>
              {body}
            </Link>
          ) : (
            <button key={i} onClick={item.onClick} className={cls} style={{ ...style, textAlign: 'left' }}>
              {body}
            </button>
          );
        })}

        <div className="flex-1" />

        {/* User block */}
        <div className="mt-2.5 flex items-center gap-2.5 p-2.5" style={{ borderTop: '1px solid #f0f0f0' }}>
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
              title="Sign out"
              aria-label="Sign out"
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
      <main className="flex flex-1 flex-col gap-5 p-[26px] px-[30px]" style={{ background: '#f7f7f5' }}>
        {children}
      </main>
    </div>
  );
}

// Derive the sidebar user block from the real signed-in staff. The backend
// carries no person name, so we show the org/branch (partner staff) or email
// (Movaia staff) and a human-readable role label.
export function shellUserFromStaff(staff: Staff | null): ShellUser {
  if (!staff) return { name: 'Loading…', role: '' };
  const role =
    staff.kind === 'MOVAIA'
      ? 'Movaia staff'
      : staff.role === 'OUTLET_ADMIN'
        ? 'Outlet admin'
        : 'Partner admin';
  const name =
    staff.kind === 'MOVAIA'
      ? staff.email
      : staff.role === 'OUTLET_ADMIN'
        ? staff.storeName || staff.partnerName || staff.email
        : staff.partnerName || staff.email;
  return { name, role };
}

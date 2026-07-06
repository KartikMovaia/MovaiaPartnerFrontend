// Movaia internal — Partner detail (per-partner activity + staff actions).
// Design reference: "Movaia Gyms & Clubs.dc.html" lines 778–808.
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { LayoutGrid, Users } from 'lucide-react';
import AdminShell, { NavItem, shellUserFromStaff } from '@shared/ui/AdminShell';
import { useAuth } from '@shared/contexts/AuthContext';
import { useToast } from '@shared/ui/Toast';
import { useConfirm } from '@shared/ui/ConfirmDialog';
import StatusPill from '@shared/ui/StatusPill';
import BarList from '@shared/ui/BarList';
import LoadingSpinner from '@shared/components/LoadingSpinner';
import ErrorState from '@shared/components/ErrorState';
import { fmtDate } from '@shared/ui/format';
import { adminAnalyticsService, PartnerAnalyticsDetail } from '@shared/services/analytics.service';
import { partnerService } from '@shared/services/partner.service';
import { apiError } from '@shared/services/apiError';

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

interface PartnerAdmin {
  id: string;
  email: string;
  role: string;
  lastLoginAt: string | null;
}

export default function PartnerDetail() {
  const { id } = useParams<{ id: string }>();
  const { staff, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [detail, setDetail] = useState<PartnerAnalyticsDetail | null>(null);
  const [admins, setAdmins] = useState<PartnerAdmin[]>([]);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [acting, setActing] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    setError(false);
    adminAnalyticsService.partnerDetail(id).then(setDetail).catch(() => setError(true));
    // Partner-admin account(s) come from the management endpoint (which includes
    // partnerUsers); best-effort, so a failure here doesn't blank the page.
    partnerService
      .get(id)
      .then((p) => setAdmins((p.partnerUsers ?? []).filter((u: PartnerAdmin) => u.role === 'PARTNER_ADMIN')))
      .catch(() => setAdmins([]));
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  const saveEdit = async () => {
    const name = editName.trim();
    if (name.length < 2) {
      toast('Name must be at least 2 characters.', 'error');
      return;
    }
    setActing(true);
    try {
      await partnerService.update(id!, { name });
      toast('Partner updated.', 'success');
      setEditing(false);
      load();
    } catch (err) {
      toast(apiError(err, 'Couldn’t update the partner.'), 'error');
    } finally {
      setActing(false);
    }
  };

  const toggleStatus = async () => {
    const suspend = detail!.partner.status === 'ACTIVE';
    setActing(true);
    try {
      if (suspend) await partnerService.suspend(id!);
      else await partnerService.reactivate(id!);
      toast(suspend ? 'Partner suspended.' : 'Partner reactivated.', 'success');
      load();
    } catch (err) {
      toast(apiError(err, 'Couldn’t update status.'), 'error');
    } finally {
      setActing(false);
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: `Delete ${detail!.partner.name}?`,
      message:
        'This permanently removes the partner. Partners with branches or scan history can’t be deleted — suspend them instead.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await partnerService.remove(id!);
      toast('Partner deleted.', 'success');
      navigate('/admin/partners');
    } catch (err) {
      toast(apiError(err, 'Couldn’t delete this partner.'), 'error');
    }
  };

  const nav: NavItem[] = [
    { icon: <LayoutGrid size={16} />, label: 'Dashboard', to: '/admin' },
    { icon: <Users size={16} />, label: 'Partners', to: '/admin/partners', active: true },
  ];

  return (
    <AdminShell variant="movaia" nav={nav} user={shellUserFromStaff(staff)} onSignOut={logout}>
      {error ? (
        <ErrorState message="Couldn’t load this partner." onRetry={load} />
      ) : !detail ? (
        <LoadingSpinner label="Loading partner…" />
      ) : (
        <div className="mx-auto flex w-full max-w-[960px] flex-col gap-[18px]">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-xs text-[#9a9a9a]">
            <Link to="/admin/partners" className="text-[#686868] hover:underline">
              Partners
            </Link>
            <span>/</span>
            <span className="font-semibold text-[#141414]">{detail.partner.name}</span>
          </div>

          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <span
                className="flex h-[52px] w-[52px] items-center justify-center rounded-[13px] text-lg font-extrabold text-white"
                style={{ background: '#141414' }}
              >
                {initialsOf(detail.partner.name)}
              </span>
              <div>
                {editing ? (
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      aria-label="Partner name"
                      autoFocus
                      className="h-9 rounded-[9px] border-2 border-[#ABD037] px-2.5 text-[18px] font-extrabold outline-none"
                    />
                    <button
                      type="button"
                      onClick={saveEdit}
                      disabled={acting}
                      className="h-9 rounded-[9px] px-3.5 text-[13px] font-bold text-white disabled:opacity-60"
                      style={{ background: '#141414' }}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(false)}
                      className="h-9 rounded-[9px] border border-[#e4e4e4] px-3.5 text-[13px] font-semibold"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <h1 className="mb-1 text-[22px] font-extrabold tracking-[-.4px]">{detail.partner.name}</h1>
                )}
                <div className="mb-1.5 font-mono text-[12px] text-[#9a9a9a]">{detail.partner.slug}</div>
                <StatusPill
                  status={detail.partner.status}
                  label={`${titleCase(detail.partner.status)} · since ${fmtDate(detail.partner.createdAt)}`}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {!editing && (
                <button
                  type="button"
                  onClick={() => {
                    setEditName(detail.partner.name);
                    setEditing(true);
                  }}
                  className="h-10 rounded-[10px] border border-[#e4e4e4] bg-white px-[18px] text-[13px] font-semibold"
                >
                  Edit
                </button>
              )}
              <button
                type="button"
                onClick={toggleStatus}
                disabled={acting}
                className="h-10 rounded-[10px] border border-[#e4e4e4] bg-white px-[18px] text-[13px] font-semibold disabled:opacity-60"
              >
                {detail.partner.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
              </button>
              <button
                type="button"
                onClick={remove}
                className="h-10 rounded-[10px] px-[18px] text-[13px] font-semibold text-white"
                style={{ background: '#c5352b' }}
              >
                Delete
              </button>
            </div>
          </div>

          {/* Partner admin account(s) */}
          <div className="flex flex-col gap-3 rounded-[14px] border border-[#ececec] bg-white p-[18px]">
            <b className="text-sm">Partner admin{admins.length > 1 ? 's' : ''}</b>
            {admins.length === 0 ? (
              <span className="text-[13px] text-[#9a9a9a]">No partner admin provisioned yet.</span>
            ) : (
              <div className="flex flex-col gap-2.5">
                {admins.map((a) => (
                  <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                    <span className="min-w-0 truncate font-semibold text-[#141414]">{a.email}</span>
                    <span className="flex-none text-[12px] text-[#9a9a9a]">
                      {a.lastLoginAt ? `Last seen ${fmtDate(a.lastLoginAt)}` : 'Never signed in'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Branches + recent scans */}
          <div className="grid grid-cols-1 gap-[18px] md:grid-cols-2">
            <div className="flex flex-col gap-3 rounded-[14px] border border-[#ececec] bg-white p-[18px]">
              <b className="text-sm">Branches — analyses per branch</b>
              <BarList items={detail.byStore.map((s) => ({ label: s.storeName, value: s.scans }))} />
              {detail.byStore.length === 0 && (
                <span className="text-[13px] text-[#9a9a9a]">No branch activity yet.</span>
              )}
            </div>

            <div className="flex flex-col overflow-hidden rounded-[14px] border border-[#ececec] bg-white">
              <div className="border-b border-[#f0f0f0] px-[18px] py-3.5">
                <b className="text-sm">Recent scans</b>
              </div>
              {detail.recentScans.map((s, i) => (
                <div
                  key={s.id}
                  className={`grid grid-cols-[.9fr_1.4fr_1fr] items-center px-[18px] py-3 text-[12.5px] ${
                    i < detail.recentScans.length - 1 ? 'border-b border-[#f5f5f5]' : ''
                  }`}
                >
                  <span className="text-[#686868]">{fmtDate(s.createdAt)}</span>
                  <span className="min-w-0 truncate">{s.customerEmail ?? '—'}</span>
                  <span>
                    <StatusPill status={s.status} size="sm" />
                  </span>
                </div>
              ))}
              {detail.recentScans.length === 0 && (
                <div className="px-[18px] py-6 text-[13px] text-[#9a9a9a]">No scans yet.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

// Branches — manage outlets and their outlet admins in one place (design 600–616,
// merged with the former Outlet-admins page). Adding a branch also provisions its
// outlet admin (first name, last name, email); an existing unassigned branch can
// be assigned inline. Each row toggles active/paused live via the mock service.
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutGrid, Store, Palette, ScrollText } from 'lucide-react';
import AdminShell, { NavItem, shellUserFromStaff } from '@shared/ui/AdminShell';
import { useAuth } from '@shared/contexts/AuthContext';
import { useToast } from '@shared/ui/Toast';
import { useConfirm } from '@shared/ui/ConfirmDialog';
import StatusPill from '@shared/ui/StatusPill';
import Toggle from '@shared/ui/Toggle';
import ErrorState from '@shared/components/ErrorState';
import { fmtNum } from '@shared/ui/format';
import { storeService, type Store as Branch } from '@shared/services/partner.service';
import { apiError } from '@shared/services/apiError';

const COLS = '1.4fr 1.6fr 1fr .8fr .6fr';
const emptyBranch = { name: '', location: '', firstName: '', lastName: '', email: '' };
const emptyAdmin = { firstName: '', lastName: '', email: '' };
const fieldCls = 'h-[42px] rounded-[9px] px-3.5 text-sm outline-none';

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  accent = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  accent?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold" style={{ color: '#686868' }}>
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className={fieldCls}
        style={{ border: `1px solid ${accent ? '#ABD037' : '#e4e4e4'}` }}
      />
    </label>
  );
}

export default function StoreManagement() {
  const { t } = useTranslation('partner');
  const { staff, logout } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const NAV: NavItem[] = [
    { icon: <LayoutGrid size={16} />, label: t('nav.dashboard'), to: '/partner' },
    { icon: <ScrollText size={16} />, label: t('nav.scans'), to: '/partner/scans' },
    { icon: <Store size={16} />, label: t('nav.branches'), to: '/partner/stores', active: true },
    { icon: <Palette size={16} />, label: t('nav.branding'), to: '/partner/branding' },
  ];
  const [stores, setStores] = useState<Branch[] | null>(null);
  const [error, setError] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyBranch);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [assignForm, setAssignForm] = useState(emptyAdmin);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', location: '' });
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError(false);
    storeService.list().then(setStores).catch(() => setError(true));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (s: Branch, next: boolean) => {
    setStores((cur) => cur?.map((x) => (x.id === s.id ? { ...x, isActive: next } : x)) ?? cur);
    try {
      await storeService.update(s.id, { isActive: next });
    } catch (err) {
      setStores((cur) => cur?.map((x) => (x.id === s.id ? { ...x, isActive: !next } : x)) ?? cur);
      toast(apiError(err, t('stores.toasts.toggleError')), 'error');
    }
  };

  const addBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || busy) return;
    setBusy(true);
    try {
      const created = await storeService.create({ name: form.name.trim(), location: form.location.trim() || undefined });
      const admin = { email: form.email.trim(), firstName: form.firstName.trim(), lastName: form.lastName.trim() };
      const { tempPassword } = await storeService.provisionOutletAdmin({ storeId: created.id, ...admin });
      toast(t('stores.toasts.added', { store: created.name, email: admin.email }), 'success');
      setNotice(t('stores.toasts.tempPassword', { email: admin.email, password: tempPassword }));
      setForm(emptyBranch);
      setAdding(false);
      load();
    } catch (err) {
      toast(apiError(err, t('stores.toasts.addError')), 'error');
    } finally {
      setBusy(false);
    }
  };

  const openAssign = (id: string) => {
    setAssigningId(id);
    setAssignForm(emptyAdmin);
    setAdding(false);
    setEditingId(null);
  };

  const assignAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningId || !assignForm.email.trim() || busy) return;
    setBusy(true);
    try {
      const admin = { email: assignForm.email.trim(), firstName: assignForm.firstName.trim(), lastName: assignForm.lastName.trim() };
      const { tempPassword } = await storeService.provisionOutletAdmin({ storeId: assigningId, ...admin });
      toast(t('stores.toasts.adminInvited', { email: admin.email }), 'success');
      setNotice(t('stores.toasts.tempPassword', { email: admin.email, password: tempPassword }));
      setAssigningId(null);
      load();
    } catch (err) {
      toast(apiError(err, t('stores.toasts.provisionError')), 'error');
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (s: Branch) => {
    setEditingId(s.id);
    setEditForm({ name: s.name, location: s.location ?? '' });
    setAdding(false);
    setAssigningId(null);
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !editForm.name.trim() || busy) return;
    setBusy(true);
    try {
      await storeService.update(editingId, { name: editForm.name.trim(), location: editForm.location.trim() });
      toast(t('stores.toasts.branchUpdated'), 'success');
      setEditingId(null);
      load();
    } catch (err) {
      toast(apiError(err, t('stores.toasts.updateError')), 'error');
    } finally {
      setBusy(false);
    }
  };

  const resendInvite = async (admin: NonNullable<Branch['outletAdmin']>) => {
    try {
      await storeService.resendOutletInvite(admin.id);
      toast(t('stores.toasts.inviteResent', { email: admin.email }), 'success');
    } catch (err) {
      toast(apiError(err, t('stores.toasts.resendError')), 'error');
    }
  };

  const resetAdmin = async (admin: NonNullable<Branch['outletAdmin']>) => {
    const ok = await confirm({
      title: t('stores.confirm.resetTitle', { email: admin.email }),
      message: t('stores.confirm.resetMessage'),
      confirmLabel: t('stores.confirm.resetConfirm'),
    });
    if (!ok) return;
    try {
      const { tempPassword } = await storeService.resetOutletAdmin(admin.id);
      toast(t('stores.toasts.passwordReset', { email: admin.email }), 'success');
      setNotice(t('stores.toasts.resetTempPassword', { email: admin.email, password: tempPassword }));
    } catch (err) {
      toast(apiError(err, t('stores.toasts.resetError')), 'error');
    }
  };

  const removeAdmin = async (s: Branch) => {
    const admin = s.outletAdmin;
    if (!admin) return;
    const ok = await confirm({
      title: t('stores.confirm.removeTitle', { email: admin.email }),
      message: t('stores.confirm.removeMessage', { store: s.name }),
      confirmLabel: t('stores.confirm.removeConfirm'),
      danger: true,
    });
    if (!ok) return;
    try {
      await storeService.removeOutletAdmin(admin.id);
      toast(t('stores.toasts.adminRemoved'), 'success');
      load();
    } catch (err) {
      toast(apiError(err, t('stores.toasts.removeError')), 'error');
    }
  };

  const total = stores?.length ?? 0;
  const active = stores?.filter((s) => s.isActive).length ?? 0;
  const assignBranch = stores?.find((s) => s.id === assigningId)?.name;

  return (
    <AdminShell variant="partner" nav={NAV} user={shellUserFromStaff(staff)} onSignOut={logout}>
      {error ? (
        <ErrorState message={t('stores.loadError')} onRetry={load} />
      ) : (
        <>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="mb-1 text-[22px] font-extrabold tracking-[-.4px]">{t('stores.title')}</h1>
          <p className="text-[13px]" style={{ color: '#686868' }}>
            {t('stores.summary', { total, active })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setAdding((v) => !v);
            setAssigningId(null);
          }}
          className="h-[42px] rounded-[10px] px-5 text-sm font-bold"
          style={{ background: '#ABD037', color: '#1c2b00' }}
        >
          {t('stores.addBranch')}
        </button>
      </div>

      {/* Invite / temp-password note */}
      {notice && (
        <div
          className="rounded-[10px] px-4 py-3 text-[13px]"
          style={{ background: '#eef6dd', color: '#5a7d16', border: '1px solid #cfd6bd' }}
        >
          {notice}
        </div>
      )}

      {/* Add branch (+ its outlet admin) */}
      {adding && (
        <form
          onSubmit={addBranch}
          className="flex flex-col gap-3.5 rounded-[14px] p-[18px]"
          style={{ background: '#fff', border: '1px solid #ececec' }}
        >
          <b className="text-[15px]">{t('stores.newBranch')}</b>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t('stores.branchName')} value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
            <Field label={t('stores.location')} value={form.location} onChange={(v) => setForm({ ...form, location: v })} />
          </div>
          <div className="mt-1 text-[11px] font-bold uppercase tracking-[.5px]" style={{ color: '#9a9a9a' }}>
            {t('stores.outletAdmin')}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label={t('stores.firstName')} value={form.firstName} onChange={(v) => setForm({ ...form, firstName: v })} required />
            <Field label={t('stores.lastName')} value={form.lastName} onChange={(v) => setForm({ ...form, lastName: v })} required />
            <Field label={t('stores.workEmail')} type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required accent />
          </div>
          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setForm(emptyBranch);
              }}
              className="h-10 rounded-[10px] px-4 text-[13px] font-semibold"
              style={{ color: '#686868', border: '1px solid #e4e4e4' }}
            >
              {t('stores.cancel')}
            </button>
            <button
              type="submit"
              disabled={busy}
              className="h-10 rounded-[10px] px-5 text-[13px] font-bold disabled:opacity-60"
              style={{ background: '#141414', color: '#fff' }}
            >
              {busy ? t('stores.adding') : t('stores.addBranchInvite')}
            </button>
          </div>
        </form>
      )}

      {/* Assign an admin to an existing branch */}
      {assigningId && (
        <form
          onSubmit={assignAdmin}
          className="flex flex-col gap-3.5 rounded-[14px] p-[18px]"
          style={{ background: '#fff', border: '1px solid #ececec' }}
        >
          <b className="text-[15px]">{assignBranch ? t('stores.assignTitleNamed', { store: assignBranch }) : t('stores.assignTitle')}</b>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label={t('stores.firstName')} value={assignForm.firstName} onChange={(v) => setAssignForm({ ...assignForm, firstName: v })} required />
            <Field label={t('stores.lastName')} value={assignForm.lastName} onChange={(v) => setAssignForm({ ...assignForm, lastName: v })} required />
            <Field label={t('stores.workEmail')} type="email" value={assignForm.email} onChange={(v) => setAssignForm({ ...assignForm, email: v })} required accent />
          </div>
          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setAssigningId(null)}
              className="h-10 rounded-[10px] px-4 text-[13px] font-semibold"
              style={{ color: '#686868', border: '1px solid #e4e4e4' }}
            >
              {t('stores.cancel')}
            </button>
            <button
              type="submit"
              disabled={busy}
              className="h-10 rounded-[10px] px-5 text-[13px] font-bold disabled:opacity-60"
              style={{ background: '#141414', color: '#fff' }}
            >
              {busy ? t('stores.provisioning') : t('stores.provisionAdmin')}
            </button>
          </div>
        </form>
      )}

      {/* Edit branch */}
      {editingId && (
        <form
          onSubmit={saveEdit}
          className="flex flex-col gap-3.5 rounded-[14px] p-[18px]"
          style={{ background: '#fff', border: '1px solid #ececec' }}
        >
          <b className="text-[15px]">{t('stores.editBranch')}</b>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t('stores.branchName')} value={editForm.name} onChange={(v) => setEditForm({ ...editForm, name: v })} required />
            <Field label={t('stores.location')} value={editForm.location} onChange={(v) => setEditForm({ ...editForm, location: v })} />
          </div>
          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="h-10 rounded-[10px] px-4 text-[13px] font-semibold"
              style={{ color: '#686868', border: '1px solid #e4e4e4' }}
            >
              {t('stores.cancel')}
            </button>
            <button
              type="submit"
              disabled={busy}
              className="h-10 rounded-[10px] px-5 text-[13px] font-bold disabled:opacity-60"
              style={{ background: '#141414', color: '#fff' }}
            >
              {busy ? t('stores.saving') : t('stores.saveBranch')}
            </button>
          </div>
        </form>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-[14px]" style={{ background: '#fff', border: '1px solid #ececec' }}>
        <div className="overflow-x-auto">
          <div style={{ minWidth: 640 }}>
            <div
              className="grid px-5 py-[11px] text-[11px] font-bold uppercase tracking-[.5px]"
              style={{ gridTemplateColumns: COLS, color: '#9a9a9a', background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}
            >
              <span>{t('stores.table.branch')}</span>
              <span>{t('stores.table.outletAdmin')}</span>
              <span>{t('stores.table.scans')}</span>
              <span>{t('stores.table.status')}</span>
              <span />
            </div>

            {stores === null && (
              <div className="px-5 py-6 text-[13px]" style={{ color: '#9a9a9a' }}>
                {t('stores.loading')}
              </div>
            )}

            {stores?.map((s, i) => (
              <div
                key={s.id}
                className="grid items-center px-5 py-[15px] text-[13px]"
                style={{
                  gridTemplateColumns: COLS,
                  borderBottom: i === stores.length - 1 ? 'none' : '1px solid #f5f5f5',
                  opacity: s.isActive ? 1 : 0.6,
                }}
              >
                <span className="flex flex-col items-start gap-0.5">
                  <b>{s.name}</b>
                  <button
                    type="button"
                    onClick={() => openEdit(s)}
                    className="text-[11px] font-semibold"
                    style={{ color: '#7a9e1f' }}
                  >
                    {t('stores.edit')}
                  </button>
                </span>
                <span>
                  {s.outletAdmin ? (
                    <span className="flex flex-col gap-0.5">
                      <span className="min-w-0 truncate" style={{ color: '#686868' }}>
                        {s.outletAdmin.email}
                      </span>
                      <span className="flex flex-wrap gap-2.5 text-[11px] font-semibold">
                        <button type="button" onClick={() => resendInvite(s.outletAdmin!)} style={{ color: '#7a9e1f' }}>
                          {t('stores.resend')}
                        </button>
                        <button type="button" onClick={() => resetAdmin(s.outletAdmin!)} style={{ color: '#7a9e1f' }}>
                          {t('stores.reset')}
                        </button>
                        <button type="button" onClick={() => removeAdmin(s)} style={{ color: '#b23a34' }}>
                          {t('stores.remove')}
                        </button>
                      </span>
                    </span>
                  ) : (
                    <span className="italic" style={{ color: '#9a9a9a' }}>
                      {t('stores.unassigned')} ·{' '}
                      <button
                        type="button"
                        onClick={() => openAssign(s.id)}
                        className="font-semibold not-italic"
                        style={{ color: '#7a9e1f' }}
                      >
                        {t('stores.assign')}
                      </button>
                    </span>
                  )}
                </span>
                <span>{fmtNum(s.scans)}</span>
                <span>
                  <StatusPill status={s.isActive ? 'ACTIVE' : 'PAUSED'} />
                </span>
                <span className="flex justify-end">
                  <Toggle on={s.isActive} onChange={(next) => toggle(s, next)} aria-label={t('stores.toggleAria', { store: s.name })} />
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
        </>
      )}
    </AdminShell>
  );
}

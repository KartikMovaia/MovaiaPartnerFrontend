// Movaia internal — Manage partners (add / remove).
// Design reference: "Movaia Gyms & Clubs.dc.html" lines 810–831.
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutGrid, Users } from 'lucide-react';
import AdminShell, { NavItem, shellUserFromStaff } from '@shared/ui/AdminShell';
import { useAuth } from '@shared/contexts/AuthContext';
import { useToast } from '@shared/ui/Toast';
import { useConfirm } from '@shared/ui/ConfirmDialog';
import StatusPill from '@shared/ui/StatusPill';
import LoadingSpinner from '@shared/components/LoadingSpinner';
import ErrorState from '@shared/components/ErrorState';
import { fmtNum } from '@shared/ui/format';
import { partnerService } from '@shared/services/partner.service';
import { apiError } from '@shared/services/apiError';
import { PartnerRow } from '@shared/services/analytics.service';

const slugify = (s: string) =>
  s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export default function PartnerList() {
  const navigate = useNavigate();
  const { staff, logout } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [partners, setPartners] = useState<PartnerRow[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError(false);
    partnerService.list().then(setPartners).catch(() => setError(true));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const nav: NavItem[] = [
    { icon: <LayoutGrid size={16} />, label: 'Dashboard', to: '/admin' },
    { icon: <Users size={16} />, label: 'Partners', to: '/admin/partners', active: true },
  ];

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const partnerName = name.trim();
    const inviteEmail = email.trim();
    if (!partnerName || busy) return;
    if (inviteEmail && (!firstName.trim() || !lastName.trim())) {
      toast('Add the admin’s first and last name to send an invite.', 'error');
      return;
    }
    setBusy(true);
    try {
      const created = await partnerService.create({ name: partnerName, slug: slugify(partnerName) });
      setPartners((prev) => [created, ...(prev ?? [])]);
      if (inviteEmail) {
        const { tempPassword } = await partnerService.provisionAdmin({
          partnerId: created.id,
          email: inviteEmail,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        });
        toast(`${created.name} created — invite sent to ${inviteEmail}.`, 'success');
        setNotice(`If the invite email doesn’t arrive, share this one-time temp password with ${inviteEmail}: ${tempPassword}`);
      } else {
        toast(`${created.name} created.`, 'success');
        setNotice(null);
      }
      setName('');
      setFirstName('');
      setLastName('');
      setEmail('');
      setShowForm(false);
    } catch (err) {
      toast(apiError(err, 'Couldn’t create the partner.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (p: PartnerRow) => {
    const ok = await confirm({
      title: `Delete ${p.name}?`,
      message:
        'This permanently removes the partner. Partners with branches or scan history can’t be deleted — suspend them instead.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await partnerService.remove(p.id);
      setPartners((prev) => (prev ?? []).filter((x) => x.id !== p.id));
      toast(`${p.name} deleted.`, 'success');
    } catch (err) {
      toast(apiError(err, 'Couldn’t delete this partner.'), 'error');
    }
  };

  const cancel = () => {
    setShowForm(false);
    setName('');
    setFirstName('');
    setLastName('');
    setEmail('');
  };

  return (
    <AdminShell variant="movaia" nav={nav} user={shellUserFromStaff(staff)} onSignOut={logout}>
      {error ? (
        <ErrorState message="Couldn’t load partners." onRetry={load} />
      ) : !partners ? (
        <LoadingSpinner label="Loading partners…" />
      ) : (
        <div className="mx-auto flex w-full max-w-[900px] flex-col gap-[18px]">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="mb-1 text-[22px] font-extrabold tracking-[-.4px]">Partners</h1>
              <p className="text-[13px] text-[#686868]">{partners.length} total</p>
            </div>
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="h-[42px] rounded-[10px] px-5 text-sm font-bold"
              style={{ background: '#ABD037', color: '#1c2b00' }}
            >
              + Add partner
            </button>
          </div>

          {/* Invite / temp-password note */}
          {notice && (
            <div className="rounded-[10px] border border-[#cfd6bd] bg-[#f6f9ec] px-4 py-3 text-[13px] text-[#5a7d16]">
              {notice}
            </div>
          )}

          {/* Add partner inline form */}
          {showForm && (
            <form
              onSubmit={create}
              className="flex flex-col gap-3.5 rounded-[14px] border border-dashed border-[#cfd6bd] bg-white p-[18px]"
            >
              <b className="text-sm">New partner</b>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Partner name"
                aria-label="Partner name"
                className="h-11 rounded-[10px] border-2 border-[#e4e4e4] px-3.5 text-sm outline-none focus:border-[#ABD037]"
              />
              <div className="text-[11px] font-bold uppercase tracking-[.5px]" style={{ color: '#9a9a9a' }}>
                Partner admin — optional; invited by email
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  aria-label="Admin first name"
                  className="h-11 rounded-[10px] border-2 border-[#e4e4e4] px-3.5 text-sm outline-none focus:border-[#ABD037]"
                />
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  aria-label="Admin last name"
                  className="h-11 rounded-[10px] border-2 border-[#e4e4e4] px-3.5 text-sm outline-none focus:border-[#ABD037]"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Admin email"
                  aria-label="Admin email"
                  className="h-11 rounded-[10px] border-2 border-[#ABD037] px-3.5 text-sm outline-none"
                />
              </div>
              <div className="flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={cancel}
                  className="h-10 rounded-[10px] border border-[#e4e4e4] bg-white px-4 text-[13px] font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy || !name.trim()}
                  className="h-10 rounded-[10px] bg-[#141414] px-5 text-[13px] font-semibold text-white disabled:opacity-50"
                >
                  {busy ? 'Creating…' : 'Create & invite'}
                </button>
              </div>
            </form>
          )}

          {/* Partners table */}
          <div className="overflow-hidden rounded-[14px] border border-[#ececec] bg-white">
            <div className="grid grid-cols-[1.6fr_1fr_1fr_.6fr] border-b border-[#f0f0f0] bg-[#fafafa] px-5 py-[11px] text-[11px] font-bold uppercase tracking-[.5px] text-[#9a9a9a]">
              <span>Partner</span>
              <span>Outlets</span>
              <span>Status</span>
              <span />
            </div>
            {partners.map((p, i) => (
              <div
                key={p.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/admin/partners/${p.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/admin/partners/${p.id}`);
                  }
                }}
                className={`grid cursor-pointer grid-cols-[1.6fr_1fr_1fr_.6fr] items-center px-5 py-3.5 text-[13px] outline-none transition-colors hover:bg-[#fafafa] focus-visible:bg-[#fafafa] ${
                  i < partners.length - 1 ? 'border-b border-[#f5f5f5]' : ''
                }`}
              >
                <div className="flex min-w-0 flex-col">
                  <b className="truncate">{p.name}</b>
                  <span className="truncate font-mono text-[11px] text-[#9a9a9a]">{p.slug}</span>
                </div>
                <span>{fmtNum(p.storeCount)}</span>
                <span>
                  <StatusPill status={p.status} />
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(p);
                  }}
                  className="text-right text-xs font-semibold text-[#b23a34]"
                >
                  Remove
                </button>
              </div>
            ))}
            {partners.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-[#9a9a9a]">No partners yet.</div>
            )}
          </div>
        </div>
      )}
    </AdminShell>
  );
}

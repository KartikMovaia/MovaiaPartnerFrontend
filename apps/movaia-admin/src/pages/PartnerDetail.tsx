import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { partnerService } from '@shared/services/partner.service';
import LoadingSpinner from '@shared/components/LoadingSpinner';

export default function PartnerDetail() {
  const { id } = useParams();
  const [partner, setPartner] = useState<any | null>(null);
  const [invite, setInvite] = useState({ email: '', firstName: '', lastName: '' });
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  useEffect(() => {
    if (id) partnerService.get(id).then(setPartner);
  }, [id]);

  const provision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    const res = await partnerService.provisionAdmin({ partnerId: id, ...invite });
    // Shown once so staff can relay credentials if the invite email bounces.
    setTempPassword(res.tempPassword);
    partnerService.get(id).then(setPartner);
  };

  if (!partner) return <LoadingSpinner />;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-bold text-neutral-900">{partner.name}</h1>
      <p className="mb-8 text-sm text-neutral-600">/kiosk/{partner.slug}</p>

      <section className="mb-8 rounded-2xl border border-neutral-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-neutral-900">Provision partner admin</h2>
        <form onSubmit={provision} className="grid grid-cols-2 gap-3">
          <input
            placeholder="First name"
            value={invite.firstName}
            onChange={(e) => setInvite({ ...invite, firstName: e.target.value })}
            required
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900"
          />
          <input
            placeholder="Last name"
            value={invite.lastName}
            onChange={(e) => setInvite({ ...invite, lastName: e.target.value })}
            required
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900"
          />
          <input
            type="email"
            placeholder="Email"
            value={invite.email}
            onChange={(e) => setInvite({ ...invite, email: e.target.value })}
            required
            className="col-span-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900"
          />
          <button
            className="col-span-2 rounded-lg py-2.5 font-semibold"
            style={{ background: 'var(--brand-primary)', color: 'var(--brand-on-primary)' }}
          >
            Create admin & send invite
          </button>
        </form>
        {tempPassword && (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Temp password (shown once): <code className="font-mono">{tempPassword}</code>
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-neutral-900">Admins</h2>
        <ul className="space-y-2 text-sm text-neutral-700">
          {(partner.partnerUsers || []).map((u: any) => (
            <li key={u.id} className="flex justify-between">
              <span>{u.email}</span>
              <span className="text-neutral-500">{u.lastLoginAt ? 'active' : 'never logged in'}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

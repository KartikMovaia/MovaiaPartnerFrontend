// Kiosk — the walk-up scan flow. Uses the device-token client (kioskApi); the
// device token is stored/cleared here. Store/partner scope is server-side (from
// the device), so these calls send no storeId.
import axios from 'axios';
import { kioskApi, deviceToken } from './api.service';

export interface IdentifyResult {
  scanId: string;
  analysisId: string;
  uploadUrl: string;
  key: string;
  isReturning: boolean;
  customer: { firstName: string; email: string };
}

export interface DeviceBinding {
  storeId: string;
  storeName: string | null;
  partnerSlug: string;
  partnerName: string;
}

export const kioskService = {
  // ── Device binding (one-time per iPad) ──────────────────────────────────
  async deviceLogin(email: string, password: string): Promise<DeviceBinding> {
    // kioskApi attaches the current device token (if any) so the backend can
    // revoke a prior binding for a clean switch.
    const { data } = await kioskApi.post('/kiosk/device/login', { email, password });
    deviceToken.set(data.deviceToken);
    return data.binding as DeviceBinding;
  },
  async deviceMe(): Promise<DeviceBinding> {
    const { data } = await kioskApi.get('/kiosk/device/me');
    return data.binding as DeviceBinding;
  },
  // Password-gated unbind: an outlet admin of this device's branch. Only clears
  // the local token on success (a wrong password leaves the iPad bound).
  async deviceLogout(email: string, password: string): Promise<void> {
    await kioskApi.post('/kiosk/device/logout', { email, password });
    deviceToken.clear();
  },

  // ── Walk-up flow ────────────────────────────────────────────────────────
  async startSession(): Promise<{ kioskSessionId: string; expiresAt: string }> {
    const { data } = await kioskApi.post('/kiosk/sessions');
    return data;
  },

  async identify(input: {
    kioskSessionId: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    heightCm?: number;
    weightKg?: number;
    consent: true;
  }): Promise<IdentifyResult> {
    const { data } = await kioskApi.post('/kiosk/identify', input);
    return data as IdentifyResult;
  },

  // Direct presigned PUT to storage (plain axios — no auth headers on the
  // cross-origin PUT). Dev stub: the backend returns a placeholder URL no bucket
  // accepts, so skip the real PUT for stub URLs and let the flow complete.
  // VITE_KIOSK_STUB_UPLOAD=1 additionally skips the PUT for a REAL (e.g. Movaia)
  // presigned URL — for recording a marketing walk-through locally without AWS/S3.
  // Never set in a production build; prod (Vercel) leaves it unset.
  async uploadVideo(uploadUrl: string, blob: Blob, onProgress?: (pct: number) => void): Promise<void> {
    const stub = uploadUrl.includes('X-Amz-Stub-Presigned') || import.meta.env.VITE_KIOSK_STUB_UPLOAD === '1';
    if (stub) {
      // Ramp progress so the on-screen ring animates on camera, then resolve.
      for (let p = 0; p <= 100; p += 10) {
        onProgress?.(p);
        await new Promise((r) => setTimeout(r, 80));
      }
      return;
    }
    await axios.put(uploadUrl, blob, {
      // Kiosk clips are always MP4 (pickMime records MP4-only; the presigned
      // URL is minted for scan.mp4) — the fallback matches that contract.
      headers: { 'Content-Type': blob.type || 'video/mp4' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
      },
    });
  },

  async submit(scanId: string): Promise<{ status: string }> {
    const { data } = await kioskApi.post('/kiosk/submit', { scanId });
    return data as { status: string };
  },
};

// Kiosk — real API. The iPad is bound to one outlet via a device token (auth
// only); the walk-up flow then creates a session, identifies the customer, and
// uploads the recording straight to Movaia's S3 via a presigned URL.
import axios from 'axios';
import { api } from './api.service';

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
    const { data } = await api.post('/kiosk/device/login', { email, password });
    return data as DeviceBinding;
  },
  async deviceMe(): Promise<DeviceBinding> {
    const { data } = await api.get('/kiosk/device/me');
    return data as DeviceBinding;
  },
  async deviceLogout(): Promise<void> {
    await api.post('/kiosk/device/logout');
  },

  // ── Walk-up flow ────────────────────────────────────────────────────────
  // The session's store comes from the device token — no storeId is sent.
  async startSession(): Promise<{ kioskSessionId: string; expiresAt: string }> {
    const { data } = await api.post('/kiosk/sessions');
    return data;
  },

  async identify(input: {
    kioskSessionId: string;
    firstName: string;
    lastName: string;
    email: string; // required — the report delivery channel
    phone?: string;
    consent: true;
  }): Promise<IdentifyResult> {
    const { data } = await api.post('/kiosk/identify', input);
    return data as IdentifyResult;
  },

  // Direct presigned PUT to Movaia's S3 — a plain axios call (NOT the api
  // instance) so no cookies/CSRF headers are attached to the cross-origin PUT.
  async uploadVideo(uploadUrl: string, blob: Blob, onProgress?: (pct: number) => void): Promise<void> {
    await axios.put(uploadUrl, blob, {
      headers: { 'Content-Type': blob.type || 'video/webm' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
      },
    });
  },

  async submit(scanId: string): Promise<{ status: string }> {
    const { data } = await api.post('/kiosk/submit', { scanId });
    return data;
  },
};

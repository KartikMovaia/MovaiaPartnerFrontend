import { api } from './api.service';

export interface IdentifyResult {
  scanId: string;
  analysisId: string;
  uploadUrl: string;
  key: string;
}

export const kioskService = {
  async startSession(storeId: string): Promise<{ kioskSessionId: string; expiresAt: string }> {
    const { data } = await api.post('/kiosk/sessions', { storeId });
    return data;
  },

  async identify(input: {
    kioskSessionId: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    consent: true;
  }): Promise<IdentifyResult> {
    const { data } = await api.post('/kiosk/identify', input);
    return data;
  },

  // Uploads the recorded blob directly to Movaia's S3 via the presigned URL.
  async uploadVideo(uploadUrl: string, blob: Blob): Promise<void> {
    await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': blob.type || 'video/webm' },
      body: blob,
    });
  },

  async submit(scanId: string): Promise<{ status: string }> {
    const { data } = await api.post('/kiosk/submit', { scanId });
    return data;
  },
};

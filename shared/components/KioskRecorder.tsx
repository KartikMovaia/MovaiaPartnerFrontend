// Timed side-view recorder for the kiosk. Flow:
//   press Start → SETUP_SECONDS countdown (time to get on the treadmill) →
//   beep ×1 → record RECORD_SECONDS → beep ×2 → stop.
// Calls onComplete(blob) with the captured clip. Adapted from Movaia's
// CameraRecorderModal (MediaRecorder capture).
import { useEffect, useRef, useState, useCallback } from 'react';
import { Video } from 'lucide-react';
import { beeps } from './cues';

const SETUP_SECONDS = 20; // time to set up on the treadmill before recording
const RECORD_SECONDS = 10; // length of the recorded clip

type Phase = 'idle' | 'setup' | 'recording' | 'done';

export default function KioskRecorder({ onComplete }: { onComplete: (blob: Blob) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Acquire the camera once and show a live preview.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        setError('Camera access is required. Please allow camera permissions.');
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const stopRecording = useCallback(() => {
    beeps(2);
    recorderRef.current?.stop();
  }, []);

  const startRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    recorder.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      setPhase('done');
      onComplete(blob);
    };
    recorder.start();
    recorderRef.current = recorder;
    beeps(1);
    setPhase('recording');
    setCount(RECORD_SECONDS);
  }, [onComplete]);

  // Drives both countdowns.
  useEffect(() => {
    if (phase !== 'setup' && phase !== 'recording') return;
    if (count <= 0) {
      if (phase === 'setup') startRecording();
      else if (phase === 'recording') stopRecording();
      return;
    }
    const t = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, count, startRecording, stopRecording]);

  const begin = () => {
    setPhase('setup');
    setCount(SETUP_SECONDS);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-full overflow-hidden rounded-2xl bg-black" style={{ aspectRatio: '16/9' }}>
        <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
        {(phase === 'setup' || phase === 'recording') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40">
            <span className="text-6xl font-bold text-white">{count}</span>
            <span className="mt-2 text-lg text-white/80">
              {phase === 'setup' ? 'Get ready on the treadmill…' : 'Recording — keep running'}
            </span>
          </div>
        )}
        {phase === 'recording' && (
          <div className="absolute right-4 top-4 flex items-center gap-2 rounded-full bg-red-600 px-3 py-1 text-sm text-white">
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> REC
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {phase === 'idle' && !error && (
        <button
          onClick={begin}
          className="flex items-center gap-2 rounded-xl px-8 py-4 text-lg font-semibold"
          style={{ background: 'var(--brand-primary)', color: 'var(--brand-on-primary)' }}
        >
          <Video className="h-5 w-5" /> Press Start
        </button>
      )}
    </div>
  );
}

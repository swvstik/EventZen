import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { HiCheck, HiCamera, HiUpload, HiX } from 'react-icons/hi';
import toast from 'react-hot-toast';
import jsQR from 'jsqr';
import { attendeesApi } from '@/shared/api';
import { PageHeader } from '@/shared/ui';

export default function CheckInPage() {
  const [qrInput, setQrInput] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animationFrameRef = useRef(null);
  const lastDetectedRef = useRef({ token: null, ts: 0 });

  const checkinMutation = useMutation({
    mutationFn: (token) => attendeesApi.checkin({ qrToken: token }),
    onSuccess: (res) => {
      const registration = res?.data?.data || res?.data;
      setLastResult(registration || null);
      toast.success('Ticket checked in successfully.');
      setQrInput('');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Check-in failed'),
  });

  const stopScanner = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => () => stopScanner(), []);

  const handleDetectedToken = (token) => {
    const now = Date.now();
    if (
      lastDetectedRef.current.token === token
      && now - lastDetectedRef.current.ts < 2200
    ) {
      return;
    }

    lastDetectedRef.current = { token, ts: now };
    setQrInput(token);
    stopScanner();
    setScannerOpen(false);
    checkinMutation.mutate(token);
  };

  const scanFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== 4) {
      animationFrameRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) {
      animationFrameRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, width, height);

    const imageData = ctx.getImageData(0, 0, width, height);
    const result = jsQR(imageData.data, width, height, { inversionAttempts: 'attemptBoth' });

    if (result?.data) {
      handleDetectedToken(result.data.trim());
      return;
    }

    animationFrameRef.current = requestAnimationFrame(scanFrame);
  };

  const startScanner = async () => {
    setCameraError('');
    setIsStartingCamera(true);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera API is not available in this browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
        },
        audio: false,
      });

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        throw new Error('Camera video element is unavailable.');
      }

      video.srcObject = stream;
      await video.play();
      setScannerOpen(true);
      animationFrameRef.current = requestAnimationFrame(scanFrame);
    } catch (err) {
      stopScanner();
      setScannerOpen(false);
      setCameraError(err?.message || 'Could not start camera scanner.');
    } finally {
      setIsStartingCamera(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const bitmap = await createImageBitmap(file);
      const canvas = canvasRef.current;
      if (!canvas) throw new Error('Image canvas is unavailable.');

      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height);

      const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
      const result = jsQR(imageData.data, bitmap.width, bitmap.height, { inversionAttempts: 'attemptBoth' });
      bitmap.close();

      if (!result?.data) {
        throw new Error('No QR code found in the uploaded image.');
      }

      handleDetectedToken(result.data.trim());
    } catch (err) {
      toast.error(err?.message || 'Could not decode uploaded QR image.');
    }
  };

  const handleManualCheckIn = () => {
    const token = qrInput.trim();
    if (!token) {
      toast.error('Enter or scan a QR token first.');
      return;
    }
    checkinMutation.mutate(token);
  };

  return (
    <div>
      <PageHeader
        title="Check-In"
        subtitle="Scan or paste ticket QR tokens. Check-in is no longer tied to a single event page."
      />

      <div className="neo-card p-5 space-y-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={startScanner}
            disabled={isStartingCamera || scannerOpen}
            className="neo-btn neo-btn-sm bg-neo-white disabled:opacity-50"
          >
            <HiCamera /> {scannerOpen ? 'Camera Live' : (isStartingCamera ? 'Starting Camera...' : 'Use Camera')}
          </button>

          <label className="neo-btn neo-btn-sm bg-neo-white cursor-pointer">
            <HiUpload /> Upload QR Image
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>

          {scannerOpen && (
            <button
              type="button"
              onClick={() => {
                stopScanner();
                setScannerOpen(false);
              }}
              className="neo-btn neo-btn-sm bg-neo-red text-white"
            >
              <HiX /> Stop Camera
            </button>
          )}
        </div>

        {cameraError && (
          <p className="font-body text-xs text-neo-red">{cameraError}</p>
        )}

        {scannerOpen && (
          <div className="border-3 border-neo-black bg-neo-black/90 p-2 max-w-sm">
            <video
              ref={videoRef}
              className="w-full aspect-[4/3] object-cover border-2 border-neo-white/60"
              muted
              playsInline
              autoPlay
            />
            <p className="font-body text-[11px] text-neo-white/90 mt-2">
              Center the QR code in frame. Check-in will run automatically once detected.
            </p>
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

        <div className="flex gap-3">
          <label htmlFor="checkin-qr-token" className="sr-only">QR token</label>
          <input
            id="checkin-qr-token"
            name="qrToken"
            value={qrInput}
            onChange={(e) => setQrInput(e.target.value)}
            className="neo-input flex-1"
            placeholder="Scan or paste QR token..."
            autoComplete="off"
          />
          <button
            type="button"
            onClick={handleManualCheckIn}
            disabled={!qrInput.trim() || checkinMutation.isPending}
            className="neo-btn bg-neo-blue text-white disabled:opacity-50"
          >
            <HiCheck /> Check In
          </button>
        </div>

        {lastResult && (
          <div className="neo-card p-3 bg-neo-cream border-l-8 border-neo-green">
            <p className="font-heading text-xs uppercase tracking-wider">Last Check-In</p>
            <p className="font-body text-xs text-neo-black/70 mt-1">Ticket ID: {lastResult._id || lastResult.id || 'N/A'}</p>
            <p className="font-body text-xs text-neo-black/70">Event: {lastResult.eventId || 'N/A'} | Tier: {lastResult.tierId || 'N/A'}</p>
            <p className="font-body text-xs text-neo-black/70">Status: {lastResult.status || 'CHECKED_IN'}</p>
          </div>
        )}
      </div>
    </div>
  );
}

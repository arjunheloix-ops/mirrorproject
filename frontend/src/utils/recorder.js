export class MirrorRecorder {
  constructor({ onChunk } = {}) {
    this.stream = null;
    this.mediaRecorder = null;
    this.startTime = 0;
    this.isRecording = false;
    this._saving = false;
    this._chunkIndex = 0;
    this._onChunk = onChunk || null;
  }

  async requestCamera() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      audio: false
    });
    return this.stream;
  }

  startRecording() {
    if (!this.stream) throw new Error('Camera not initialized');

    this._saving = false;
    this._chunkIndex = 0;
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
        ? 'video/webm;codecs=vp8'
        : 'video/webm';

    this.mimeType = mimeType;
    this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        const idx = this._chunkIndex++;
        if (this._onChunk) {
          this._onChunk(e.data, idx);
        }
      }
    };

    this.startTime = Date.now();
    this.mediaRecorder.start(1000); // emit chunk every second
    this.isRecording = true;
  }

  // Stop recording gracefully and return duration info
  stopRecording() {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        const duration = (Date.now() - this.startTime) / 1000;
        this.isRecording = false;
        resolve({ duration, mimeType: this.mimeType });
      };

      this.mediaRecorder.stop();
    });
  }

  getDuration() {
    return (Date.now() - this.startTime) / 1000;
  }

  get saving() { return this._saving; }
  set saving(v) { this._saving = v; }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }

  destroy() {
    if (this.isRecording) {
      try { this.mediaRecorder?.stop(); } catch { /* */ }
    }
    this.stopCamera();
  }
}

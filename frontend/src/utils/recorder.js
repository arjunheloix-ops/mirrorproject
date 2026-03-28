export class MirrorRecorder {
  constructor() {
    this.stream = null;
    this.mediaRecorder = null;
    this.chunks = [];
    this.startTime = 0;
    this.isRecording = false;
    this._saving = false;
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

    this.chunks = [];
    this._saving = false;
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
        ? 'video/webm;codecs=vp8'
        : 'video/webm';

    this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        this.chunks.push(e.data);
      }
    };

    this.startTime = Date.now();
    this.mediaRecorder.start(1000); // collect data every second
    this.isRecording = true;
  }

  stopRecording() {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        const duration = (Date.now() - this.startTime) / 1000;
        const blob = new Blob(this.chunks, { type: this.mediaRecorder.mimeType });
        this.isRecording = false;
        this.chunks = [];
        resolve({ blob, duration });
      };

      this.mediaRecorder.stop();
    });
  }

  // Synchronous: build blob from whatever chunks exist right now — for emergency saves
  getCurrentBlob() {
    if (this.chunks.length === 0) return null;
    const mimeType = this.mediaRecorder?.mimeType || 'video/webm';
    const duration = (Date.now() - this.startTime) / 1000;
    return {
      blob: new Blob(this.chunks, { type: mimeType }),
      duration
    };
  }

  // Mark saving in progress to prevent duplicate saves
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
      this.mediaRecorder?.stop();
    }
    this.stopCamera();
    this.chunks = [];
  }
}

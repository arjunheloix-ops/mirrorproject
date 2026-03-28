# Mirror — Premium Virtual Mirror Experience

A luxury virtual mirror web application with video recording capability and a full admin panel for managing recordings.

## Project Structure

```
mirror/
├── backend/
│   ├── db/
│   │   └── database.js          # SQLite database setup & seeding
│   ├── middleware/
│   │   └── auth.js              # JWT authentication middleware
│   ├── routes/
│   │   ├── auth.js              # Login & token verification
│   │   └── videos.js            # Upload, list, stream, delete videos
│   ├── uploads/                 # Recorded video files (auto-created)
│   ├── .env                     # Environment config
│   ├── package.json
│   └── server.js                # Express server entry point
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Landing.jsx      # Landing page with CTA
│   │   │   ├── Mirror.jsx       # Premium mirror experience
│   │   │   ├── AdminLogin.jsx   # Admin sign-in
│   │   │   ├── AdminDashboard.jsx # Stats dashboard
│   │   │   └── AdminRecordings.jsx # Video management
│   │   ├── utils/
│   │   │   ├── api.js           # API client functions
│   │   │   └── recorder.js      # MediaRecorder wrapper
│   │   ├── App.jsx              # Router setup
│   │   ├── main.jsx             # React entry point
│   │   └── index.css            # All premium styles
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── pages.md                     # Page & module documentation
└── README.md                    # This file
```

## Quick Setup

### Prerequisites
- Node.js 18+

### 1. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Start the backend

```bash
cd backend
npm run dev
```

Backend runs on `http://localhost:4000`

### 3. Start the frontend

```bash
cd frontend
npm run dev
```

Frontend runs on `http://localhost:3000` (proxies API to backend)

### 4. Default Admin Credentials

```
Username: admin
Password: admin123
```

## How It Works

1. User visits the landing page and clicks "Click Me"
2. The premium mirror opens and requests camera access
3. Live camera feed is displayed inside a luxury circular mirror with glow effects
4. User can record their session — video is captured via MediaRecorder API
5. On stop, the recording is uploaded to the backend and stored
6. Admin logs in at `/admin` and can view, play, and delete all recordings

## Production Build

```bash
cd frontend && npm run build
cd ../backend && npm start
```

The backend serves the built frontend from `frontend/dist/`.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | Backend server port |
| `JWT_SECRET` | (set in .env) | Secret key for JWT tokens |
| `ADMIN_USERNAME` | `admin` | Default admin username |
| `ADMIN_PASSWORD` | `admin123` | Default admin password |

## Future Enhancements

- **Auto-record on mirror open** — Start recording automatically when camera activates
- **User identification** — Fingerprint or optional name input before mirror session
- **Thumbnail generation** — Generate video thumbnails server-side with ffmpeg
- **Cloud storage** — Store videos in S3/GCS instead of local filesystem
- **Multi-admin support** — Admin user management with roles
- **Analytics dashboard** — Charts for recording trends, peak usage times
- **WebSocket live preview** — Real-time view of active mirror sessions in admin
- **Mobile optimization** — Enhanced touch controls and orientation handling
- **Rate limiting** — Protect upload endpoint from abuse
- **Video compression** — Server-side transcoding to reduce storage

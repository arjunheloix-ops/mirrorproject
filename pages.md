# Mirror — Pages & Modules

## Public Pages

### 1. Landing Page (`/`)
- Hero section with animated gradient title
- Premium "Click Me" CTA button
- Ambient background orbs with floating animation
- Subtle admin link in footer
- Smooth page entrance animation

### 2. Mirror Experience (`/mirror`)
- Full-screen premium virtual mirror interface
- Circular mirror frame with:
  - Ring light effect (rotating conic gradient)
  - Pulsing glow animation
  - Beauty glow overlay (soft warm light)
  - Vignette effect for depth
  - Glass reflection highlight
- Camera permission handling with elegant UI states
- Recording controls (Record / Stop)
- Real-time recording timer
- Auto-upload on stop with toast notifications
- Back navigation to landing page

---

## Admin Pages

### 3. Admin Login (`/admin`)
- Clean, centered login card
- Username/password form with validation
- JWT-based authentication
- Error display for invalid credentials
- Link back to public mirror

### 4. Admin Dashboard (`/admin/dashboard`)
- Stats overview cards:
  - Total recordings count
  - Today's recordings
  - Total storage used
  - Total recording duration
- Quick navigation to recordings page
- Sticky navigation bar

### 5. Recordings Management (`/admin/recordings`)
- Video grid with card-based layout
- Each card shows:
  - Video preview (hover to preview)
  - Play overlay button
  - Session ID
  - Created date/time
  - File size and duration
  - Play and Delete actions
- Search by session ID
- Pagination controls
- Full-screen video playback modal
- Delete confirmation dialog
- Loading skeleton states
- Empty state when no recordings exist

---

## Backend Modules

### Authentication API (`/api/auth`)
- `POST /api/auth/login` — Admin login, returns JWT
- `GET /api/auth/verify` — Token validation

### Video API (`/api/videos`)
- `POST /api/videos/upload` — Upload recording (public, used by mirror)
- `GET /api/videos` — List recordings with search/pagination (admin)
- `GET /api/videos/stats` — Dashboard statistics (admin)
- `GET /api/videos/:id/stream` — Stream video with range support (admin)
- `DELETE /api/videos/:id` — Delete recording and file (admin)

### Database
- SQLite via `better-sqlite3`
- `admins` table — admin credentials
- `recordings` table — video metadata (id, filename, size, duration, session_id, timestamps)

### Storage
- Video files stored in `backend/uploads/`
- Managed via multer with 500MB file size limit
- Automatic cleanup on delete

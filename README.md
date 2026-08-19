# EduReach Admin Console

Separate React web dashboard for managing the EduReach backend.

## Setup

1. Install Node.js if it is not installed.
2. Open this folder:

```powershell
cd C:\dev\edureach\edureach_admin
```

3. Install dependencies:

```powershell
npm install
```

4. Create `.env` from `.env.example` if you need to change the backend URL:

```env
VITE_API_BASE_URL=http://192.168.1.153:2377/api/v1
```

5. Start the admin console:

```powershell
npm run dev
```

Then open the local URL shown by Vite, usually `http://localhost:5174`.

## Current Features

- Admin login using the existing `/auth/login` endpoint.
- Dashboard metrics from `/admin/dashboard`.
- Resource create, edit, delete, and listing.
- Subject create, edit, delete, and listing.
- Level create, edit, delete, and listing.
- Student list and activation toggle endpoint.

## Notes

The backend currently returns student name, email, role, and created date for the admin student table. If you want the UI to show active/inactive labels, add `isActive` to `AdminStudentResponse` in the backend.

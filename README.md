# EduReach Admin Console

The EduReach Admin Console is a responsive React and TypeScript web application
for authorized administrators. It provides a focused interface for monitoring
the platform and managing the learning catalogue and student communications.

## Capabilities

- Admin-only sign-in through the EduReach backend
- Dashboard metrics for students, resources, subjects, downloads, bookmarks,
  and ratings
- Resource management for books and videos, including metadata, activation,
  featured content, file links, and notifications
- Google Books, Open Library, YouTube, and Cloudinary import/upload workflows
  exposed by the backend
- Subject and level management
- Student listing
- Notifications sent to all students or an individual student
- Responsive navigation for desktop and mobile screen sizes

## Technology

- React
- TypeScript
- Vite
- `lucide-react` for interface icons
- EduReach Spring Boot REST API

## Prerequisites

- Node.js 18 or newer
- npm 9 or newer
- A running EduReach backend API
- An account with the `ADMIN` or `ROLE_ADMIN` role

## Local development

Run the commands from this directory:

```powershell
cd D:\dev\edureach\edureach_admin
npm install
npm run dev
```

Vite serves the console at <http://localhost:5174>. The development server is
bound to `0.0.0.0`, so it can also be reached from another device on the local
network using the host machine's IP address.

### API configuration

The API client reads `VITE_API_BASE_URL` at build time. The value should be the
backend origin including the API prefix:

```env
VITE_API_BASE_URL=http://localhost:2377/api/v1
```

Create `edureach_admin/.env.local` for local overrides. Do not commit local
environment files or credentials. If the variable is not set, the client uses
its built-in development API URL; setting it explicitly is recommended for
repeatable local development and deployments.

The backend must allow requests from the origin hosting the console and must be
running before signing in.

## Available scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server on port 5174 |
| `npm run build` | Type-check with `tsc -b` and create a production build |
| `npm run preview` | Serve the production build locally on port 4174 |

For a production-like local check:

```powershell
npm run build
npm run preview
```

## Project structure

```text
src/
├── App.tsx                 # Authentication and admin views
├── components/
│   ├── Shell.tsx           # Responsive navigation and session chrome
│   └── ui.tsx              # Shared loading, empty, metric, and formatting UI
├── lib/
│   └── api.ts              # API client, session persistence, and endpoints
├── types/
│   └── api.ts              # API response and request types
├── main.tsx                # React entry point
└── styles.css              # Application styles
```

The console stores the authenticated session in browser storage so a page
reload can restore the signed-in state. Sign out clears that session. The
backend remains the source of truth for authorization; the UI also verifies
that the returned role is administrative before opening the console.

## Deployment notes

1. Set `VITE_API_BASE_URL` to the HTTPS production API origin, including
   `/api/v1`.
2. Run `npm ci` in CI when a lockfile is available, or `npm install` locally.
3. Run `npm run build`.
4. Serve the generated `dist/` directory from a static web host.
5. Configure the host to return `index.html` for application routes if client
   side routing is introduced.
6. Configure backend CORS for the deployed console origin.

Never expose private keys, database credentials, or administrative secrets in
Vite environment variables. Any `VITE_*` value is bundled into browser code
and is therefore public.

## Troubleshooting

- **Network request fails:** verify the API URL includes `/api/v1`, the backend
  is reachable from the browser, and CORS permits the console origin.
- **Login succeeds but access is denied:** use an account whose backend role is
  `ADMIN` or `ROLE_ADMIN`.
- **Resource imports fail:** verify the corresponding provider credentials and
  endpoint configuration on the backend; provider secrets do not belong in
  this frontend.
- **Port already in use:** stop the process using port 5174 or update the
  `dev` and `preview` scripts consistently for your local environment.

## Related documentation

- [EduReach workspace overview](../README.md)
- [Backend README](../edureach_backend/README.md)
- [Flutter frontend README](../edureach_frontend/frontend/README.md)

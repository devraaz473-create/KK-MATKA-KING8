# KK Gaming app

This is a React/Vite frontend with an Express API and a JSON database file. Deploy the API and frontend together as a Node.js service; a static-only site cannot provide authentication or shared data.

## Run locally

Prerequisite: Node.js 20 or newer.

1. Copy `.env.example` to `.env` and set a unique `ADMIN_PASSWORD` of at least 12 characters.
2. In PowerShell, initialize the local database once:

   ```powershell
   $env:DB_INITIALIZE = "true"
   npm ci
   npm run dev
   ```

3. After the database is created, stop the server and set `DB_INITIALIZE=false` in `.env`. Never enable it to recover or replace a database.
4. Run `npm run lint` and `npm test` before deploying.

Local data is stored in the ignored `.local-data/server-db.json`. Do not copy production data into the repository.

## Secure deployment

Use an always-on Node.js host with persistent disk storage. The database is a local JSON file; `DATABASE_URL` is not used. Do not deploy on an ephemeral filesystem: a restart or redeploy can otherwise lose all accounts and history.

For a Render service with a persistent disk mounted at `/data`:

- Build command: `npm ci --include=dev && npm run build`
- Start command: `npm start`
- Set `NODE_ENV=production`, `APP_URL` to the exact public HTTPS origin, and `DB_PATH=/data/server-db.json`.
- Set `ADMIN_USERNAME` and a unique `ADMIN_PASSWORD` (at least 12 characters) as private environment variables.
- Set `DB_INITIALIZE=true` only for the first deployment to a new empty disk. After it starts and creates the database, immediately set it to `false` and redeploy.
- If other web origins need API access, add only their exact HTTPS origins to `CORS_ORIGINS`, comma-separated. Do not add paths or untrusted origins.
- For an Android build, set `VITE_API_BASE_URL` to the deployed HTTPS origin before building and syncing Capacitor:

  ```powershell
  $env:VITE_API_BASE_URL = "https://your-app.example.com"
  npm run build
  npx cap sync android
  ```

The server refuses production startup without an HTTPS `APP_URL`, and refuses to create a missing database unless `DB_INITIALIZE=true`. Take and verify an access-controlled backup before migrating or replacing production storage.

## Account and data protection

- Passwords are stored as salted scrypt hashes. Legacy plaintext passwords are hashed during migration and require users to set a new password at least 12 characters long.
- New accounts receive a temporary password of at least 12 characters and must change it at first sign-in. Do not use a fixed `KK00` plus six-digit password: it is easy to guess. `KK00` plus digits is only the player ID format.
- Sessions use random, server-validated HttpOnly cookies, expire after seven days, and are invalidated on sign-out, password change, or admin revocation.
- API access is role-checked; player snapshots contain only their own account data, and unauthenticated API requests are rejected.
- Keep `.env`, the database file, backups, and hosting secrets out of Git. `.gitignore` already excludes these files.

## Commit and push

The downloaded ZIP does not include Git history or its remote. If you have the original repository, clone it and copy only your intended code changes into that clone. Otherwise, create a new repository on GitHub, then run these commands from this project folder, replacing the URL:

```powershell
git init
git add .
git status
git commit -m "Secure authentication and user data"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

Before `git commit`, confirm `.env`, `server-db.json`, `.local-data`, and any real credentials are not staged. Do not use `git add .env` or commit database backups.

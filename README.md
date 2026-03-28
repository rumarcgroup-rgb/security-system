# DTR Management System (React + Supabase)

Modern full-stack Daily Time Record (DTR) app with:
- Employee mobile-first dashboard
- 6-step onboarding portal
- Admin desktop dashboard with real-time DTR review

## Stack
- React + Vite + Tailwind CSS
- Supabase Auth, Postgres, Storage, Realtime
- Lucide icons + Framer Motion + React Hot Toast

## Quick Start
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create `.env` from `.env.example`:
   ```bash
   cp .env.example .env
   ```
3. Set:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. In Supabase SQL editor, run [schema.sql](/c:/Users/ADMIN/Videos/security system/supabase/schema.sql).
5. In Supabase Storage, create private buckets:
   - `dtr-images`
   - `documents`
6. Run:
   ```bash
   npm run dev
   ```

## Auth + Role Notes
- Login/Signup is on `/login`.
- App uses `profiles.role`:
  - `admin` -> redirected to `/admin`
  - others -> employee dashboard
- New users can complete onboarding at `/onboarding`.

## Main Routes
- `/login` Auth page
- `/` Employee Dashboard
- `/onboarding` Multi-step onboarding
- `/admin` Admin Dashboard
- `/admin/dtr-submissions` DTR review table + modal + realtime updates
- `/admin/users` Admin user directory + role manager
- `/admin/settings` Admin profile settings

## Folder Structure
```text
src/
  components/
    layout/
    ui/
  features/
    admin/
    auth/
    employee/
    onboarding/
  hooks/
  lib/
```

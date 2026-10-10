# BARTR

Keep your cash. Spend your talent. A web app for trading services with people nearby, starting in LA County.

**What works:** email sign-up, onboarding (skills, needs, ZIP code), profiles with photo and video uploads, Discover with matches and real distances, follow and save, trade proposals with counter-offers, accept/decline/cancel, per-trade chat with live updates, two-sided completion, double-blind reviews, report and block.

**Built with:** React + Vite (the app), Supabase (database, logins, file storage, live updates), Vercel (hosting).

## Go live (about 30 minutes, best done on a computer)

### 1. Supabase: database and logins
1. Go to [supabase.com](https://supabase.com), sign up with GitHub, and click **New project**.
   - Name: `bartr`. Region: **West US (North California)**. Save the database password somewhere safe.
2. When the project is ready, open **SQL Editor > New query**, paste everything in [`supabase/schema.sql`](supabase/schema.sql), and click **Run**. You should see "Success. No rows returned."
3. Open **Authentication > Sign In / Providers > Email** and turn **off** "Confirm email", then save.
   (For test week, testers sign up with email + password and can start right away. Turn it back on after you set up custom email.)
4. Open **Project Settings > API keys** (or **Data API**) and copy two things:
   - **Project URL**, like `https://abcdxyz.supabase.co`
   - the **anon / publishable** key (never the `service_role` or secret key)

### 2. Vercel: put it online
1. Go to [vercel.com](https://vercel.com), sign up with GitHub, click **Add New > Project**, and import the `bartr` repository.
2. Under **Environment Variables**, add:
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon / publishable key
3. Click **Deploy**. In about a minute you get a link like `bartr-yourname.vercel.app`.
4. Back in Supabase, open **Authentication > URL Configuration** and set **Site URL** to that link.

### 3. Try it
- Open the link on your phone, tap **Open my shop**, and set up your profile.
- iPhone: in Safari tap **Share > Add to Home Screen**. Android: Chrome menu **> Add to Home screen**. It opens full-screen like an app.

## Running test week
- **Seed it first:** get 5 to 10 people you know (barbers, trainers, photographers, cooks) to set up shops before you invite strangers, so Discover isn't empty.
- **Reports:** check Supabase **Table Editor > reports** daily.
- **See activity:** Table Editor shows every profile, trade and review.
- **Remove someone:** Supabase **Authentication > Users > ... > Delete user** removes their account and everything they posted.

## Limits to know about
- Sign-up is email + password with no email confirmation. Password reset emails need custom email (a domain plus a service like Resend). Until then, reset passwords from Supabase **Authentication > Users**.
- Videos up to 50 MB (about a minute from a phone). Supabase's free plan includes 1 GB of storage.
- ID verification is not built yet; onboarding asks people to confirm they're 18+ and licensed where required.
- Supabase's free plan pauses a project after a week with no activity. During test week that won't happen.

## Develop locally
```bash
npm install
cp .env.example .env.local   # fill in your Supabase URL and anon key
npm run dev
```

# Premier League — Last Man Standing

Pick one Premier League team each gameweek. If it wins you go through; a draw or
a defeat and you're out. The last player standing wins.

Built with Next.js 16 (App Router), Prisma 7 on Supabase Postgres, Auth.js v5
with Discord sign-in, and Tailwind v4 styled to match prosportsadvice.com.

---

## How the game works

| Rule | Behaviour |
| --- | --- |
| Joining | Admin creates a league; a 6-character join code is generated. Players sign in with Discord and enter the code. |
| Picking | One team per gameweek. A team you've already used is greyed out and cannot be picked again. |
| Missing the deadline | Counts as a loss — the player is eliminated when the gameweek is settled. |
| Results | The admin ends the gameweek and marks which teams won. Anything other than a win eliminates the player. |
| Running out of teams | Once a player has used all 20 teams their pool resets and every team is available again. |
| Everyone goes out at once | The gameweek is **voided**: nobody is eliminated, those picks don't count against anyone's pool, no lifelines burn, and play continues. |
| Lifelines | An admin can grant lifelines to any player at any time. When a settle would eliminate that player (loss **or** missed pick), one lifeline burns instead and they survive; a losing pick saved this way still counts as a used team. Lifeline counts are visible to everyone. |
| Revival | An admin can bring an eliminated player back at any time. Their pick history and used teams are kept, and reviving into a finished league reopens it. |
| Winning | When one player is left (a lifeline save counts as surviving) the league is marked complete. |

Two deliberate choices worth knowing:

- **Picks are hidden until the deadline.** Other players' selections show as
  "Hidden until deadline" so nobody can react to what their rivals chose. Your
  own pick is always visible to you.
- **The first settled result closes the league to new entrants.** A league
  stays open right up to gameweek 1's pick deadline, so latecomers can join
  and still get a pick in. Once picks close, joining pauses; once the week is
  settled with a real result the league closes for good, because joining after
  results are in would be unfair on players who have already survived a round.
  (A voided gameweek counts for nobody, so it leaves entries open.)

---

## Setup

### 1. Install

```bash
npm install
```

### 2. Create the Supabase database

In your Supabase project go to **Project settings → Database → Connection
string** and copy both:

- the **Transaction pooler** string (port `6543`) → `DATABASE_URL`
- the **direct** string (port `5432`) → `DIRECT_URL`

The app runs on the pooled connection because serverless functions would
otherwise exhaust Postgres connections. Migrations need the direct one, because
pgbouncer can't run them.

### 3. Configure environment

```bash
cp .env.example .env
npx auth secret   # fills in AUTH_SECRET
```

Then fill in the rest:

| Variable | Where it comes from |
| --- | --- |
| `DATABASE_URL` | Supabase pooled connection string (port 6543) |
| `DIRECT_URL` | Supabase direct connection string (port 5432) |
| `AUTH_SECRET` | `npx auth secret` |
| `AUTH_DISCORD_ID` / `AUTH_DISCORD_SECRET` | Discord Developer Portal → your app → OAuth2 |
| `FOOTBALL_DATA_API_KEY` | free token from football-data.org |
| `ADMIN_EMAILS` | comma-separated emails that should get admin rights |

In the Discord Developer Portal add these OAuth2 redirect URLs:

```
http://localhost:3000/api/auth/callback/discord
https://<your-domain>/api/auth/callback/discord
```

### 4. Create the tables

```bash
npm run db:deploy
```

### 5. Run it

```bash
npm run dev
```

---

## First run checklist

1. Sign in with Discord. If your email is in `ADMIN_EMAILS` you're promoted to
   admin automatically on sign-in.
2. Go to **Admin → Sync teams**. This pulls the 20 Premier League teams from
   football-data.org and is required before any gameweek will work.
3. Create a league and share the 6-character join code.
4. Players sign in, enter the code, and appear in the league.
5. **Launch gameweek** with the Premier League matchday number. Fixtures are
   fetched and cached; the deadline defaults to the first kick-off.
6. After the matches, open the gameweek and mark each result, then
   **End gameweek**. Eliminations are processed in a single transaction.

---

## Admin notes

- **Promoting an admin** is done through `ADMIN_EMAILS`. The flag is only ever
  granted, never removed, so revoking admin is a deliberate database change:
  `update users set "isAdmin" = false where email = '…';`
- **Rate limits.** The football-data.org free tier allows 10 requests/minute.
  Fixtures are fetched once per gameweek and cached in Postgres, so this is
  ample.
- **Postponed matches.** Mark the fixture as "Draw / no result" — anyone who
  picked either side is eliminated, which is the usual house rule. If you'd
  rather not penalise them, wait until the match is played before settling.
- **Settling is final.** There is no un-settle, and the confirmation copy says
  so. If someone was knocked out by a wrong result, the remedy is **Revive** in
  the league's players table — their used teams and history survive intact.
- **Lifelines** are managed from the same table (the +/− control). Granting is
  unrestricted; removing stops at zero. The settle screen lists who holds
  lifelines before you confirm results.

---

## Verifying the rules

`scripts/verify-game-logic.ts` exercises the engine against a real database:
eliminations, missed picks, repeat-team rejection, deadline locking, void
rounds, pool resets, league completion, lifeline burns and revival
(63 assertions).

It **deletes all data**, so point it at a scratch database only. The
`LMS_ALLOW_WIPE` guard exists to stop it ever running against Supabase:

```bash
LMS_ALLOW_WIPE=1 DATABASE_URL=postgresql://…/scratch_db npm run verify:rules
```

---

## Deploying to Vercel

1. Import the repo in Vercel.
2. Add every variable from `.env.example` in **Settings → Environment
   Variables**.
3. Deploy. `postinstall` runs `prisma generate`, which is required because the
   generated client is gitignored.
4. Run `npm run db:deploy` against the production database once.

`NEXTAUTH_URL` is not needed — `trustHost` is enabled, so Auth.js uses the
Vercel-provided host.

---

## Project layout

```
src/
  app/
    (app)/                 authenticated area — the layout is the auth gate
      dashboard/           your leagues, join form
      leagues/[leagueId]/  league hub, survivors, history
                    pick/  team selection grid
      admin/               league + gameweek management
    login/                 Discord sign-in
    api/auth/              Auth.js route handler
  components/              UI kit and forms
  lib/
    lms.ts                 game rules: pools, picks, settling, eliminations
    football-data.ts       football-data.org client
    actions/               server actions
prisma/schema.prisma       data model
```

The auth gate lives in `src/app/(app)/layout.tsx` rather than middleware:
database sessions need Prisma, which can't run on the edge.

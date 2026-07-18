# Curious Incident Quiz

An interactive Kahoot-style quiz website for *The Curious Incident of the Dog in the Night-Time* by Mark Haddon.

## Features

- **Multiple difficulty levels** (Easy, Medium, Hard)
- **Timer system** with visual countdown
- **Time-based scoring** — answer fast to earn up to 10 points; the longer you take, the fewer points you get
- **Score tracking** with streak bonuses
- **Leaderboard** with prime-numbered ranks (#2, #3, #5, #7, …), shown on the start screen. Scores sync worldwide across all devices via a shared Supabase table (local-only fallback if unconfigured); you pick a username on first visit.
- **Lifelines** (Hint −5, 50/50 −10, Skip −15 points) — each costs points, so use them strategically
- **Responsive design** for mobile and desktop
- **Confetti animation** for high scores
- **Local storage** for high scores and saved question edits
- **Accessibility** improvements (keyboard navigation, ARIA labels)
- **Visualized performance metrics**
- **Automated deployment** to GitHub Pages via GitHub Actions

## How to Use

1. Open the dropdown menu on the start screen to select your difficulty level.
2. Click **Start Quiz** to begin.
3. Answer questions using the multiple-choice buttons.
4. Use lifelines strategically if you get stuck:
   - 💡 Hint (costs 5 points)
   - 🔥 50/50 (costs 10 points to remove two wrong answers)
   - ⏭ Skip question (costs 15 points)
5. Your score and progress are tracked throughout the quiz.
6. At the end, see your performance and try for a perfect run!

## Backend Deployment

This site is automatically deployed to GitHub Pages whenever changes are pushed to the `main` branch.

The deployment workflow uses the official GitHub Pages Actions:
- `actions/upload-pages-artifact@v3` to package the site root
- `actions/deploy-pages@v4` to publish it
- Node.js 20 environment on `ubuntu-latest`

## Leaderboard (worldwide, synced)

Scores are stored in a shared **Supabase** Postgres table, so every visitor — on any
device — sees the same ranks in near real time. The app talks to Supabase's REST API
directly from the browser (no backend code, no build step). On first visit you're
asked for a username (stored in `localStorage`); use **Change name** on the start
screen to edit it. Ranks are prime numbers (#2, #3, #5, #7, …).

**Setup (free):**

1. Create a project at [supabase.com](https://supabase.com).
2. Run this SQL in the Supabase SQL editor:

   ```sql
   create table if not exists public.leaderboard (
     id bigint generated always as identity primary key,
     name text not null,
     score integer not null,
     difficulty text default 'mixed',
     created_at timestamptz default now()
   );
   alter table public.leaderboard enable row level security;
   create policy "Public read"   on public.leaderboard for select using (true);
   create policy "Public insert" on public.leaderboard for insert with check (true);
   ```

3. In **Project Settings → API**, copy the Project URL and the `anon` public key.
4. Set them in `script.js` → `LEADERBOARD_CONFIG.supabaseUrl` / `supabaseKey`
   (or at runtime via `localStorage['quizSupabaseUrl']` / `localStorage['quizSupabaseKey']`).

The `anon` key is safe to expose — Row Level Security above controls access (public
read + insert). For a production board you'd add rate limiting / validation and
probably require a login.

**Without Supabase configured**, the board falls back to a local-only mode: it reads
`leaderboard.json` (empty by default) and stores your runs in `localStorage`, so the
UI still works but scores are not shared with other devices.

## Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Serve the folder over a local HTTP server (e.g. `npx serve` or `python3 -m http.server`) and open the printed URL. The app fetches `quiz_data.json`, so opening `index.html` directly via `file://` will **not** load the questions.

## License

MIT License
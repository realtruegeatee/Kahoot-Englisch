# Curious Incident Quiz

An interactive Kahoot-style quiz website for *The Curious Incident of the Dog in the Night-Time* by Mark Haddon.

## Features

- **Multiple difficulty levels** (Easy, Medium, Hard)
- **Timer system** with visual countdown
- **Time-based scoring** — answer fast to earn up to 10 points; the longer you take, the fewer points you get
- **Score tracking** with streak bonuses
- **Leaderboard** with prime-numbered ranks (#2, #3, #5, #7, …), shown on the start screen. Scores are stored in `leaderboard.json` in this repo (like `quiz_data.json`); you pick a username on first visit.
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

## Leaderboard

The leaderboard is backed by `leaderboard.json` in this repo (the same pattern as
`quiz_data.json`). The app reads it and shows the top entries — with prime-numbered
ranks — on the start screen and the results screen. On first visit you're asked for
a username (stored in `localStorage`); use **Change name** on the start screen to edit it.

**Submitting scores globally.** By default, a finished run is saved only in your own
browser (`localStorage`) so you see your score immediately. To persist scores for
everyone, give the app a scoped GitHub token so it can trigger the `submit-score`
workflow, which appends the score to `leaderboard.json` and commits it (the Pages
deploy then republishes):

1. Create a fine-grained Personal Access Token with **Contents: Read/Write** and
   **Actions: Read/Write** for this repo (or a classic PAT with `repo`).
2. Set it in `script.js` → `LEADERBOARD_CONFIG.token`, or at runtime via
   `localStorage['quizLbToken']` (e.g. from the browser console).
3. Finish a quiz — the app dispatches `event_type: submit-score` with the score in
   `client_payload`; the workflow writes it to `leaderboard.json` and pushes.

> Note: a token pasted into client-side code is visible to anyone using the site,
> so only do this on a repo you control, and use a token scoped to this repo only.

## Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Serve the folder over a local HTTP server (e.g. `npx serve` or `python3 -m http.server`) and open the printed URL. The app fetches `quiz_data.json`, so opening `index.html` directly via `file://` will **not** load the questions.

## License

MIT License
# Curious Incident Quiz

An interactive Kahoot-style quiz website for *The Curious Incident of the Dog in the Night-Time* by Mark Haddon.

## Features

- **Multiple difficulty levels** (Easy, Medium, Hard)
- **Timer system** with visual countdown
- **Score tracking** with streak bonuses
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

## Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Serve the folder over a local HTTP server (e.g. `npx serve` or `python3 -m http.server`) and open the printed URL. The app fetches `quiz_data.json`, so opening `index.html` directly via `file://` will **not** load the questions.

## License

MIT License
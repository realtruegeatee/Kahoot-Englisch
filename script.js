// Enhanced Quiz Game Script
const HINT_COST = 5;   // points deducted when the hint lifeline is used
const FIFTY_COST = 10; // points deducted when 50/50 is used
const SKIP_COST = 15;  // points deducted when a question is skipped

let quizData = [];
let currentQuestion = 0;
let score = 0;
let selectedQuestions = [];
let timePerQuestion = 30;
let timerInterval;
let timeRemaining = 0; // seconds left on the current question, used for time-based scoring
let lifelines = { hint: true, fifty: true, skip: true };
let currentDifficulty = 'mixed';
let streak = 0;
let highScore = localStorage.getItem('highScore') || 0;
let currentCorrectIndex = 0; // display position of the correct answer for the current question
const STORAGE_KEY = 'quizQuestionsOverride'; // user-edited questions

// Simulated "world" leaderboard. This static site has no backend, so the
// global ranks are seeded with fictional players and the player's own run is
// merged in at render time. Swap WORLD_PLAYERS + renderLeaderboard() for a real
// API call to make the board genuinely global.
const WORLD_PLAYERS = [
    { name: 'DetectiveDoyle', score: 173 },
    { name: 'PrimePi',        score: 161 },
    { name: 'SherlockFan',    score: 152 },
    { name: 'RiddleReader',   score: 144 },
    { name: 'BookwormBex',    score: 138 },
    { name: 'QuizzicalQ',     score: 129 },
    { name: 'NightOwl',       score: 117 },
    { name: 'ChapterChaser',  score: 108 },
    { name: 'TobyTheRat',     score: 96  },
    { name: 'SwindonSky',     score: 84  },
    { name: 'NewcomerN',      score: 71  },
    { name: 'CuriousCat',     score: 58  }
];

const questionsDiv = document.getElementById('questions');
const scoreSpan = document.getElementById('score');

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initQuiz();
});

function initQuiz() {
    // Reset screens to start screen
    document.getElementById('start-screen').style.display = 'block';
    document.getElementById('quiz-screen').style.display = 'none';
    document.getElementById('results').style.display = 'none';

    fetch('quiz_data.json')
        .then(response => response.json())
        .then(data => {
            // Apply user-edited questions if present
            const override = localStorage.getItem(STORAGE_KEY);
            if (override) {
                try {
                    const parsed = JSON.parse(override);
                    if (Array.isArray(parsed) && parsed.length) {
                        data.questions = parsed;
                    }
                } catch (e) {
                    console.warn('Could not parse saved questions:', e);
                }
            }
            quizData = data;
            currentQuestion = 0;
            score = 0;
            streak = 0;
            lifelines = { hint: true, fifty: true, skip: true };
            document.getElementById('score').textContent = '0';
        })
        .catch(err => console.error('Error loading quiz:', err));
}

function selectDifficulty(difficulty, evt) {
    currentDifficulty = difficulty;
    const buttons = document.querySelectorAll('.difficulty-btn');
    buttons.forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-checked', 'false');
    });
    const target = evt ? evt.currentTarget : null;
    if (target) {
        target.classList.add('active');
        target.setAttribute('aria-checked', 'true');
    }

    // Update settings based on difficulty
    if (difficulty === 'easy') timePerQuestion = 30;
    else if (difficulty === 'medium') timePerQuestion = 25;
    else if (difficulty === 'hard') timePerQuestion = 20;
    else timePerQuestion = 25; // Mixed
}

function startQuiz() {
    // Filter questions by difficulty
    let availableQuestions = quizData.questions;
    if (currentDifficulty !== 'mixed') {
        availableQuestions = quizData.questions.filter(q => q.difficulty === currentDifficulty || q.difficulty === 'mixed');
    }

    // Shuffle and select questions
    const shuffled = shuffleArray([...availableQuestions]);
    selectedQuestions = shuffled.slice(0, quizData.settings.questionsPerGame);

    // Update total questions display
    document.getElementById('total-q').textContent = selectedQuestions.length;

    // Show quiz screen
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('quiz-screen').style.display = 'block';

    showQuestion();
    updateLifelineButtons();
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function showQuestion() {
    if (currentQuestion >= selectedQuestions.length) {
        showResults();
        return;
    }

    const q = selectedQuestions[currentQuestion];
    const category = q.category ? q.category : 'General';
    const difficulty = q.difficulty ? q.difficulty : 'mixed';

    // Shuffle the option order so the correct answer lands in a random
    // position (A/B/C/D) every time the question is shown.
    const letters = ['A', 'B', 'C', 'D'];
    const indexed = q.options.map((text, original) => ({ text, original }));
    const shuffled = shuffleArray(indexed);
    currentCorrectIndex = shuffled.findIndex(o => o.original === q.answer);

    const optionsHtml = shuffled.map((o, displayPos) =>
        `<button class="option" onclick="checkAnswer(${displayPos})" data-index="${displayPos}">
            <span class="opt-badge">${letters[displayPos]}</span>
            <span class="opt-text">${escapeHtml(o.text)}</span>
        </button>`
    ).join('');

    // Update progress
    document.getElementById('progress').style.width = `${(currentQuestion + 1) / selectedQuestions.length * 100}%`;
    document.getElementById('current-q').textContent = currentQuestion + 1;

    questionsDiv.innerHTML = `
        <div class="question-card">
            <span class="category-badge ${difficulty}">${escapeHtml(category)} • ${difficulty}</span>
            <h3>${escapeHtml(q.question)}</h3>
            <div class="options">${optionsHtml}</div>
        </div>
    `;

    // Hide hint box
    document.getElementById('hint-box').style.display = 'none';

    // Start timer
    startTimer();
}

function startTimer() {
    const timerBar = document.getElementById('timer-bar');
    clearInterval(timerInterval);

    // Smooth, GPU-friendly countdown: the bar animates from 100% -> 0% over the
    // full duration in a single linear transition instead of stepping 1%/second.
    timerBar.style.transition = 'none';
    timerBar.style.width = '100%';
    timerBar.style.background = 'linear-gradient(90deg, #2ecc71, #f39c12)';
    timerBar.setAttribute('aria-valuenow', '100');
    // Force a reflow so the reset above is applied before we start the animation.
    void timerBar.offsetWidth;
    timerBar.style.transition = `width ${timePerQuestion}s linear, background 0.4s linear`;
    timerBar.style.width = '0%';

    timeRemaining = timePerQuestion;
    timerInterval = setInterval(() => {
        timeRemaining--;
        const percentage = (timeRemaining / timePerQuestion) * 100;

        // Change color based on time remaining.
        if (percentage > 50) {
            timerBar.style.background = 'linear-gradient(90deg, #2ecc71, #f39c12)';
        } else if (percentage > 25) {
            timerBar.style.background = 'linear-gradient(90deg, #f39c12, #e74c3c)';
        } else {
            timerBar.style.background = 'linear-gradient(90deg, #e74c3c, #c0392b)';
        }
        timerBar.setAttribute('aria-valuenow', String(Math.max(0, Math.round(percentage))));

        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            timeOut();
        }
    }, 1000);
}

// Lock the timer bar at its current width so it doesn't keep shrinking after the
// question has been answered or time ran out.
function freezeTimerBar() {
    const timerBar = document.getElementById('timer-bar');
    if (!timerBar) return;
    const currentWidth = getComputedStyle(timerBar).width;
    timerBar.style.transition = 'none';
    timerBar.style.width = currentWidth;
}

function checkAnswer(selectedIndex) {
    clearInterval(timerInterval);
    freezeTimerBar();
    const buttons = document.querySelectorAll('.option');
    const isCorrect = selectedIndex === currentCorrectIndex;

    // Highlight correct and selected answers with visual feedback animations.
    buttons.forEach((btn, i) => {
        btn.disabled = true;
        btn.style.cursor = 'not-allowed';

        if (i === currentCorrectIndex) {
            btn.classList.add('correct', 'pulse-correct');
        }

        if (i === selectedIndex && !isCorrect) {
            btn.classList.add('incorrect', 'shake-wrong');
        }
    });

    // Calculate score — the faster you answer, the more points you earn.
    // The share of time left when you answer scales the award from 10 (answered
    // instantly) down to 1 (answered on the last second).
    if (isCorrect) {
        const fraction = Math.max(0, timeRemaining) / timePerQuestion;
        const earned = Math.max(1, Math.round(10 * fraction));
        score += earned;
        streak++;
        if (streak >= 3 && streak % 3 === 0) {
            score += 5; // Streak bonus
            announce(`Correct! +${earned} points and a streak bonus of +5.`);
        } else {
            announce(`Correct! +${earned} points.`);
        }
    } else {
        streak = 0;
        announce('Wrong answer.');
    }

    scoreSpan.textContent = score;
    bumpScore();
    updateLifelineButtons();

    // Move to next question
    setTimeout(() => {
        currentQuestion++;
        showQuestion();
    }, 1500);
}

function timeOut() {
    const buttons = document.querySelectorAll('.option');
    freezeTimerBar();

    buttons.forEach((btn, i) => {
        btn.disabled = true;
        btn.style.cursor = 'not-allowed';
        if (i === currentCorrectIndex) btn.classList.add('correct', 'pulse-correct');
    });

    scoreSpan.textContent = score;
    streak = 0;
    announce('Time is up.');

    setTimeout(() => {
        currentQuestion++;
        showQuestion();
    }, 1500);
}

function showResults() {
    // Save high score
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('highScore', highScore);
    }

    document.getElementById('quiz-screen').style.display = 'none';
    document.getElementById('results').style.display = 'block';

    document.getElementById('final-score').textContent = score;
    document.getElementById('final-total').textContent = selectedQuestions.length * 10;

    // Performance text
    const percentage = (score / (selectedQuestions.length * 10)) * 100;
    let performanceText = '';
    if (percentage >= 90) {
        performanceText = '🌟 Excellent! You really understood Christopher\'s world!';
    } else if (percentage >= 70) {
        performanceText = '👍 Great job! You have a good grasp of the novel.';
    } else if (percentage >= 50) {
        performanceText = '📚 Good effort! Consider re-reading some chapters.';
    } else {
        performanceText = '💡 Keep reading! The story gets clearer with each chapter.';
    }
    document.getElementById('performance-text').textContent = performanceText;

    // Render the (simulated) world leaderboard with this run included.
    renderLeaderboard(score);

    // Confetti for high scores
    if (percentage >= 70) {
        launchConfetti();
    }
}

// Return the n-th prime (1-based): 1->2, 2->3, 3->5, ... Used so leaderboard
// ranks are prime numbers instead of 1, 2, 3, ...
let _primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47];
function nthPrime(n) {
    while (_primes.length < n) {
        let cand = _primes[_primes.length - 1] + 1;
        while (true) {
            let isPrime = true;
            for (const p of _primes) {
                if (p * p > cand) break;
                if (cand % p === 0) { isPrime = false; break; }
            }
            if (isPrime) { _primes.push(cand); break; }
            cand++;
        }
    }
    return _primes[n - 1];
}

// Build the leaderboard: merge the player's run into the seeded world players,
// sort by score, and render the top entries with prime-numbered ranks.
function renderLeaderboard(playerScore) {
    const list = document.getElementById('lb-list');
    if (!list) return;

    const entries = WORLD_PLAYERS.map(p => ({ name: p.name, score: p.score, you: false }));
    entries.push({ name: 'You', score: playerScore, you: true });
    entries.sort((a, b) => b.score - a.score);

    const top = entries.slice(0, 10);
    list.innerHTML = top.map((e, i) => `
        <li class="lb-row${e.you ? ' lb-you' : ''}">
            <span class="lb-rank">#${nthPrime(i + 1)}</span>
            <span class="lb-name">${escapeHtml(e.name)}</span>
            <span class="lb-score">${e.score}</span>
        </li>
    `).join('');

    // Persist and show the player's personal best.
    const bestEl = document.getElementById('lb-best');
    if (bestEl) {
        const best = Number(localStorage.getItem('quizBest') || 0);
        if (playerScore > best) localStorage.setItem('quizBest', playerScore);
        bestEl.textContent = `Your best: ${Math.max(playerScore, best)}`;
    }
}

function useHint() {
    if (!lifelines.hint) return;

    const q = selectedQuestions[currentQuestion];
    const hintBox = document.getElementById('hint-box');
    const hintContent = document.getElementById('hint-content');

    // Non-revealing hint: prefer an explicit hint written into the question data,
    // otherwise nudge the player toward the relevant topic without giving away the
    // correct option (the old hint leaked the first 20 chars of the answer).
    const text = q.hint
        ? q.hint
        : `Tip: focus on the "${q.category || 'General'}" topic and read the question closely.`;
    hintContent.textContent = text;
    hintBox.style.display = 'block';

    lifelines.hint = false;
    updateLifelineButtons();

    score = Math.max(0, score - HINT_COST);
    scoreSpan.textContent = score;
    bumpScore();
    announce(`Hint shown. ${HINT_COST} points deducted.`);
}

function useFiftyFifty() {
    if (!lifelines.fifty) return;

    const buttons = document.querySelectorAll('.option');
    const wrongIndices = [];

    // Find wrong answers (relative to the current shuffled display order)
    buttons.forEach((btn, i) => {
        if (i !== currentCorrectIndex && wrongIndices.length < 2) {
            wrongIndices.push(i);
        }
    });

    // Disable wrong answers
    wrongIndices.forEach(i => {
        buttons[i].disabled = true;
        buttons[i].classList.add('dimmed');
        buttons[i].style.cursor = 'not-allowed';
    });

    lifelines.fifty = false;
    updateLifelineButtons();

    score = Math.max(0, score - FIFTY_COST);
    scoreSpan.textContent = score;
    bumpScore();
    announce(`Two wrong answers removed. ${FIFTY_COST} points deducted.`);
}

function skipQuestion() {
    if (!lifelines.skip) return;

    lifelines.skip = false;
    updateLifelineButtons();

    score = Math.max(0, score - SKIP_COST);
    scoreSpan.textContent = score;
    bumpScore();
    announce(`Question skipped. ${SKIP_COST} points deducted.`);

    // Move to next question
    currentQuestion++;
    showQuestion();
}

function updateLifelineButtons() {
    const hintBtn = document.getElementById('hint-btn');
    const fiftyBtn = document.getElementById('fifty-btn');
    const skipBtn = document.getElementById('skip-btn');

    if (hintBtn) hintBtn.disabled = !lifelines.hint;
    if (fiftyBtn) fiftyBtn.disabled = !lifelines.fifty;
    if (skipBtn) skipBtn.disabled = !lifelines.skip;
}

function launchConfetti() {
    const confettiContainer = document.getElementById('confetti');
    confettiContainer.innerHTML = '';

    for (let i = 0; i < 50; i++) {
        const piece = document.createElement('div');
        piece.classList.add('confetti-piece');
        piece.style.left = Math.random() * 100 + 'vw';
        piece.style.backgroundColor = ['#3498db', '#2ecc71', '#f39c12', '#e74c3c'][i % 4];
        piece.style.animationDuration = (Math.random() * 2 + 2) + 's';
        confettiContainer.appendChild(piece);
    }

    setTimeout(() => {
        confettiContainer.innerHTML = '';
    }, 3000);
}

// Keyboard navigation support
document.addEventListener('keydown', (e) => {
    if (document.getElementById('quiz-screen').style.display === 'none') return;

    const buttons = document.querySelectorAll('.option');
    const key = parseInt(e.key);

    if (key >= 1 && key <= 4) {
        const index = key - 1;
        if (buttons[index] && !buttons[index].disabled) {
            buttons[index].click();
        }
    } else if (e.key === 'h' || e.key === 'H') {
        useHint();
    } else if (e.key === 's' || e.key === 'S') {
        skipQuestion();
    } else if (e.key === '5') {
        useFiftyFifty();
    }
});

// Score bump animation on the HUD
function bumpScore() {
    const scoreEl = document.querySelector('.hud-score');
    if (!scoreEl) return;
    scoreEl.classList.remove('bump');
    void scoreEl.offsetWidth; // reflow to restart animation
    scoreEl.classList.add('bump');
}

// Announce a short status message to screen readers via the visually-hidden
// live region (#sr-status). Clearing first ensures repeated identical
// messages are re-announced.
function announce(message) {
    const el = document.getElementById('sr-status');
    if (!el) return;
    el.textContent = '';
    setTimeout(() => { el.textContent = message; }, 30);
}

// Theme toggle (persisted in localStorage)
function toggleTheme() {
    const root = document.documentElement;
    const isDark = root.getAttribute('data-theme') === 'dark';
    const next = isDark ? 'light' : 'dark';
    if (next === 'dark') {
        root.setAttribute('data-theme', 'dark');
    } else {
        root.removeAttribute('data-theme');
    }
    localStorage.setItem('theme', next);
    const icon = document.getElementById('theme-icon');
    if (icon) icon.textContent = next === 'dark' ? '☀️' : '🌙';
}

// Apply saved theme on load
(function applySavedTheme() {
    const saved = localStorage.getItem('theme');
    const icon = document.getElementById('theme-icon');
    if (saved === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        if (icon) icon.textContent = '☀️';
    }
})();

/* =========================================================
   Question Editor (saved to localStorage, no backend needed)
   ========================================================= */
let workingQuestions = [];
let editingId = null;
let editorUnlocked = false; // set true only after the correct access code is entered

// The access code is stored hashed (not as plaintext) so it isn't exposed by
// "View Source". NOTE: this is client-side only — it stops casual bypass, not a
// determined attacker with DevTools. Real protection needs a backend.
function hashCode(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = (h << 5) - h + str.charCodeAt(i);
        h |= 0;
    }
    return h;
}
const EDIT_CODE_HASH = hashCode('20092010');

function promptEditorCode() {
    if (editorUnlocked) { openEditor(); return; }
    document.getElementById('code-input').value = '';
    document.getElementById('code-error').style.display = 'none';
    document.getElementById('code-modal').style.display = 'flex';
    setTimeout(() => document.getElementById('code-input').focus(), 50);
}

function closeCodeModal() {
    document.getElementById('code-modal').style.display = 'none';
}

function submitEditorCode() {
    const input = document.getElementById('code-input').value;
    if (hashCode(input) === EDIT_CODE_HASH) {
        editorUnlocked = true;
        closeCodeModal();
        openEditor();
    } else {
        document.getElementById('code-error').style.display = 'block';
        document.getElementById('code-input').value = '';
        document.getElementById('code-input').focus();
    }
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function openEditor() {
    // Gate: never open the editor unless the access code was entered this session.
    if (!editorUnlocked) {
        promptEditorCode();
        return;
    }
    if (!quizData || !quizData.questions) {
        alert('Quiz is still loading, please wait a moment.');
        return;
    }
    // Deep copy so edits don't mutate the source until saved
    workingQuestions = quizData.questions.map(q => ({ ...q, options: [...q.options] }));
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('quiz-screen').style.display = 'none';
    document.getElementById('results').style.display = 'none';
    document.getElementById('editor-screen').style.display = 'block';
    renderQuestionList();
}

function closeEditor() {
    document.getElementById('editor-screen').style.display = 'none';
    document.getElementById('start-screen').style.display = 'block';
}

function renderQuestionList() {
    const list = document.getElementById('question-list');
    if (!workingQuestions.length) {
        list.innerHTML = '<p>No questions yet. Click "Add Question" to create one.</p>';
        return;
    }
    list.innerHTML = workingQuestions.map(q => `
        <div class="q-item">
            <div class="q-item-main">
                <span class="q-badge ${q.difficulty || 'medium'}">${q.difficulty || 'medium'}</span>
                <span class="q-text" title="${escapeHtml(q.question)}">${escapeHtml(q.question)}</span>
            </div>
            <div class="q-item-actions">
                <button class="btn btn-small btn-ghost" onclick="openQuestionForm(${q.id})">Edit</button>
                <button class="btn btn-small btn-danger" onclick="deleteQuestion(${q.id})">Delete</button>
            </div>
        </div>
    `).join('');
}

function openQuestionForm(id) {
    editingId = (id === undefined) ? null : id;
    document.getElementById('form-title').textContent = editingId === null ? 'Add Question' : 'Edit Question';
    const q = editingId !== null ? workingQuestions.find(x => x.id === editingId) : null;
    document.getElementById('f-question').value = q ? q.question : '';
    document.getElementById('f-difficulty').value = q ? (q.difficulty || 'easy') : 'easy';
    document.getElementById('f-category').value = q ? (q.category || '') : '';
    renderOptionInputs(q ? q.options : ['', '', '', ''], q ? q.answer : 0);
    document.getElementById('question-form-modal').style.display = 'flex';
}

function renderOptionInputs(options, correct) {
    const container = document.getElementById('f-options');
    const letters = ['A', 'B', 'C', 'D'];
    container.innerHTML = options.map((opt, i) => `
        <div class="opt-row">
            <input type="radio" name="correct" value="${i}" id="correct-${i}" ${i === correct ? 'checked' : ''}>
            <label for="correct-${i}" class="opt-letter">${letters[i]}</label>
            <input type="text" class="opt-input" data-i="${i}" value="${escapeHtml(opt)}" placeholder="Option ${letters[i]}">
        </div>
    `).join('');
}

function closeQuestionForm() {
    document.getElementById('question-form-modal').style.display = 'none';
    editingId = null;
}

function saveQuestion() {
    const qText = document.getElementById('f-question').value.trim();
    const optInputs = Array.from(document.querySelectorAll('#f-options .opt-input'));
    const options = optInputs.map(inp => inp.value.trim());
    const checked = document.querySelector('#f-options input[name="correct"]:checked');

    if (!qText) { alert('Please enter a question.'); return; }
    if (options.some(o => !o)) { alert('Please fill in all four options.'); return; }
    if (!checked) { alert('Please select the correct answer.'); return; }

    const answer = parseInt(checked.value, 10);
    const difficulty = document.getElementById('f-difficulty').value;
    const category = document.getElementById('f-category').value.trim() || 'General';

    if (editingId === null) {
        const newId = workingQuestions.reduce((max, q) => Math.max(max, q.id || 0), 0) + 1;
        workingQuestions.push({ id: newId, question: qText, options, answer, difficulty, category });
    } else {
        const q = workingQuestions.find(x => x.id === editingId);
        if (q) {
            q.question = qText;
            q.options = options;
            q.answer = answer;
            q.difficulty = difficulty;
            q.category = category;
        }
    }
    persistQuestions();
    renderQuestionList();
    closeQuestionForm();
}

function deleteQuestion(id) {
    if (!confirm('Delete this question? This cannot be undone.')) return;
    workingQuestions = workingQuestions.filter(q => q.id !== id);
    persistQuestions();
    renderQuestionList();
}

function persistQuestions() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workingQuestions));
    if (quizData) quizData.questions = workingQuestions;
}

function exportQuestions() {
    const data = {
        quiz_title: (quizData && quizData.quiz_title) || 'Quiz',
        questions: workingQuestions,
        settings: (quizData && quizData.settings) || { questionsPerGame: 15, timePerQuestion: 30 }
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'quiz_data.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function importQuestions() {
    document.getElementById('import-file').click();
}

function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const data = JSON.parse(reader.result);
            const questions = Array.isArray(data) ? data : data.questions;
            if (!Array.isArray(questions) || !questions.length) throw new Error('No questions found.');
            questions.forEach(q => {
                if (!q.question || !Array.isArray(q.options) || q.options.length < 2) {
                    throw new Error('A question is missing text or options.');
                }
                if (typeof q.answer !== 'number' || q.answer < 0 || q.answer >= q.options.length) {
                    throw new Error('A question has an invalid correct-answer index.');
                }
            });
            workingQuestions = questions.map(q => ({ ...q, options: [...q.options] }));
            persistQuestions();
            renderQuestionList();
            alert('Imported ' + workingQuestions.length + ' questions.');
        } catch (err) {
            alert('Import failed: ' + err.message);
        }
        e.target.value = '';
    };
    reader.onerror = () => {
        alert('Import failed: the file could not be read.');
        e.target.value = '';
    };
    reader.readAsText(file);
}

function resetQuestions() {
    if (!confirm('Reset to the original questions? This discards all your edits.')) return;
    localStorage.removeItem(STORAGE_KEY);
    fetch('quiz_data.json')
        .then(r => r.json())
        .then(data => {
            quizData = data;
            workingQuestions = data.questions.map(q => ({ ...q, options: [...q.options] }));
            renderQuestionList();
        })
        .catch(err => alert('Could not reload original questions: ' + err));
}

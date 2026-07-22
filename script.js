// Enhanced Quiz Game Script
const HINT_COST = 5;
const FIFTY_COST = 10;
const SKIP_COST = 15;

// Audio implementation for sound effects
const SOUNDS = {
    correct: '/assets/sounds/correct.wav',
    incorrect: '/assets/sounds/incorrect.wav',
    hint: '/assets/sounds/hint.wav',
    fifty: '/assets/sounds/fifty.wav',
    skip: '/assets/sounds/skip.wav',
    confirm: '/assets/sounds/confirm.wav'
};

let audioContext = null;
let soundBuffers = {};

async function loadAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    // Load all sound buffers
    const keys = Object.keys(SOUNDS);
    await Promise.all(keys.map(async (key) => {
        try {
            const response = await fetch(SOUNDS[key]);
            if (response.ok) {
                const arrayBuffer = await response.arrayBuffer();
                const decoded = await audioContext.decodeAudioData(arrayBuffer);
                soundBuffers[key] = decoded;
            }
        } catch (e) {
            console.warn('Could not load sound:', key);
        }
    }));
}

function playSound(soundType) {
    if (!audioContext || !soundBuffers[soundType]) return;

    const source = audioContext.createBufferSource();
    source.buffer = soundBuffers[soundType];
    source.connect(audioContext.destination);
    source.start(0);
}

// Preload audio on page load
loadAudio().catch(err => console.warn('Audio loading failed:', err));

let quizData = [];
let currentQuestion = 0;
let score = 0;
let selectedQuestions = [];
let timePerQuestion = 30;
let timerInterval;
let timeRemaining = 0;
let lifelines = { hint: true, fifty: true, skip: true };
let currentDifficulty = 'mixed';
let streak = 0;
let highScore = localStorage.getItem('highScore') || 0;
let currentCorrectIndex = 0;
const STORAGE_KEY = 'quizQuestionsOverride';

const LEADERBOARD_CONFIG = {
    supabaseUrl: 'https://aokpohavwjpakbnsxzdi.supabase.co',
    supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFva3BvaGF2d2pwYWtibnN4emRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzOTY5NTcsImV4cCI6MjA5OTk3Mjk1N30.2HFau62tjN9v2YKu1aVCYr5WKzJcR3N8Ylj5b1VZpCw',
    table: 'leaderboard'
};

const questionsDiv = document.getElementById('questions');
const scoreSpan = document.getElementById('score');

document.addEventListener('DOMContentLoaded', () => {
    initQuiz();
    loadAndRenderLeaderboard();
    if (!getUsername()) promptUsername();
});

function initQuiz() {
    document.getElementById('start-screen').style.display = 'block';
    document.getElementById('quiz-screen').style.display = 'none';
    document.getElementById('results').style.display = 'none';

    fetch('quiz_data.json')
        .then(response => response.json())
        .then(data => {
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

    if (difficulty === 'easy') timePerQuestion = 30;
    else if (difficulty === 'medium') timePerQuestion = 25;
    else if (difficulty === 'hard') timePerQuestion = 20;
    else timePerQuestion = 25;
}

function startQuiz() {
    let availableQuestions = quizData.questions;
    if (currentDifficulty !== 'mixed') {
        availableQuestions = quizData.questions.filter(q => q.difficulty === currentDifficulty || q.difficulty === 'mixed');
    }

    const shuffled = shuffleArray([...availableQuestions]);
    selectedQuestions = shuffled.slice(0, quizData.settings.questionsPerGame);

    document.getElementById('total-q').textContent = selectedQuestions.length;

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

    document.getElementById('progress').style.width = `${(currentQuestion + 1) / selectedQuestions.length * 100}%`;
    document.getElementById('current-q').textContent = currentQuestion + 1;

    questionsDiv.innerHTML = `
        <div class="question-card">
            <span class="category-badge ${difficulty}">${escapeHtml(category)} • ${difficulty}</span>
            <h3>${escapeHtml(q.question)}</h3>
            <div class="options">${optionsHtml}</div>
        </div>
    `;

    document.getElementById('hint-box').style.display = 'none';

    startTimer();
}

function startTimer() {
    const timerBar = document.getElementById('timer-bar');
    clearInterval(timerInterval);

    timerBar.style.transition = 'none';
    timerBar.style.width = '100%';
    timerBar.style.background = 'linear-gradient(90deg, #2ecc71, #f39c12)';
    timerBar.setAttribute('aria-valuenow', '100');
    void timerBar.offsetWidth;
    timerBar.style.transition = `width ${timePerQuestion}s linear, background 0.4s linear`;
    timerBar.style.width = '0%';

    timeRemaining = timePerQuestion;
    timerInterval = setInterval(() => {
        timeRemaining--;
        const percentage = (timeRemaining / timePerQuestion) * 100;

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

    if (isCorrect) {
        playSound('correct');
        const fraction = Math.max(0, timeRemaining) / timePerQuestion;
        const earned = Math.max(1, Math.round(10 * fraction));
        score += earned;
        streak++;
        if (streak >= 3 && streak % 3 === 0) {
            score += 5;
            announce(`Correct! +${earned} points and a streak bonus of +5.`);
        } else {
            announce(`Correct! +${earned} points.`);
        }
    } else {
        playSound('incorrect');
        streak = 0;
        announce('Wrong answer.');
    }

    scoreSpan.textContent = score;
    bumpScore();
    updateLifelineButtons();

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

    playSound('skip');
    scoreSpan.textContent = score;
    streak = 0;
    announce('Time is up.');

    setTimeout(() => {
        currentQuestion++;
        showQuestion();
    }, 1500);
}

function showResults() {
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('highScore', highScore);
    }

    document.getElementById('quiz-screen').style.display = 'none';
    document.getElementById('results').style.display = 'block';

    document.getElementById('final-score').textContent = score;
    document.getElementById('final-total').textContent = selectedQuestions.length * 10;

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

    submitScore(score, currentDifficulty);

    if (percentage >= 70) {
        playSound('confirm');
        launchConfetti();
    }
}

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

function lbConfig() {
    return {
        url: LEADERBOARD_CONFIG.supabaseUrl || localStorage.getItem('quizSupabaseUrl') || '',
        key: LEADERBOARD_CONFIG.supabaseKey || localStorage.getItem('quizSupabaseKey') || ''
    };
}

async function loadAndRenderLeaderboard() {
    const username = getUsername();
    let entries = [];
    const { url, key } = lbConfig();

    if (url && key) {
        try {
            const res = await fetch(
                `${url}/rest/v1/${LEADERBOARD_CONFIG.table}` +
                `?select=name,score,difficulty&order=score.desc`,
                { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }, cache: 'no-store' }
            );
            if (res.ok) entries = await res.json();
        } catch (e) {
            console.warn('Leaderboard load failed:', e);
        }
    }

    if (!Array.isArray(entries) || !entries.length) {
        try {
            const res = await fetch('leaderboard.json', { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data.entries)) entries = data.entries;
            }
        } catch (e) { }
        try {
            const local = JSON.parse(localStorage.getItem('quizLocalScores') || '[]');
            if (Array.isArray(local)) entries = entries.concat(local);
        } catch (e) { }
    }

    renderLeaderboardInto('menu-lb-list', 'menu-lb-best', entries, username);
    renderLeaderboardInto('lb-list', 'lb-best', entries, username);
}

function renderLeaderboardInto(listId, bestId, entries, username) {
    const list = document.getElementById(listId);
    if (!list) return;
    const sorted = [...entries].sort((a, b) => b.score - a.score);
    if (!sorted.length) {
        list.innerHTML = '<li class="lb-empty">No scores yet — be the first!</li>';
    } else {
        list.innerHTML = sorted.map((e, i) => `
            <li class="lb-row${e.name === username ? ' lb-you' : ''}">
                <span class="lb-rank">#${nthPrime(i + 1)}</span>
                <span class="lb-name">${escapeHtml(e.name)}</span>
                <span class="lb-score">${e.score}</span>
            </li>
        `).join('');
    }

    if (bestId) {
        const bestEl = document.getElementById(bestId);
        if (bestEl) {
            const myBest = entries
                .filter(e => e.name === username)
                .reduce((m, e) => Math.max(m, e.score), 0);
            bestEl.textContent = myBest ? `Your best: ${myBest}` : '';
        }
    }
}

async function submitScore(score, difficulty) {
    const username = getUsername() || 'Anonymous';
    const entry = {
        name: username.slice(0, 20),
        score: Number(score) || 0,
        difficulty: difficulty || 'mixed'
    };

    const { url, key } = lbConfig();
    if (url && key) {
        const headers = {
            'apikey': key,
            'Authorization': 'Bearer ' + key,
            'Content-Type': 'application/json'
        };
        try {
            const existingRes = await fetch(
                `${url}/rest/v1/${LEADERBOARD_CONFIG.table}` +
                `?select=score&name=eq.${encodeURIComponent(username)}`,
                { headers, cache: 'no-store' }
            );
            const existing = existingRes.ok ? await existingRes.json() : [];
            const prev = existing.length ? existing[0].score : -1;
            if (prev === -1 || entry.score > prev) {
                await fetch(`${url}/rest/v1/${LEADERBOARD_CONFIG.table}?on_conflict=name`, {
                    method: 'POST',
                    headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
                    body: JSON.stringify([entry])
                });
            }
        } catch (e) {
            console.warn('Score submission failed:', e);
        }
    } else {
        let local = [];
        try { local = JSON.parse(localStorage.getItem('quizLocalScores') || '[]'); } catch (e) { }
        const idx = local.findIndex(e => e.name === username);
        if (idx === -1) local.push(entry);
        else if (entry.score > local[idx].score) local[idx] = entry;
        if (local.length > 50) local = local.slice(-50);
        localStorage.setItem('quizLocalScores', JSON.stringify(local));
    }

    await loadAndRenderLeaderboard();
}

function getUsername() { return localStorage.getItem('quizUsername') || ''; }

function promptUsername() {
    const input = document.getElementById('username-input');
    if (input) input.value = getUsername();
    const err = document.getElementById('username-error');
    if (err) err.style.display = 'none';
    const modal = document.getElementById('username-modal');
    if (modal) {
        modal.style.display = 'flex';
        if (input) setTimeout(() => input.focus(), 50);
    }
}

function closeUsernameModal() {
    const modal = document.getElementById('username-modal');
    if (modal) modal.style.display = 'none';
}

function saveUsername() {
    const input = document.getElementById('username-input');
    const name = (input ? input.value : '').trim();
    if (!name) {
        const err = document.getElementById('username-error');
        if (err) err.style.display = 'block';
        return;
    }
    localStorage.setItem('quizUsername', name.slice(0, 20));
    closeUsernameModal();
    loadAndRenderLeaderboard();
}

function useHint() {
    if (!lifelines.hint) return;

    const q = selectedQuestions[currentQuestion];
    const hintBox = document.getElementById('hint-box');
    const hintContent = document.getElementById('hint-content');

    const text = q.hint
        ? q.hint
        : `Tip: focus on the "${q.category || 'General'}" topic and read the question closely.`;
    hintContent.textContent = text;
    hintBox.style.display = 'block';

    playSound('hint');

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

    buttons.forEach((btn, i) => {
        if (i !== currentCorrectIndex && wrongIndices.length < 2) {
            wrongIndices.push(i);
        }
    });

    wrongIndices.forEach(i => {
        buttons[i].disabled = true;
        buttons[i].classList.add('dimmed');
        buttons[i].style.cursor = 'not-allowed';
    });

    playSound('fifty');

    lifelines.fifty = false;
    updateLifelineButtons();

    score = Math.max(0, score - FIFTY_COST);
    scoreSpan.textContent = score;
    bumpScore();
    announce(`Two wrong answers removed. ${FIFTY_COST} points deducted.`);
}

function skipQuestion() {
    if (!lifelines.skip) return;

    playSound('skip');

    lifelines.skip = false;
    updateLifelineButtons();

    score = Math.max(0, score - SKIP_COST);
    scoreSpan.textContent = score;
    bumpScore();
    announce(`Question skipped. ${SKIP_COST} points deducted.`);

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

function bumpScore() {
    const scoreEl = document.querySelector('.hud-score');
    if (!scoreEl) return;
    scoreEl.classList.remove('bump');
    void scoreEl.offsetWidth;
    scoreEl.classList.add('bump');
}

function announce(message) {
    const el = document.getElementById('sr-status');
    if (!el) return;
    el.textContent = '';
    setTimeout(() => { el.textContent = message; }, 30);
}

function systemPrefersDark() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyTheme(theme) {
    const root = document.documentElement;
    const icon = document.getElementById('theme-icon');

    root.removeAttribute('data-theme');

    if (theme === 'claude') {
        root.setAttribute('data-theme', 'claude');
        if (icon) icon.textContent = '🧘';
    } else if (theme === 'dark' || (theme !== 'light' && systemPrefersDark())) {
        root.setAttribute('data-theme', 'dark');
        if (icon) icon.textContent = '☀️';
    } else {
        if (icon) icon.textContent = '🌙';
    }

    localStorage.setItem('theme', theme);
}

(function applySavedTheme() {
    const savedTheme = localStorage.getItem('theme') || 'system';
    applyTheme(savedTheme);
})();

if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => { if (!localStorage.getItem('theme')) applyTheme('system'); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
}

function toggleTheme() {
    const currentTheme = localStorage.getItem('theme') || 'system';
    let nextTheme;

    if (currentTheme === 'claude') {
        nextTheme = 'light';
    } else if (currentTheme === 'dark' || (currentTheme === 'system' && systemPrefersDark())) {
        nextTheme = 'claude';
    } else {
        nextTheme = 'dark';
    }

    applyTheme(nextTheme);
}

let workingQuestions = [];
let editingId = null;
let editorUnlocked = false;

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
    if (!editorUnlocked) {
        promptEditorCode();
        return;
    }
    if (!quizData || !quizData.questions) {
        alert('Quiz is still loading, please wait a moment.');
        return;
    }
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
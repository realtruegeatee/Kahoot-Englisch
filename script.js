// Enhanced Quiz Game Script
let quizData = [];
let currentQuestion = 0;
let score = 0;
let selectedQuestions = [];
let timePerQuestion = 30;
let timerInterval;
let timeLeft = 30;
let lifelines = { hint: true, fifty: true, skip: true };
let hintUsed = false;
let currentDifficulty = 'mixed';
let streak = 0;
let highScore = localStorage.getItem('highScore') || 0;
let currentCorrectIndex = 0; // display position of the correct answer for the current question
const STORAGE_KEY = 'quizQuestionsOverride'; // user-edited questions

const questionsDiv = document.getElementById('questions');
const resultsDiv = document.getElementById('results');
const scoreSpan = document.getElementById('score');
const loadingDiv = document.getElementById('loading');

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    checkForSavedProgress();
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
            hintUsed = false;
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
    timeLeft = timePerQuestion;
    startTimer();
}

function startTimer() {
    const timerBar = document.getElementById('timer-bar');
    clearInterval(timerInterval);

    timerInterval = setInterval(() => {
        timeLeft--;
        const percentage = (timeLeft / timePerQuestion) * 100;
        timerBar.style.width = percentage + '%';

        // Change color based on time
        if (percentage > 50) {
            timerBar.style.background = 'linear-gradient(90deg, #2ecc71, #f39c12)';
        } else if (percentage > 25) {
            timerBar.style.background = 'linear-gradient(90deg, #f39c12, #e74c3c)';
        } else {
            timerBar.style.background = 'linear-gradient(90deg, #e74c3c, #c0392b)';
        }

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            timeOut();
        }
    }, 1000);
}

function checkAnswer(selectedIndex) {
    clearInterval(timerInterval);
    const buttons = document.querySelectorAll('.option');

    // Highlight correct and selected answers
    buttons.forEach((btn, i) => {
        btn.disabled = true;
        btn.style.cursor = 'not-allowed';

        if (i === currentCorrectIndex) {
            btn.classList.add('correct');
        }

        if (i === selectedIndex && selectedIndex !== currentCorrectIndex) {
            btn.classList.add('incorrect');
        }
    });

    // Calculate score
    if (selectedIndex === currentCorrectIndex) {
        score += 10;
        streak++;
        if (streak >= 3 && streak % 3 === 0) {
            score += 5; // Streak bonus
        }
    } else {
        streak = 0;
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

    buttons.forEach((btn, i) => {
        btn.disabled = true;
        btn.style.cursor = 'not-allowed';
        if (i === currentCorrectIndex) btn.classList.add('correct');
    });

    scoreSpan.textContent = score;
    streak = 0;

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

    resetProgress();

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

    // Confetti for high scores
    if (percentage >= 70) {
        launchConfetti();
    }
}

function useHint() {
    if (!lifelines.hint) return;

    const q = selectedQuestions[currentQuestion];
    const hintBox = document.getElementById('hint-box');
    const hintContent = document.getElementById('hint-content');

    hintContent.textContent = `Think about: ${q.options[q.answer].substring(0, Math.min(20, q.options[q.answer].length))}...`;
    hintBox.style.display = 'block';

    lifelines.hint = false;
    hintUsed = true;
    updateLifelineButtons();
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
}

function skipQuestion() {
    if (!lifelines.skip) return;

    lifelines.skip = false;
    updateLifelineButtons();

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

function checkForSavedProgress() {
    const saved = localStorage.getItem('quizProgress');
    if (saved) {
        try {
            const progress = JSON.parse(saved);
            if (progress && progress.currentQuestion < progress.totalQuestions) {
                if (confirm('Resume your previous quiz?')) {
                    // Resume logic here
                }
            }
        } catch (e) {
            console.log('No valid saved progress');
        }
    }
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

// Save progress
window.addEventListener('beforeunload', () => {
    if (currentQuestion > 0 && currentQuestion < selectedQuestions.length) {
        localStorage.setItem('quizProgress', JSON.stringify({
            currentQuestion,
            totalQuestions: selectedQuestions.length,
            score
        }));
    }
});

// Reset progress on completion
function resetProgress() {
    localStorage.removeItem('quizProgress');
}

// Score bump animation on the HUD
function bumpScore() {
    const scoreEl = document.querySelector('.hud-score');
    if (!scoreEl) return;
    scoreEl.classList.remove('bump');
    void scoreEl.offsetWidth; // reflow to restart animation
    scoreEl.classList.add('bump');
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

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function openEditor() {
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

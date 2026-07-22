const HINT_COST = 5;
const FIFTY_COST = 10;
const SKIP_COST = 15;

// Sound file structure
const SOUNDS = {
  correct: '/assets/sounds/correct.wav',
  incorrect: '/assets/sounds/incorrect.wav'
};

// Audio context initialization
let audioContext = null;
let buffers = {};

async function loadAudio() {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();

  // Load sound buffers
  await Promise.all([
    fetch(SOUNDS.correct).then(res => res.arrayBuffer()).then(data => audioContext.decodeAudioData(data)),
    fetch(SOUNDS.incorrect).then(res => res.arrayBuffer()).then(data => audioContext.decodeAudioData(data))
  ]);
}

// Play sound function
function playSound(soundType) {
  if (!audioContext) return;

  const buffer = audioContext.state.running ? buffers[`${soundType}`] : null;
  if (!buffer || !audioContext.state.running) return;

  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  source.connect(audioContext.destination);
  source.start(0);
}
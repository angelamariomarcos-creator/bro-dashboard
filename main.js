/* =============================================
   BRO DASHBOARD — MAIN.JS v2
   Mes 2: persistencia, bonus, memoria de Bro
   ============================================= */

'use strict';

// ─── ESTADO GLOBAL ────────────────────────────
const state = {
  mood: null,
  isStudying: false,
  timerRunning: false,
  timerPhase: 'focus',
  timerSeconds: 15 * 60,
  timerInterval: null,
  cyclesDone: 0,
  totalTasks: 0,
  doneTasks: 0,
  chatHistory: [],
  bonusToday: false,
};

const FOCUS_TIME = 15 * 60;
const BREAK_TIME =  5 * 60;
const ARC_TOTAL  = 534;

// ─── SISTEMA DE SONIDO (Tone.js) ──────────────
let audioIniciado = false;

async function initAudio() {
  if (audioIniciado) return;
  await Tone.start();
  audioIniciado = true;
}

async function playSound(tipo) {
  await initAudio();

  switch(tipo) {

    case 'timer_start': {
      // Pitido suave ascendente — arranca el timer
      const synth = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.5 },
        volume: -12,
      }).toDestination();
      synth.triggerAttackRelease('C5', '0.15');
      setTimeout(() => synth.triggerAttackRelease('E5', '0.15'), 150);
      setTimeout(() => { synth.triggerAttackRelease('G5', '0.3'); setTimeout(() => synth.dispose(), 1000); }, 300);
      break;
    }

    case 'timer_end': {
      // Alarma triple — termina un bloque
      const synth = new Tone.Synth({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.3 },
        volume: -8,
      }).toDestination();
      [0, 300, 600].forEach(t => {
        setTimeout(() => synth.triggerAttackRelease('A5', '0.25'), t);
      });
      setTimeout(() => synth.dispose(), 1500);
      break;
    }

    case 'tarea_check': {
      // Click satisfactorio — tarea marcada
      const synth = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.005, decay: 0.08, sustain: 0, release: 0.1 },
        volume: -15,
      }).toDestination();
      synth.triggerAttackRelease('G4', '0.1');
      setTimeout(() => { synth.triggerAttackRelease('B4', '0.1'); setTimeout(() => synth.dispose(), 500); }, 80);
      break;
    }

    case 'logro': {
      // Fanfarria de logro — celebración
      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.5 },
        volume: -10,
      }).toDestination();
      const notas = [
        { note: 'C5', time: 0 },
        { note: 'E5', time: 0.1 },
        { note: 'G5', time: 0.2 },
        { note: ['C5','E5','G5'], time: 0.35 },
      ];
      notas.forEach(n => setTimeout(() => synth.triggerAttackRelease(n.note, '0.3'), n.time * 1000));
      setTimeout(() => synth.dispose(), 2000);
      break;
    }

    case 'win': {
      // Victoria épica — Scooter Screen
      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.05, decay: 0.3, sustain: 0.5, release: 0.8 },
        volume: -8,
      }).toDestination();
      const secuencia = [
        { note: 'C4', t: 0 }, { note: 'E4', t: 0.15 }, { note: 'G4', t: 0.3 },
        { note: 'C5', t: 0.45 }, { note: ['C4','E4','G4','C5'], t: 0.7 },
      ];
      secuencia.forEach(s => setTimeout(() => synth.triggerAttackRelease(s.note, '0.4'), s.t * 1000));
      setTimeout(() => synth.dispose(), 3000);
      break;
    }
  }
}

// ─── INIT ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setHeaderDate();
  initTasks();
  updateTimerDisplay();
  renderLogros();
  loadFromStorage();
});

// ─── PERSISTENCIA ─────────────────────────────
function todayKey() {
  return new Date().toISOString().split('T')[0];
}

function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

function getProgress() {
  const key = 'bro_progress_' + todayKey();
  return JSON.parse(localStorage.getItem(key) || 'null');
}

function saveProgress(data) {
  const key = 'bro_progress_' + todayKey();
  localStorage.setItem(key, JSON.stringify(data));
}

function getYesterdayProgress() {
  const key = 'bro_progress_' + yesterdayKey();
  return JSON.parse(localStorage.getItem(key) || 'null');
}

function getStreak() {
  return parseInt(localStorage.getItem('bro_streak') || '0');
}

function saveStreak(n) {
  localStorage.setItem('bro_streak', String(n));
  document.getElementById('streakNum').textContent = n;
}

function buildBroContext() {
  // Contexto corto de ayer para la memoria de Bro
  const ayer = getYesterdayProgress();
  if (!ayer) return '';

  let ctx = '\n\n[Contexto de ayer:';
  if (ayer.objetivoCumplido) {
    ctx += ` Mario completó todas sus tareas (${ayer.tareasCompletadas}/${ayer.tareasTotal}). Hoy tiene bonus de -15 min.`;
  } else {
    ctx += ` Mario completó ${ayer.tareasCompletadas} de ${ayer.tareasTotal} tareas. No llegó al objetivo.`;
  }
  ctx += ` Racha actual: ${getStreak()} días seguidos.]`;
  return ctx;
}

// ─── INIT DESDE STORAGE ───────────────────────
function loadFromStorage() {
  const today = todayKey();
  const saved = JSON.parse(localStorage.getItem('bro_day_' + today) || 'null');
  const prog  = getProgress();
  const streak = getStreak();

  // Actualizar streak display
  document.getElementById('streakNum').textContent = streak || 0;

  // Detectar bonus de ayer
  const ayer = getYesterdayProgress();
  if (ayer && ayer.objetivoCumplido && !localStorage.getItem('bro_bonus_shown_' + today)) {
    state.bonusToday = true;
    localStorage.setItem('bro_bonus_shown_' + today, '1');
  }

  // Restaurar tareas completadas
  if (prog && prog.tareasCompletadas > 0) {
    const checks = document.querySelectorAll('.tarea-check');
    checks.forEach((c, i) => {
      if (i < prog.tareasCompletadas) c.checked = true;
    });
    updateProgresoUI(prog.tareasCompletadas, prog.tareasTotal);
  }

  if (saved) {
    state.mood = saved.mood;
    showMoodIndicator(saved.mood);
    hideMoodOverlay();
    enableChat();

    setTimeout(() => {
      if (state.bonusToday) {
        addBroMessage('¡Ey Mario! Ayer cumpliste como un campeón. 🏆 Hoy estudias 15 min menos, bro. ¡Tienes el bonus activado!');
      } else {
        addBroMessage(greetingReturn(saved.mood));
      }
    }, 400);
  }
}

// ─── FECHA HEADER ─────────────────────────────
function setHeaderDate() {
  const now  = new Date();
  const opts = { weekday: 'long', day: 'numeric', month: 'long' };
  const str  = now.toLocaleDateString('es-ES', opts);
  document.getElementById('headerDate').textContent =
    str.charAt(0).toUpperCase() + str.slice(1);
}

// ─── MOOD OVERLAY ─────────────────────────────
function selectMood(mood, btn) {
  document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  state.mood = mood;

  setTimeout(() => {
    hideMoodOverlay();
    showMoodIndicator(mood);
    enableChat();
    localStorage.setItem('bro_day_' + todayKey(), JSON.stringify({ mood, date: todayKey() }));

    setTimeout(() => {
      if (state.bonusToday) {
        addBroMessage('¡Ey Mario! Ayer cumpliste como un campeón 🏆 Hoy tienes bonus de -15 min. ¿Arrancamos?');
      } else {
        addBroMessage(greetingFirst(mood));
      }
    }, 300);
  }, 400);
}

function hideMoodOverlay() {
  const overlay = document.getElementById('moodOverlay');
  overlay.classList.add('hidden');
  setTimeout(() => { overlay.style.display = 'none'; }, 500);
}

function showMoodIndicator(mood) {
  const map = {
    verde:    '🟢 A tope',
    amarillo: '🟡 Modo avión',
    rojo:     '🔴 KO hoy',
  };
  document.getElementById('moodIndicator').textContent = map[mood] || '';
}

// ─── SALUDOS ──────────────────────────────────
function greetingFirst(mood) {
  const g = {
    verde:    ['¡Qué buenas vibras, Mario! Hoy vamos a arrasar, literal. ¿Le damos al primer bloque?',
               '¡A tope el chaval! Deja el tablón limpio y mañana estudias 15 min menos. ¿Empezamos?'],
    amarillo: ['Modo avión activado, de ley. Vamos tranquilos pero sin parar. ¿Por qué tarea arrancamos?',
               'Sin prisa pero sin pausa, bro. Un bloque de 15 min y ya eres el más aplicado. ¿Dale?'],
    rojo:     ['Sé que vienes frito, Mario. Hacemos lo más fácil en 10 min y a la calle con la scooter. Yo te cubro.',
               'KO total, ff. No pasa nada, uno solo y ya. ¿Cuál es la tarea más corta de hoy?'],
  };
  const list = g[mood] || g.amarillo;
  return list[Math.floor(Math.random() * list.length)];
}

function greetingReturn(mood) {
  const map = {
    verde:    '¡Sigues aquí, Mario! Las vibras de hoy molan mucho. ¿Seguimos donde lo dejamos?',
    amarillo: 'Bienvenido de vuelta, bro. ¿Qué te queda por marcar hoy?',
    rojo:     'Oye, que volviste. Eso ya es un punto. ¿Le damos aunque sea un poquito?',
  };
  return map[mood] || '¡Bienvenido de vuelta, Mario!';
}

// ─── CHAT ─────────────────────────────────────
function enableChat() {
  document.getElementById('chatInput').disabled  = false;
  document.getElementById('chatSend').disabled   = false;
  document.getElementById('chatInput').focus();
  const ph = document.querySelector('.chat-placeholder');
  if (ph) ph.remove();
}

function addBroMessage(text) {
  const msgs = document.getElementById('chatMessages');

  const typing = document.createElement('div');
  typing.className = 'msg msg-bro msg-typing';
  typing.innerHTML = `
    <div class="msg-avatar"><img src="bro-avatar.png" alt="Bro" style="width:100%;height:100%;object-fit:cover;object-position:top center;border-radius:50%;" /></div>
    <div class="msg-bubble"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div>`;
  msgs.appendChild(typing);
  msgs.scrollTop = msgs.scrollHeight;

  const delay = 600 + Math.min(text.length * 10, 1000);
  setTimeout(() => {
    typing.remove();
    const msg = document.createElement('div');
    msg.className = 'msg msg-bro';
    msg.innerHTML = `
      <div class="msg-avatar"><img src="bro-avatar.png" alt="Bro" style="width:100%;height:100%;object-fit:cover;object-position:top center;border-radius:50%;" /></div>
      <div class="msg-bubble">${text}</div>`;
    msgs.appendChild(msg);
    msgs.scrollTop = msgs.scrollHeight;
    state.chatHistory.push({ role: 'assistant', content: text });
  }, delay);
}

function addUserMessage(text) {
  const msgs = document.getElementById('chatMessages');
  const msg  = document.createElement('div');
  msg.className = 'msg msg-user';
  msg.innerHTML = `<div class="msg-bubble">${escapeHtml(text)}</div>`;
  msgs.appendChild(msg);
  msgs.scrollTop = msgs.scrollHeight;
  state.chatHistory.push({ role: 'user', content: text });
}

function onInputKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}

async function sendMessage() {
  const input = document.getElementById('chatInput');
  const text  = input.value.trim();
  if (!text) return;
  input.value = '';
  addUserMessage(text);
  const reply = await getBroReply(text);
  addBroMessage(reply);
}

// ─── GROQ API ─────────────────────────────────
async function getBroReply(userText) {
  try {
    const response = await fetch('/bro-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: userText,
        mood:    state.mood,
        history: state.chatHistory.slice(-10),
        context: buildBroContext(),
      }),
    });

    if (!response.ok) throw new Error('Error servidor');
    const data = await response.json();
    return data.reply;

  } catch (error) {
    console.error('Error Bro:', error);
    const mood = state.mood || 'amarillo';
    const fallback = {
      verde:    '¡Vibras de campeón! ¿Le damos al siguiente bloque? 🔥',
      amarillo: 'Tranquilo, paso a paso. Un bloque cada vez, bro.',
      rojo:     'Sin agobios. Hacemos lo que podemos y ya 🤙',
    };
    return fallback[mood];
  }
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ─── SISTEMA DE LOGROS ────────────────────────
const LOGROS_DEF = [
  { id: 'primer_dia',    badge: '🔥', texto: 'Primer día completado' },
  { id: 'racha_3',       badge: '🏆', texto: '3 días seguidos'       },
  { id: 'racha_7',       badge: '💪', texto: 'Semana completa'        },
  { id: 'velocista',     badge: '⚡', texto: 'Velocista'              },
  { id: 'jefe_mates',    badge: '👾', texto: 'Jefe de Mates derrotado'},
  { id: 'rey_parque',    badge: '🛴', texto: 'Rey del parque'         },
];

function getLogros() {
  return JSON.parse(localStorage.getItem('bro_logros') || '[]');
}

function desbloquearLogro(id) {
  const logros = getLogros();
  if (logros.includes(id)) return false; // ya desbloqueado
  logros.push(id);
  localStorage.setItem('bro_logros', JSON.stringify(logros));
  renderLogros();
  mostrarNotificacionLogro(id);
  return true;
}

function renderLogros() {
  const lista   = document.getElementById('logrosList');
  const logros  = getLogros();
  lista.innerHTML = LOGROS_DEF.map(l => {
    const desbloqueado = logros.includes(l.id);
    return `<div class="logro-item ${desbloqueado ? '' : 'logro-locked'}">
      <span class="logro-badge">${l.badge}</span>
      <span class="logro-texto">${l.texto}</span>
    </div>`;
  }).join('');
  updateStats();
}

function updateStats() {
  const streak  = getStreak();
  const logros  = getLogros();
  const minutos = parseInt(localStorage.getItem('bro_total_minutos') || '0');

  const elRacha   = document.getElementById('statRacha');
  const elMinutos = document.getElementById('statMinutos');
  const elLogros  = document.getElementById('statLogros');

  if (elRacha)   elRacha.textContent   = streak;
  if (elMinutos) elMinutos.textContent = minutos;
  if (elLogros)  elLogros.textContent  = `${logros.length}/${LOGROS_DEF.length}`;
}

function mostrarNotificacionLogro(id) {
  const def = LOGROS_DEF.find(l => l.id === id);
  if (!def) return;
  playSound('logro');
  setTimeout(() => {
    addBroMessage(`🏅 ¡LOGRO DESBLOQUEADO! ${def.badge} "${def.texto}" — ¡Literal de locos, Mario! 🔥`);
  }, 1000);
}

// ─── TAREAS ───────────────────────────────────
function initTasks() {
  state.totalTasks = document.querySelectorAll('.tarea-check').length;
}

function onTareaChange() {
  playSound('tarea_check');
  const checks = document.querySelectorAll('.tarea-check');
  state.doneTasks = Array.from(checks).filter(c => c.checked).length;
  updateProgresoUI(state.doneTasks, state.totalTasks);

  // Guardar progreso
  saveProgress({
    fecha: todayKey(),
    tareasCompletadas: state.doneTasks,
    tareasTotal: state.totalTasks,
    objetivoCumplido: state.doneTasks === state.totalTasks,
  });

  // Si completa todo
  if (state.doneTasks === state.totalTasks && state.totalTasks > 0) {
    // Logros de tareas
    desbloquearLogro('primer_dia');

    // Comprobar si Matemáticas está marcada
    const checks = document.querySelectorAll('.tarea-check');
    const nombres = document.querySelectorAll('.tarea-nombre');
    checks.forEach((c, i) => {
      if (c.checked && nombres[i] && nombres[i].textContent.includes('Matemáticas')) {
        desbloquearLogro('jefe_mates');
      }
    });

    // Actualizar racha
    const ayer = getYesterdayProgress();
    const streakActual = getStreak();
    const nuevaRacha = (ayer && ayer.objetivoCumplido) ? streakActual + 1 : 1;
    saveStreak(nuevaRacha);

    // Logros de racha
    if (nuevaRacha >= 3) desbloquearLogro('racha_3');
    if (nuevaRacha >= 7) desbloquearLogro('racha_7');

    setTimeout(() => showWinScreen(), 800);
  }
}

function updateProgresoUI(done, total) {
  const pct = total > 0 ? (done / total) * 100 : 0;
  document.getElementById('progresoBarra').style.width = pct + '%';
  document.getElementById('progresoTexto').textContent = `${done} / ${total} tareas`;
}

// ─── TIMER POMODORO ───────────────────────────
function toggleTimer() {
  state.timerRunning ? pauseTimer() : startTimer();
}

function startTimer() {
  state.timerRunning = true;
  state.isStudying   = state.timerPhase === 'focus';
  updatePlayPause();
  updateSpotifyLock();
  playSound('timer_start');

  // Pedir permiso de notificaciones la primera vez
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  state.timerInterval = setInterval(() => {
    state.timerSeconds--;
    if (state.timerSeconds <= 0) onPhaseEnd();
    else updateTimerDisplay();
  }, 1000);
}

function pauseTimer() {
  state.timerRunning = false;
  clearInterval(state.timerInterval);
  state.timerInterval = null;
  updatePlayPause();
}

function resetTimer() {
  pauseTimer();
  state.timerPhase   = 'focus';
  state.timerSeconds = FOCUS_TIME;
  state.isStudying   = false;
  updateTimerDisplay();
  updateTimerTheme();
  updateSpotifyLock();
}

function skipPhase() { pauseTimer(); onPhaseEnd(); }

function onPhaseEnd() {
  clearInterval(state.timerInterval);
  state.timerInterval = null;
  state.timerRunning  = false;

  playSound('timer_end');
  if (state.timerPhase === 'focus') {
    state.cyclesDone++;
    updateCycleDots();
    state.timerPhase   = 'break';
    state.timerSeconds = BREAK_TIME;
    state.isStudying   = false;
    desbloquearLogro('velocista');

    // Acumular minutos estudiados
    const totalMin = parseInt(localStorage.getItem('bro_total_minutos') || '0');
    localStorage.setItem('bro_total_minutos', totalMin + 15);
    updateStats();

    addBroMessage(breakMessage());
  } else {
    state.timerPhase   = 'focus';
    state.timerSeconds = FOCUS_TIME;
    addBroMessage(focusMessage());
  }

  updateTimerDisplay();
  updateTimerTheme();
  updatePlayPause();
  updateSpotifyLock();
  sendDesktopNotification(state.timerPhase);
}

function updateTimerDisplay() {
  const mins = Math.floor(state.timerSeconds / 60);
  const secs = state.timerSeconds % 60;
  document.getElementById('timerDigits').textContent =
    `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;

  const total  = state.timerPhase === 'focus' ? FOCUS_TIME : BREAK_TIME;
  const offset = ARC_TOTAL * (1 - state.timerSeconds / total);
  document.getElementById('timerArc').style.strokeDashoffset = offset;
}

function updateTimerTheme() {
  const isBreak = state.timerPhase === 'break';
  const label   = document.getElementById('timerModeLabel');
  const arc     = document.getElementById('timerArc');
  label.textContent = isBreak ? 'DESCANSO' : 'ENFOQUE';
  label.classList.toggle('descanso', isBreak);
  arc.classList.toggle('descanso', isBreak);
}

function updatePlayPause() {
  document.getElementById('playIcon').style.display  = state.timerRunning ? 'none'  : 'block';
  document.getElementById('pauseIcon').style.display = state.timerRunning ? 'block' : 'none';
}

function updateCycleDots() {
  document.querySelectorAll('.cycle-dot').forEach((dot, i) => {
    if (i < state.cyclesDone) { dot.classList.remove('active'); dot.classList.add('done'); }
    else if (i === state.cyclesDone) dot.classList.add('active');
  });
}

function updateSpotifyLock() {
  const lock = document.getElementById('spotifyLock');
  (state.isStudying && state.timerRunning)
    ? lock.classList.add('active')
    : lock.classList.remove('active');
}

// ─── MENSAJES TIMER ───────────────────────────
function breakMessage() {
  const msgs = [
    '¡Bloque terminado, crack! 5 min de descanso. Música desbloqueada. Te lo has ganado 🎵',
    '¡Eso es lo que hay! Descansa 5 min, después volvemos más fuertes. Dale a la música.',
    '¡Renta pura! Levántate, estira, respira. En 5 min arrancamos el siguiente bloque 🤙',
  ];
  return msgs[Math.floor(Math.random() * msgs.length)];
}

function focusMessage() {
  const msgs = [
    '¡Vamos al siguiente! Música bloqueada, modo bestia activado. 15 min y rompemos. ¿Dale?',
    'Descanso finiquitado, bro. Ahora toca concentrarse. Tú puedes con esto, literal.',
    '¡A por el siguiente bloque! Enfocado, chill, sin distracciones. 15 min de nada.',
  ];
  return msgs[Math.floor(Math.random() * msgs.length)];
}

// ─── NOTIFICACIONES ───────────────────────────
function sendDesktopNotification(nextPhase) {
  if (!('Notification' in window)) return;
  const msg = nextPhase === 'break'
    ? '🎵 ¡Bloque completado! 5 min de descanso, mereces la música.'
    : '🚨 ¡Al lío, bro! Se acabó el descanso. A por el siguiente bloque.';

  if (Notification.permission === 'granted') {
    new Notification('Bro Dashboard', { body: msg, icon: '🛴' });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(p => {
      if (p === 'granted') new Notification('Bro Dashboard', { body: msg, icon: '🛴' });
    });
  }
}

// ─── WIN SCREEN ───────────────────────────────
function showWinScreen() {
  desbloquearLogro('rey_parque');
  playSound('win');
  document.getElementById('winScreen').classList.add('active');
}

function closeWinScreen() {
  document.getElementById('winScreen').classList.remove('active');
}
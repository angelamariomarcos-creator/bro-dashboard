/* =============================================
   BRO DASHBOARD — MAIN.JS v2
   Mes 2: persistencia, bonus, memoria de Bro
   Mes 3: control real de Spotify (pausa automática)
   Mes 3b: pedir ejercicios directamente desde Misiones
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

// ─── MÚSICA — radio integrada (SomaFM) + modo YouTube externo ─
// El <audio> es 100% controlable por JS, sin bugs de iframes ni APIs externas.
let autoPausedByTimer = false;

function pauseSpotify() {
  const audio = document.getElementById('lofiAudio');
  if (audio && !audio.paused) {
    audio.pause();
    autoPausedByTimer = true;
  }
}

function playSpotify() {
  const audio = document.getElementById('lofiAudio');
  if (audio && autoPausedByTimer) {
    audio.play().catch(() => {}); // si el navegador bloquea autoplay, no rompe nada
    autoPausedByTimer = false;
  }
}

function selectMusicMode(mode) {
  const panelRelax   = document.getElementById('panelRelax');
  const panelYoutube = document.getElementById('panelYoutube');
  const tabRelax     = document.getElementById('tabRelax');
  const tabYoutube   = document.getElementById('tabYoutube');

  if (mode === 'relax') {
    panelRelax.style.display   = 'flex';
    panelYoutube.style.display = 'none';
    tabRelax.classList.add('active');
    tabYoutube.classList.remove('active');
  } else {
    panelRelax.style.display   = 'none';
    panelYoutube.style.display = 'flex';
    tabRelax.classList.remove('active');
    tabYoutube.classList.add('active');
    // Si Mario se va a YouTube, paramos la radio interna para que no sumen las dos
    const audio = document.getElementById('lofiAudio');
    if (audio && !audio.paused) audio.pause();
  }
}

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
  renderBoss();
  renderStatsChart();
  updateComodinIndicator();
  initMasteryButtons();
  updateAvatarBadge();
  renderCoins();
  initColorGuardado();
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

// ─── VERIFICACIÓN REAL DE TRABAJO POR ASIGNATURA ─
// Cuenta cuántas veces se ha marcado esa tarea como hecha de verdad,
// para que "dominado" no sea solo lo que Mario diga, sino algo currado.
const MASTERY_DOMINADO_MINIMO = 3;

function getSubjectCompletions() {
  return JSON.parse(localStorage.getItem('bro_subject_completions') || '{}');
}

function saveSubjectCompletions(data) {
  localStorage.setItem('bro_subject_completions', JSON.stringify(data));
}

function trackSubjectCompletion(checkbox) {
  if (!checkbox.checked) return;
  const item    = checkbox.closest('.tarea-item');
  const subject = item ? item.querySelector('.tarea-nombre').textContent : null;
  if (!subject) return;

  const completions = getSubjectCompletions();
  completions[subject] = (completions[subject] || 0) + 1;
  saveSubjectCompletions(completions);
}



// ─── NIVEL DE DOMINIO POR ASIGNATURA ──────────
// Sin presión, sin examen: Mario lo marca cuando quiere.
const MASTERY_ORDER = ['sin_empezar', 'en_progreso', 'dominado'];
const MASTERY_EMOJI = { sin_empezar: '❔', en_progreso: '🙂', dominado: '😎' };
const MASTERY_LABEL = { sin_empezar: 'Sin empezar', en_progreso: 'Mejorando', dominado: '¡Lo domino!' };

function getMastery() {
  return JSON.parse(localStorage.getItem('bro_mastery') || '{}');
}

function saveMastery(mastery) {
  localStorage.setItem('bro_mastery', JSON.stringify(mastery));
}

function cycleMastery(btn) {
  const subject  = btn.dataset.subject;
  const mastery  = getMastery();
  const actual   = mastery[subject] || 'sin_empezar';
  const idx      = MASTERY_ORDER.indexOf(actual);
  const nuevo    = MASTERY_ORDER[(idx + 1) % MASTERY_ORDER.length];

  if (nuevo === 'dominado') {
    const completions = getSubjectCompletions()[subject] || 0;
    if (completions < MASTERY_DOMINADO_MINIMO) {
      const faltan = MASTERY_DOMINADO_MINIMO - completions;
      addBroMessage(`Ey Mario, para decir que dominas ${subject} de verdad necesitas completarla ${faltan} ${faltan === 1 ? 'vez' : 'veces'} más marcándola como hecha. Nada de trampas, bro — currando se nota más que diciéndolo 💪`);
      return; // no avanzamos, se queda en "en progreso"
    }
  }

  mastery[subject] = nuevo;
  saveMastery(mastery);
  applyMasteryStyle(btn, nuevo);

  if (nuevo === 'dominado') {
    playSound('logro');
    addBroMessage(`😎 ¡Toma ya! ${subject} dominado de verdad, Mario. Te lo has currado. ¡Qué crack!`);
  }
}

function applyMasteryStyle(btn, estado) {
  btn.classList.remove('mastery-progreso', 'mastery-dominado');
  if (estado === 'en_progreso') btn.classList.add('mastery-progreso');
  if (estado === 'dominado')    btn.classList.add('mastery-dominado');
  btn.textContent = MASTERY_EMOJI[estado];
  btn.title = `${MASTERY_LABEL[estado]} — toca para cambiar`;
}

function initMasteryButtons() {
  const mastery = getMastery();
  document.querySelectorAll('.mastery-btn').forEach(btn => {
    const estado = mastery[btn.dataset.subject] || 'sin_empezar';
    applyMasteryStyle(btn, estado);
  });
}



// ─── COMODÍN DE RACHA — 1 al mes ──────────────
function currentMonthKey() {
  return new Date().toISOString().slice(0, 7); // 'YYYY-MM'
}

function comodinDisponible() {
  const usadoEnMes = localStorage.getItem('bro_comodin_mes');
  return usadoEnMes !== currentMonthKey();
}

function usarComodin() {
  localStorage.setItem('bro_comodin_mes', currentMonthKey());
  updateComodinIndicator();
}

function updateComodinIndicator() {
  const badge = document.getElementById('comodinBadge');
  if (!badge) return;
  badge.style.display = comodinDisponible() ? 'inline-flex' : 'none';
}

function saveStreak(n) {
  localStorage.setItem('bro_streak', String(n));
  document.getElementById('streakNum').textContent = n;
  updateAvatarBadge();
}

// ─── EVOLUCIÓN VISUAL DEL AVATAR ───────────────
// Sin necesitar imágenes nuevas: una insignia que va cambiando
// según la racha y los logros conseguidos, para que se note el progreso.
function updateAvatarBadge() {
  const badge  = document.getElementById('avatarBadge');
  if (!badge) return;

  const streak = getStreak();
  const logros = getLogros().length;

  let emoji = null;
  if (logros >= 6)      emoji = '👑'; // todos los logros conseguidos
  else if (streak >= 7)  emoji = '🕶️'; // semana completa
  else if (streak >= 3)  emoji = '🧢'; // 3 días seguidos

  if (emoji) {
    badge.textContent = emoji;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

function buildBroContext() {
  let ctx = '';

  const ayer = getYesterdayProgress();
  if (ayer) {
    ctx += '\n\n[Contexto de ayer:';
    if (ayer.objetivoCumplido) {
      ctx += ` Mario completó todas sus tareas (${ayer.tareasCompletadas}/${ayer.tareasTotal}). Hoy tiene bonus de -15 min.`;
    } else {
      ctx += ` Mario completó ${ayer.tareasCompletadas} de ${ayer.tareasTotal} tareas. No llegó al objetivo.`;
    }
    ctx += ` Racha actual: ${getStreak()} días seguidos.]`;
  }

  const bosses = getBosses().filter(b => b.hp > 0);
  if (bosses.length > 0) {
    const listado = bosses.map(b => `"${b.name}" (${b.hp}/${b.hpMax} HP)`).join(', ');
    ctx += `\n\n[Jefes de examen activos: ${listado}. Cada bloque de estudio de 15 min completado hace 1 punto de daño a TODOS los jefes activos a la vez. Anima a Mario a hacer bloques, y menciona alguno de los jefes por su nombre de vez en cuando.]`;
  }

  const mastery = getMastery();
  const asignaturasConDatos = Object.keys(mastery);
  if (asignaturasConDatos.length > 0) {
    const resumen = asignaturasConDatos.map(s => `${s}: ${MASTERY_LABEL[mastery[s]]}`).join(', ');
    ctx += `\n\n[Nivel de dominio que Mario dice tener por asignatura: ${resumen}. Si propones un tema, prioriza asignaturas en "Sin empezar" o "Mejorando" antes que las que ya domina. Si una asignatura está en "¡Lo domino!", no insistas en ella salvo que Mario la mencione él mismo — mejor felicítale por eso brevemente si sale el tema.]`;
  }

  return ctx;
}

// ─── INIT DESDE STORAGE ───────────────────────
function loadFromStorage() {
  const today = todayKey();
  const saved = JSON.parse(localStorage.getItem('bro_day_' + today) || 'null');
  const prog  = getProgress();
  const streak = getStreak();

  document.getElementById('streakNum').textContent = streak || 0;

  const ayer = getYesterdayProgress();
  if (ayer && ayer.objetivoCumplido && !localStorage.getItem('bro_bonus_shown_' + today)) {
    state.bonusToday = true;
    localStorage.setItem('bro_bonus_shown_' + today, '1');
  }

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

// ─── PEDIR EJERCICIOS DESDE MISIONES ──────────
// Al pinchar el nombre de una asignatura en "Misiones de hoy", se lanza
// automáticamente en el chat la misma petición que Mario escribiría a mano.
// Reutiliza el mismo mecanismo (addUserMessage + getBroReply + addBroMessage).
const NUM_EJERCICIOS_MISIONES = 3;

async function pedirEjerciciosDe(subject) {
  const chatInput = document.getElementById('chatInput');
  if (!chatInput || chatInput.disabled) {
    // Bro todavía no está disponible: falta elegir el mood de hoy
    return;
  }

  const texto = `Bro, ponme ${NUM_EJERCICIOS_MISIONES} ejercicios de ${subject} para practicar ahora mismo, con la solución al final de cada uno`;
  addUserMessage(texto);
  const reply = await getBroReply(texto);
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
  if (logros.includes(id)) return false;
  logros.push(id);
  localStorage.setItem('bro_logros', JSON.stringify(logros));
  renderLogros();
  mostrarNotificacionLogro(id);
  updateAvatarBadge();
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

// ─── SORPRESAS RANDOM — para que no sea 100% predecible ─
function maybeSorpresa() {
  if (Math.random() > 0.2) return; // ~1 de cada 5 bloques
  const sorpresas = [
    '🎁 Ey, esto no estaba en el plan pero te lo has ganado: eres un crack, Mario.',
    '👀 Psst... nadie te lo va a decir, pero vas mejor que ayer. Sigue así.',
    '🔥 Bonus random: la próxima ronda de descanso, 2 min extra. Te lo has currado.',
    '🎲 Suerte del día: hoy Bro está especialmente orgulloso de ti. No sé por qué, pero sí.',
  ];
  const msg = sorpresas[Math.floor(Math.random() * sorpresas.length)];
  setTimeout(() => addBroMessage(msg), 1800);
}

// ─── ESTADÍSTICAS — gráfico semanal (Chart.js) ─
let statsChartInstance = null;

function getUltimos7Dias() {
  const dias = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    const minutos = parseInt(localStorage.getItem('bro_minutos_' + key) || '0');
    const labelDia = d.toLocaleDateString('es-ES', { weekday: 'short' });
    dias.push({
      label: labelDia.charAt(0).toUpperCase() + labelDia.slice(1).replace('.', ''),
      minutos,
    });
  }
  return dias;
}

function renderStatsChart() {
  const canvas = document.getElementById('statsChart');
  if (!canvas || typeof Chart === 'undefined') return;

  const datos = getUltimos7Dias();

  if (statsChartInstance) {
    statsChartInstance.data.labels = datos.map(d => d.label);
    statsChartInstance.data.datasets[0].data = datos.map(d => d.minutos);
    statsChartInstance.update();
    return;
  }

  statsChartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: datos.map(d => d.label),
      datasets: [{
        data: datos.map(d => d.minutos),
        backgroundColor: '#FF6B35',
        borderRadius: 6,
        maxBarThickness: 18,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          beginAtZero: true,
          min: 0,
          suggestedMax: 60,
          ticks: { stepSize: 15, color: 'rgba(26,26,46,0.5)', font: { size: 10 } },
          grid: { color: 'rgba(26,26,46,0.08)' },
        },
        y: {
          ticks: { color: 'rgba(26,26,46,0.6)', font: { size: 11, weight: '700' } },
          grid: { display: false },
        },
      },
    },
  });
}

// ─── JEFES DE EXAMEN — barra HP (varios a la vez) ─
function getBosses() {
  return JSON.parse(localStorage.getItem('bro_bosses') || '[]');
}

function saveBosses(bosses) {
  localStorage.setItem('bro_bosses', JSON.stringify(bosses));
}

function renderBoss() {
  const bosses = getBosses();
  const lista  = document.getElementById('bossesList');
  if (!lista) return;

  if (bosses.length === 0) {
    lista.innerHTML = `<p class="boss-empty">Sin jefes activos</p>`;
    return;
  }

  lista.innerHTML = bosses.map(b => {
    const pct = b.hpMax > 0 ? (b.hp / b.hpMax) * 100 : 0;
    return `
      <div class="boss-row">
        <div class="boss-row-header">
          <span class="boss-row-name">${escapeHtml(b.name)}</span>
          <button type="button" class="boss-delete-btn" onclick="eliminarJefe(${b.id})" title="Eliminar jefe" style="border:none;background:rgba(26,26,46,0.1);border-radius:50%;width:18px;height:18px;font-size:11px;line-height:1;cursor:pointer;color:rgba(26,26,46,0.5);flex-shrink:0;">✕</button>
          <span class="boss-row-hp">${Math.max(b.hp, 0)}/${b.hpMax} HP</span>
        </div>
        <div class="boss-hp-wrap">
          <div class="boss-hp-bar" style="width:${Math.max(pct, 0)}%"></div>
        </div>
      </div>`;
  }).join('');
}

function nuevoJefe() {
  const name = prompt('Nombre del examen/jefe (ej: "Jefe de Mates — Ecuaciones"):');
  if (!name) return;

  let hp = parseInt(prompt('¿Cuántos bloques de estudio de 15 min necesita Mario para prepararlo? (esa será su HP)', '6'));
  if (!hp || hp < 1) hp = 6;

  const bosses = getBosses();
  bosses.push({ id: Date.now(), name: name.trim(), hp, hpMax: hp });
  saveBosses(bosses);
  renderBoss();
  addBroMessage(`👾 ¡Nuevo jefe detectado! "${name.trim()}" con ${hp} HP. Cada bloque de estudio le hace daño, Mario. ¡Vamos a por él!`);
}

function eliminarJefe(id) {
  const bosses = getBosses();
  const jefe = bosses.find(b => b.id === id);
  if (!jefe) return;

  const confirmar = confirm(`¿Eliminar "${jefe.name}"? Se borrará sin más, no cuenta como derrotado.`);
  if (!confirmar) return;

  const nuevos = bosses.filter(b => b.id !== id);
  saveBosses(nuevos);
  renderBoss();
}

function danarJefe() {
  const bosses = getBosses();
  if (bosses.length === 0) return;

  const derrotados = [];
  bosses.forEach(b => {
    if (b.hp > 0) {
      b.hp -= 1;
      if (b.hp <= 0) derrotados.push(b);
    }
  });

  saveBosses(bosses);
  renderBoss();

  if (derrotados.length > 0) {
    setTimeout(() => showBossDefeated(derrotados), 600);
  }
}

function showBossDefeated(derrotados) {
  playSound('win');
  derrotados.forEach(b => {
    addBroMessage(`👾💥 ¡JEFE DERROTADO! Has machacado a "${b.name}", Mario. ¡De locos, literal! 🔥`);
  });

  // Quitamos los derrotados, dejamos el resto de jefes activos intactos
  const idsDerrotados = derrotados.map(b => b.id);
  const bosses = getBosses().filter(b => !idsDerrotados.includes(b.id));
  saveBosses(bosses);
  renderBoss();
}


// ─── MONEDAS — ganadas por bloque, gastables en personalizar ─
function getCoins() {
  return parseInt(localStorage.getItem('bro_coins') || '0');
}

function saveCoins(n) {
  localStorage.setItem('bro_coins', String(n));
  renderCoins();
}

function awardCoins(n) {
  saveCoins(getCoins() + n);
}

function renderCoins() {
  const el = document.getElementById('coinsDisplay');
  if (el) el.textContent = getCoins();
}

const COLOR_OPTIONS = {
  naranja: { hex: '#FF6B35', dim: '#CC5529', costo: 0 },
  azul:    { hex: '#3B82F6', dim: '#2563EB', costo: 50 },
  verde:   { hex: '#2ECC71', dim: '#25A85B', costo: 50 },
  morado:  { hex: '#9B59B6', dim: '#7D4593', costo: 50 },
  rosa:    { hex: '#EC4899', dim: '#D63384', costo: 50 },
};

function getColoresDesbloqueados() {
  return JSON.parse(localStorage.getItem('bro_colores_desbloqueados') || '["naranja"]');
}

function personalizarColor() {
  const desbloqueados = getColoresDesbloqueados();
  const coins = getCoins();

  const lista = Object.keys(COLOR_OPTIONS).map(key => {
    const c = COLOR_OPTIONS[key];
    const estado = desbloqueados.includes(key) ? '(ya tienes)' : `(${c.costo} monedas)`;
    return `${key} ${estado}`;
  }).join('\n');

  const elegido = prompt(`Tienes 🪙 ${coins} monedas.\n\nColores disponibles:\n${lista}\n\nEscribe el nombre del color que quieres:`);
  if (!elegido) return;

  const key = elegido.trim().toLowerCase();
  const color = COLOR_OPTIONS[key];
  if (!color) {
    alert('Ese color no existe. Elige uno de la lista.');
    return;
  }

  if (!desbloqueados.includes(key)) {
    if (coins < color.costo) {
      alert(`Te faltan ${color.costo - coins} monedas para desbloquear ${key}.`);
      return;
    }
    saveCoins(coins - color.costo);
    desbloqueados.push(key);
    localStorage.setItem('bro_colores_desbloqueados', JSON.stringify(desbloqueados));
  }

  aplicarColorAcento(key);
  localStorage.setItem('bro_color_actual', key);
  addBroMessage(`🎨 ¡Nuevo estilo! Bro Dashboard ahora en ${key}. A tu gusto, bro.`);
}

function aplicarColorAcento(key) {
  const color = COLOR_OPTIONS[key];
  if (!color) return;
  document.documentElement.style.setProperty('--orange', color.hex);
  document.documentElement.style.setProperty('--orange-dim', color.dim);
}

function initColorGuardado() {
  const key = localStorage.getItem('bro_color_actual');
  if (key) aplicarColorAcento(key);
}


function initTasks() {
  state.totalTasks = document.querySelectorAll('.tarea-check').length;
}

function onTareaChange() {
  playSound('tarea_check');
  const checks = document.querySelectorAll('.tarea-check');
  state.doneTasks = Array.from(checks).filter(c => c.checked).length;
  updateProgresoUI(state.doneTasks, state.totalTasks);

  saveProgress({
    fecha: todayKey(),
    tareasCompletadas: state.doneTasks,
    tareasTotal: state.totalTasks,
    objetivoCumplido: state.doneTasks === state.totalTasks,
  });

  // Reconocer el progreso parcial, no solo el "todo o nada"
  if (state.doneTasks > 0 && state.doneTasks < state.totalTasks) {
    const flagKey = `bro_partial_msg_${todayKey()}_${state.doneTasks}`;
    if (!localStorage.getItem(flagKey)) {
      localStorage.setItem(flagKey, '1');
      const mensajesParciales = {
        1: ['¡Ya está, una menos! Arrancar es lo más difícil, y ya lo hiciste 💪', '¡Eso es! Primera tarea fuera. Vas bien, bro.'],
        2: ['¡Dos de tres! Ya casi lo tienes, un empujón más y listo 🔥', '¡Venga que ya casi está! Una más y hoy es un día ganado.'],
      };
      const opciones = mensajesParciales[state.doneTasks];
      if (opciones) {
        setTimeout(() => addBroMessage(opciones[Math.floor(Math.random() * opciones.length)]), 500);
      }
    }
  }

  if (state.doneTasks === state.totalTasks && state.totalTasks > 0) {
    desbloquearLogro('primer_dia');

    const checks = document.querySelectorAll('.tarea-check');
    const nombres = document.querySelectorAll('.tarea-nombre');
    checks.forEach((c, i) => {
      if (c.checked && nombres[i] && nombres[i].textContent.includes('Matemáticas')) {
        desbloquearLogro('jefe_mates');
      }
    });

    const ayer = getYesterdayProgress();
    const streakActual = getStreak();
    let nuevaRacha;
    let comodinUsado = false;

    if (ayer && ayer.objetivoCumplido) {
      nuevaRacha = streakActual + 1;
    } else if (streakActual > 0 && comodinDisponible()) {
      // Falló ayer, pero tiene comodín disponible este mes: se salva la racha
      nuevaRacha = streakActual + 1;
      usarComodin();
      comodinUsado = true;
    } else {
      nuevaRacha = 1;
    }

    saveStreak(nuevaRacha);

    if (comodinUsado) {
      setTimeout(() => {
        addBroMessage('🛡️ ¡Comodín usado! Se te perdona el día que fallaste, tu racha sigue viva. Solo tienes uno al mes, así que a cuidarla, bro.');
      }, 1200);
    }

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

  // Si arrancamos un bloque de ENFOQUE, paramos la música automáticamente
  if (state.timerPhase === 'focus') {
    pauseSpotify();
  }

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
  updateSpotifyLock();
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
    danarJefe();
    awardCoins(10);

    const totalMin = parseInt(localStorage.getItem('bro_total_minutos') || '0');
    localStorage.setItem('bro_total_minutos', totalMin + 15);

    const minutosHoyKey = 'bro_minutos_' + todayKey();
    const minutosHoy = parseInt(localStorage.getItem(minutosHoyKey) || '0');
    localStorage.setItem(minutosHoyKey, minutosHoy + 15);

    renderStatsChart();
    updateStats();

    addBroMessage(breakMessage());
    maybeSorpresa();
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
  const shouldBlock = state.isStudying && state.timerRunning;

  lock.classList.toggle('active', shouldBlock);

  if (shouldBlock) {
    pauseSpotify();
  } else {
    playSpotify();
  }
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

// ─── EXPORTAR PROGRESO — backup manual ────────
function exportarProgreso() {
  const backup = {};

  // Recopilamos todas las claves que empiezan por 'bro_' (todo lo nuestro)
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('bro_')) {
      backup[key] = localStorage.getItem(key);
    }
  }

  backup._exportadoEl = new Date().toISOString();

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `bro-dashboard-backup-${todayKey()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  addBroMessage('💾 ¡Backup descargado, Mario! Guárdalo en un sitio seguro por si acaso.');
}

function importarProgreso(input) {
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const backup = JSON.parse(e.target.result);
      const claves = Object.keys(backup).filter(k => k.startsWith('bro_'));

      if (claves.length === 0) {
        alert('Ese archivo no parece un backup válido de Bro Dashboard.');
        return;
      }

      const confirmar = confirm(
        `Vas a restaurar ${claves.length} datos guardados. Esto sobreescribirá tu progreso actual. ¿Seguro?`
      );
      if (!confirmar) return;

      claves.forEach(k => localStorage.setItem(k, backup[k]));

      alert('¡Progreso restaurado! La página se va a recargar.');
      location.reload();

    } catch (err) {
      alert('No se pudo leer ese archivo. ¿Seguro que es un backup exportado desde aquí?');
      console.error('Error importando backup:', err);
    }
  };
  reader.readAsText(file);
  input.value = ''; // permite volver a seleccionar el mismo archivo si hace falta
}
// =============================================
//   BRO DASHBOARD — SERVER.JS
//   Backend Express + Gemini 2.0 Flash
// =============================================

const express = require('express');
const cors    = require('cors');
const path    = require('path');
require('dotenv').config();

const { GoogleGenerativeAI } = require('@google/generative-ai');

const app  = express();
// Fallback si .env no carga
if (!process.env.GEMINI_API_KEY) {
  process.env.GEMINI_API_KEY = 'TU_API_KEY_AQUI';
  process.env.PORT = '3003';
}

const PORT = process.env.PORT || 3003;

// ─── MIDDLEWARE ───────────────────────────────
app.use(cors({
  origin: function(origin, callback) {
    callback(null, true); // acepta cualquier origen
  },
  credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname))); // sirve el frontend

// ─── GEMINI SETUP ─────────────────────────────
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

// ─── SYSTEM PROMPT DE BRO ─────────────────────
const BRO_SYSTEM_PROMPT = `Eres "Bro", el tutor y colega mayor de Mario, un alumno de 2º de ESO de 14 años.
No eres un profesor formal, no juzgas, no echas sermones.
Tu objetivo absoluto es motivarle a estudiar en bloques de 15 minutos sin que le dé pereza.

Personalidad y tono:
- Extremadamente empático, cercano y leal con Mario.
- Usa jerga juvenil española de forma natural y espontánea: "literal", "de locos", "ff", "renta", "vibras", "chill", "hacer un fly", "planchar trucos", "quemado", "frito".
- Llama a Mario por su nombre de vez en cuando, no siempre.
- Nunca uses lenguaje formal ni academico.
- Mensajes CORTOS: máximo 2-3 frases. Nunca escribas párrafos largos.
- Termina siempre con una llamada a la acción clara o una pregunta motivadora.
- Si Mario dice que terminó una tarea, felicítale con energía y pídele que marque el checkbox.
- Si Mario dice que no puede o tiene pereza, no le regañes. Dale un empujón pequeño: "solo 15 min bro".
- Si Mario habla de la scooter o el parque, dile que se lo ha ganado cuando termine.

Adaptación por estado de ánimo:
- Si estado = "verde" (A tope): motívale al máximo, habla del bonus de mañana, dale caña.
- Si estado = "amarillo" (Modo avión): tranquilo pero constante, un bloque cada vez.
- Si estado = "rojo" (KO/Frito): rebaja la exigencia totalmente. "Hacemos lo más fácil, 10 min y a la calle".`;

// ─── ENDPOINT CHAT ────────────────────────────
app.post('/bro-chat', async (req, res) => {
  const { message, mood, history } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Mensaje vacío' });
  }

  try {
    // Construir prompt con contexto de mood e historial
    const moodMap = {
      verde:    'A tope (🟢) — con mucha energía',
      amarillo: 'Modo avión (🟡) — ni fu ni fa',
      rojo:     'KO/Frito (🔴) — muy cansado',
    };

    const moodContext = mood
      ? `\n\n[Estado de ánimo de Mario hoy: ${moodMap[mood] || 'desconocido'}]`
      : '';

    const systemWithMood = BRO_SYSTEM_PROMPT + moodContext;

    // Construir historial de chat para Gemini
    // Gemini requiere que el primer mensaje sea siempre del user
    let chatHistory = (history || []).map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    // Eliminar mensajes de model al inicio hasta encontrar uno de user
    while (chatHistory.length > 0 && chatHistory[0].role === 'model') {
      chatHistory.shift();
    }

    const chat = model.startChat({
      history: chatHistory,
      systemInstruction: systemWithMood,
    });

    const result = await chat.sendMessage(message);
    const text   = result.response.text();

    res.json({ reply: text });

  } catch (error) {
    console.error('Error Gemini:', error.message);
    res.status(500).json({
      reply: 'Ey Mario, me he colgado un momento. Mándame otro mensaje bro 🤙'
    });
  }
});

// ─── HEALTH CHECK ─────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', model: 'gemini-2.0-flash' });
});

// ─── START ────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🛴 Bro Dashboard server corriendo en http://localhost:${PORT}`);
  console.log(`   Gemini 2.0 Flash listo\n`);
});
// =============================================
//   BRO DASHBOARD — SERVER.JS
//   Backend Express + Groq (Llama 4)
// =============================================

const express = require('express');
const cors    = require('cors');
const path    = require('path');
require('dotenv').config();

const app  = express();
const PORT = process.env.PORT || 3002;

// ─── MIDDLEWARE ───────────────────────────────
app.use(cors({
  origin: function(origin, callback) { callback(null, true); },
  credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ─── SYSTEM PROMPT DE BRO ─────────────────────
const BRO_SYSTEM_PROMPT = `Eres "Bro", el tutor y colega mayor de Mario, un alumno de 2º de ESO de 14 años.
No eres un profesor formal, no juzgas, no echas sermones.
Tu objetivo absoluto es motivarle a estudiar en bloques de 15 minutos sin que le dé pereza.

Personalidad y tono:
- Extremadamente empático, cercano y leal con Mario.
- Usa jerga juvenil española de forma natural: "literal", "de locos", "ff", "renta", "vibras", "chill", "hacer un fly", "planchar trucos".
- Llama a Mario por su nombre de vez en cuando.
- Nunca uses lenguaje formal ni académico.
- Mensajes CORTOS: máximo 2-3 frases. Nunca párrafos largos.
- Termina siempre con una llamada a la acción clara o una pregunta motivadora.
- Si Mario dice que terminó una tarea, felicítale con energía y pídele que marque el checkbox.
- Si Mario dice que no puede o tiene pereza, no le regañes. Dale un empujón pequeño.
- Si Mario habla de la scooter o el parque, dile que se lo ha ganado cuando termine.

Adaptación por estado de ánimo:
- Si estado = "verde" (A tope): motívale al máximo, habla del bonus de mañana, dale caña.
- Si estado = "amarillo" (Modo avión): tranquilo pero constante, un bloque cada vez.
- Si estado = "rojo" (KO/Frito): rebaja la exigencia totalmente. Solo 10 min de lo más fácil.`;

// ─── ENDPOINT CHAT ────────────────────────────
app.post('/bro-chat', async (req, res) => {
  const { message, mood, history, context } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Mensaje vacío' });
  }

  const moodMap = {
    verde:    'A tope (🟢) — con mucha energía',
    amarillo: 'Modo avión (🟡) — ni fu ni fa',
    rojo:     'KO/Frito (🔴) — muy cansado',
  };

  const systemWithMood = BRO_SYSTEM_PROMPT +
    (mood     ? `\n\n[Estado de ánimo de Mario hoy: ${moodMap[mood] || 'desconocido'}]` : '') +
    (context  ? context : '');

  // Historial limpio — primer mensaje siempre user
  let chatHistory = (history || []).map(msg => ({
    role: msg.role === 'assistant' ? 'assistant' : 'user',
    content: msg.content,
  }));
  while (chatHistory.length > 0 && chatHistory[0].role === 'assistant') {
    chatHistory.shift();
  }

  const messages = [
    ...chatHistory,
    { role: 'user', content: message }
  ];

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemWithMood },
          ...messages
        ],
        max_tokens: 150,
        temperature: 0.85,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Error Groq:', err);
      return res.status(500).json({
        reply: 'Ey Mario, me he colgado un momento. Mándame otro mensaje bro 🤙'
      });
    }

    const data = await response.json();
    const text = data.choices[0].message.content;
    res.json({ reply: text });

  } catch (error) {
    console.error('Error Groq:', error.message);
    res.status(500).json({
      reply: 'Ey Mario, me he colgado un momento. Mándame otro mensaje bro 🤙'
    });
  }
});

// ─── HEALTH CHECK ─────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', model: 'llama-3.3-70b-versatile' });
});

// ─── START ────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🛴 Bro Dashboard server corriendo en http://localhost:${PORT}`);
  console.log(`   Groq + Llama 3.3 70B listo\n`);
});
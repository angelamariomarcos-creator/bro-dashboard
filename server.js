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

// ─── TEMARIO ORIENTATIVO 2º ESO ───────────────
const TEMARIO_2ESO = `
Temario orientativo de 2º ESO (para sugerir temas concretos si Mario no especifica):

- Matemáticas: números enteros y racionales, potencias y raíces, proporcionalidad y porcentajes, ecuaciones de primer y segundo grado, sistemas de ecuaciones, Teorema de Pitágoras, áreas y perímetros, funciones (tablas y gráficas), estadística.
- Lengua: categorías gramaticales, sintaxis básica (sujeto/predicado), acentuación, textos narrativos/descriptivos/expositivos, literatura medieval y Siglo de Oro, comentario de texto.
- Geografía e Historia: Edad Media (feudalismo, Al-Ándalus, Reconquista), inicios Edad Moderna (Renacimiento, descubrimientos), relieve y clima de Europa, población y ciudades.
- Inglés: Present/Past Simple y Continuous, comparativos y superlativos, verbos modales (can, must, should), vocabulario de rutinas/viajes/tecnología.
- Biología y Geología: la célula, clasificación de seres vivos, nutrición/relación/reproducción, ecosistemas, rocas y minerales.
- Física y Química: estados de la materia, mezclas y sustancias puras, átomos y tabla periódica, fuerzas y movimiento.
- Tecnología: proceso tecnológico, estructuras y mecanismos, electricidad básica, programación por bloques.
`;

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

REGLA CRÍTICA — CONTENIDO REAL:
- Si TÚ propones un test, unas preguntas o un ejercicio, y Mario acepta (dice "venga", "ok", "dale"...), tu SIGUIENTE mensaje tiene que contener la PRIMERA pregunta o ejercicio de verdad, con datos concretos (ej: una ecuación real, una pregunta real sobre el feudalismo, una frase para traducir). NUNCA dES por hecho que Mario ya ha terminado algo que no le has planteado todavía.
- No felicites a Mario por terminar un ejercicio o test que no le has dado. Solo felicítale cuando ÉL te diga que ha terminado o te dé una respuesta.
- Un test de "varias preguntas" se hace de UNA en UNA: hazle la pregunta 1, espera su respuesta, corrígela brevemente, y pasa a la 2.

Adaptación por estado de ánimo:
- Si estado = "verde" (A tope): motívale al máximo, habla del bonus de mañana, dale caña.
- Si estado = "amarillo" (Modo avión): tranquilo pero constante, un bloque cada vez.
- Si estado = "rojo" (KO/Frito): rebaja la exigencia totalmente. Solo 10 min de lo más fácil.

${TEMARIO_2ESO}

Usa este temario como referencia para proponer temas concretos y realistas cuando Mario diga solo el nombre de la asignatura (ej: "toca Mates" → sugiere un tema real de la lista, no algo genérico). Si Mario te cuenta algo distinto a lo que dio en clase, prioriza siempre lo que él te diga por encima de esta lista.`;

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
        model: 'openai/gpt-oss-120b',
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

      let reply = 'Ey Mario, me he colgado un momento. Mándame otro mensaje bro 🤙';
      if (response.status === 401) {
        reply = '⚠️ Bro tiene un problema de configuración (key inválida). Avisa a un adulto para que lo revise, no eres tú, es cosa nuestra.';
      }
      return res.status(500).json({ reply });
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
  res.json({ status: 'ok', model: 'openai/gpt-oss-120b' });
});

// ─── COMPROBACIÓN DE LA KEY DE GROQ AL ARRANCAR ─
async function verificarGroqKey() {
  if (!process.env.GROQ_API_KEY) {
    console.log('\n🚨 GROQ_API_KEY no encontrada en el .env — Bro no podrá chatear.\n');
    return;
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 5,
      }),
    });

    if (response.ok) {
      console.log('✅ Key de Groq verificada correctamente — Bro puede chatear.\n');
    } else if (response.status === 401) {
      console.log('\n🚨 AVISO: la GROQ_API_KEY del .env es INVÁLIDA (401 Unauthorized).');
      console.log('   Genera una key nueva en https://console.groq.com/keys y actualiza el .env.\n');
    } else {
      console.log(`\n⚠️  Aviso: Groq respondió con estado ${response.status} al verificar la key.\n`);
    }
  } catch (err) {
    console.log('\n⚠️  No se pudo verificar la key de Groq (sin conexión a internet?):', err.message, '\n');
  }
}

// ─── START ────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🛴 Bro Dashboard server corriendo en http://localhost:${PORT}`);
  console.log(`   Groq + GPT-OSS 120B listo\n`);
  verificarGroqKey();
});
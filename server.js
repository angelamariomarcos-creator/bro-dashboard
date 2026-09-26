require('dotenv').config();

const express   = require('express');
const fs        = require('fs');
const path      = require('path');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');

const app  = express();
app.set('trust proxy', 1); // necesario en Render para que el rate-limit no falle con X-Forwarded-For
const PORT = process.env.PORT || 3000;

// El CSP por defecto de Helmet bloquea los onclick="..." inline, y toda la
// app de Bro está construida con ese patrón — lo desactivamos para no romper
// nada, manteniendo el resto de protecciones de Helmet activas.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// ─── CARGA DEL CURRÍCULO (2º ESO) ──────────────
let curriculo = {};
try {
  const rutaJson = path.join(__dirname, 'curriculo.json');
  let rawData = fs.readFileSync(rutaJson, 'utf8');

  // Eliminar BOM si estuviera presente para evitar que falle JSON.parse
  if (rawData.charCodeAt(0) === 0xFEFF) {
    rawData = rawData.slice(1);
  }

  curriculo = JSON.parse(rawData);
  console.log('✅ Base de Datos Curricular (2º ESO) cargada con éxito.');
} catch (err) {
  console.error('❌ Error al cargar curriculo.json:', err);
}

app.get('/api/curriculo', (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.json(curriculo);
});

// ─── RATE LIMIT PARA EL CHAT — evita abusos, 30 mensajes/15 min por IP ─
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    reply: '⚠️ Has enviado muchos mensajes seguidos. Tómate un respiro de unos minutos antes de seguir con Bro.'
  }
});

// ─── PERSONALIDAD Y CONTEXTO DE BRO ────────────
const TONO_POR_ANIMO = {
  verde:    'Mario viene hoy con energía a tope (🟢 "A tope"). Puedes ser más enérgico, directo y celebrar más.',
  amarillo: 'Mario está en "modo avión" hoy (🟡), tranquilo pero constante. Ve paso a paso, sin agobiar.',
  rojo:     'Mario viene cansado o agobiado hoy (🔴 "KO/Frito"). Sé breve, comprensivo, no le exijas de más de lo justo.',
};

function buildResumenCurriculo() {
  return Object.values(curriculo).map(asig => {
    const objetivos = Array.isArray(asig.objetivos) ? asig.objetivos.join('; ') : '';
    return `- ${asig.nombre} — ${asig.unidadActual}. Objetivos: ${objetivos}`;
  }).join('\n');
}

function buildSystemPrompt(mood, studentState, curso) {
  const cursoNum = curso || '2';
  let prompt = `Eres "Bro", el tutor de estudio de Mario, un alumno de 2º de ESO. Tu personalidad es la de un colega mayor con vibra skater: cercano, motivador y nada acartonado, pero riguroso con el contenido real.

REGLAS ESTRICTAS QUE NUNCA ROMPES:
- Una sola pregunta o ejercicio cada vez. Nunca propongas dos a la vez.
- Cuando propongas un ejercicio, NUNCA des la solución en el mismo mensaje. Espera a que Mario responda, o a que la pida explícitamente ("no sé", "ayuda", "dime la solución"...).
- Basa los ejercicios en el currículo real de 2º ESO que tienes abajo — usa la unidad y el objetivo correctos según la asignatura de la que se hable.
- Formato: texto plano o markdown simple (**negrita**). Para fórmulas matemáticas usa la sintaxis \\( ... \\) para en línea, o \\[ ... \\] para una fórmula destacada aparte.

CURRÍCULO DE 2º ESO (asignatura — unidad actual — objetivos):
${buildResumenCurriculo()}
`;

  if (cursoNum !== '2') {
    prompt += `\n\nAVISO IMPORTANTE: Mario ha seleccionado ${cursoNum}º de ESO en el dashboard, pero el currículo cargado arriba es SOLO de 2º ESO. NO inventes contenido de ${cursoNum}º ESO. Dile a Mario con naturalidad y sin agobiarle que de momento solo tienes el temario de 2º cargado, y sigue ayudándole con eso si quiere, o pregúntale qué necesita.`;
  }

  if (TONO_POR_ANIMO[mood]) {
    prompt += `\nESTADO DE ÁNIMO DE MARIO HOY: ${TONO_POR_ANIMO[mood]}`;
  }

  if (studentState) {
    if (studentState.ayer) {
      const a = studentState.ayer;
      prompt += a.bonus
        ? `\n\nAyer Mario completó todas sus tareas (${a.completadas}/${a.total}). Racha actual: ${a.racha} días seguidos.`
        : `\n\nAyer Mario completó ${a.completadas} de ${a.total} tareas. Racha actual: ${a.racha} días seguidos.`;
    }

    if (Array.isArray(studentState.bosses) && studentState.bosses.length > 0) {
      const listado = studentState.bosses.map(b => `"${b.name}" (${b.hp}/${b.hpMax} bloques)`).join(', ');
      prompt += `\n\nExámenes que Mario está preparando: ${listado}. Cada bloque de estudio de 15 min suma progreso en su preparación. Anímale a hacer bloques y menciona alguno de los exámenes por su nombre de vez en cuando.`;
    }

    if (studentState.mastery && Object.keys(studentState.mastery).length > 0) {
      const resumen = Object.entries(studentState.mastery).map(([k, v]) => `${k}: ${v}`).join(', ');
      prompt += `\n\nNivel de dominio que Mario dice tener por asignatura: ${resumen}. Prioriza asignaturas en "Sin empezar" o "Mejorando" antes que las que ya domina.`;
    }
  }

  return prompt;
}

// ─── ENDPOINT DE GENERACIÓN DE TEST DE PRÁCTICA ───────
app.post('/generar-quiz', aiLimiter, async (req, res) => {
  try {
    const { asignatura, tema } = req.body || {};

    if (!asignatura || !tema || typeof tema !== 'string') {
      return res.status(400).json({ error: 'Falta asignatura o tema.' });
    }

    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({ error: 'Falta la key de Groq.' });
    }

    const infoAsignatura = curriculo[asignatura];
    const nombreAsignatura = infoAsignatura ? infoAsignatura.nombre : asignatura;

    const promptQuiz = `Eres un generador de tests educativos para 2º de ESO. Genera EXACTAMENTE 10 preguntas tipo test sobre "${tema.trim()}" en la asignatura de ${nombreAsignatura}, con dificultad apropiada para un alumno de 13-14 años.

Responde ÚNICAMENTE con un JSON válido, sin texto adicional antes ni después, con esta estructura exacta:
{
  "preguntas": [
    {
      "pregunta": "texto de la pregunta",
      "opciones": ["opción A", "opción B", "opción C", "opción D"],
      "correcta": 0
    }
  ]
}

"correcta" es el índice (0-3) de la opción correcta dentro del array "opciones". Deben ser exactamente 10 preguntas, cada una con exactamente 4 opciones.`;

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [{ role: 'user', content: promptQuiz }],
        temperature: 0.6,
        max_tokens: 2500,
        response_format: { type: 'json_object' },
      }),
    });

    const data = await groqResponse.json();

    if (!groqResponse.ok) {
      console.error('❌ Error de Groq en /generar-quiz:', data);
      return res.status(500).json({ error: 'Bro no pudo generar el test. Inténtalo de nuevo.' });
    }

    let quizData;
    try {
      quizData = JSON.parse(data.choices[0].message.content);
    } catch (e) {
      console.error('❌ JSON inválido de Groq:', e, data.choices?.[0]?.message?.content);
      return res.status(500).json({ error: 'El test generado no tenía formato válido. Inténtalo de nuevo.' });
    }

    if (!Array.isArray(quizData.preguntas) || quizData.preguntas.length === 0) {
      return res.status(500).json({ error: 'El test generado estaba vacío. Inténtalo de nuevo.' });
    }

    const preguntasValidas = quizData.preguntas.filter(p =>
      p && typeof p.pregunta === 'string' &&
      Array.isArray(p.opciones) && p.opciones.length === 4 &&
      Number.isInteger(p.correcta) && p.correcta >= 0 && p.correcta <= 3
    );

    if (preguntasValidas.length === 0) {
      return res.status(500).json({ error: 'El test generado no tenía preguntas válidas. Inténtalo de nuevo.' });
    }

    res.json({ preguntas: preguntasValidas });

  } catch (err) {
    console.error('❌ Error en /generar-quiz:', err);
    res.status(500).json({ error: 'Bro se ha colgado generando el test. Inténtalo de nuevo.' });
  }
});

// ─── ENDPOINT DE CHAT — conecta con Groq ───────
app.post('/bro-chat', aiLimiter, async (req, res) => {
  try {
    const { message, mood, history, studentState, curso } = req.body || {};

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ reply: 'No me ha llegado ningún mensaje, bro.' });
    }

    if (curso && curso !== '2') {
      return res.status(200).json({
        reply: `🚧 Ey Mario, esto todavía es una demo — de momento Bro solo tiene cargado el temario de 2º de ESO.\n\nEn la versión en producción tendrás tu curso completo (${curso}º ESO) disponible. Mientras tanto, si quieres, prueba a seleccionar "2 ESO" arriba y le damos caña a ese temario 🤙`
      });
    }

    if (!process.env.GROQ_API_KEY) {
      console.error('❌ GROQ_API_KEY no configurada.');
      return res.status(500).json({ reply: '⚠️ Bro tiene un problema de configuración (falta la key). Avisa a un adulto, no eres tú, es cosa nuestra.' });
    }

    const systemPrompt = buildSystemPrompt(mood, studentState, curso);

    const mensajesGroq = [
      { role: 'system', content: systemPrompt },
      ...(Array.isArray(history) ? history.slice(-10).map(h => ({
          role: h.role === 'assistant' ? 'assistant' : 'user',
          content: String(h.content || ''),
        })) : []),
      { role: 'user', content: message },
    ];

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: mensajesGroq,
        temperature: 0.7,
        max_tokens: 700,
      }),
    });

    const data = await groqResponse.json();

    if (!groqResponse.ok) {
      console.error('❌ Error de Groq:', JSON.stringify(data));
      return res.status(502).json({
        reply: '⚠️ Bro tiene un problema de configuración (key inválida o límite alcanzado). Avisa a un adulto para que lo revise, no eres tú, es cosa nuestra.'
      });
    }

    const text = data.choices?.[0]?.message?.content
      || 'Ey Mario, me he colgado un momento. Mándame otro mensaje bro 🤙';

    res.json({ reply: text });

  } catch (err) {
    console.error('❌ Error en /bro-chat:', err);
    res.status(500).json({ reply: 'Ey Mario, me he colgado un momento. Mándame otro mensaje bro 🤙' });
  }
});

// ─── VERIFICACIÓN DE LA KEY AL ARRANCAR ────────
async function verificarGroqKey() {
  if (!process.env.GROQ_API_KEY) {
    console.log('\n⚠️  GROQ_API_KEY no encontrada en el .env — Bro no podrá chatear.\n');
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
        max_tokens: 1,
      }),
    });

    if (response.ok) {
      console.log('✅ Key de Groq verificada correctamente — Bro puede chatear.\n');
    } else {
      const errData = await response.json().catch(() => ({}));
      console.log('⚠️  Key de Groq inválida o con problemas:', JSON.stringify(errData), '\n');
    }
  } catch (err) {
    console.log('⚠️  No se pudo verificar la key de Groq:', err.message, '\n');
  }
}


// ─── ENDPOINT DE VISIÓN — Bro analiza fotos del Diario de clase ───
app.post('/bro-vision', aiLimiter, async (req, res) => {
  try {
    const { fotoBase64, asignatura, texto, curso } = req.body || {};

    if (!fotoBase64 || typeof fotoBase64 !== 'string') {
      return res.status(400).json({ reply: 'No me ha llegado ninguna foto, bro.' });
    }

    if (curso && curso !== '2') {
      return res.status(200).json({
        reply: `🚧 Ey Mario, esto todavía es una demo — de momento Bro solo tiene cargado el temario de 2º de ESO.\n\nEn la versión en producción tendrás tu curso completo (${curso}º ESO) disponible. Mientras tanto, si quieres, prueba a seleccionar "2 ESO" arriba y le damos caña a ese temario 🤙`
      });
    }

    if (!process.env.GROQ_API_KEY) {
      console.error('❌ GROQ_API_KEY no configurada.');
      return res.status(500).json({ reply: '⚠️ Bro tiene un problema de configuración (falta la key). Avisa a un adulto, no eres tú, es cosa nuestra.' });
    }

    let contextoTemario = '';
    try {
      if (typeof curriculo !== 'undefined' && curriculo && asignatura && curriculo[asignatura]) {
        contextoTemario = `\n\nContexto del temario de ${asignatura} (2º ESO), úsalo si ayuda a situar el apunte: ${JSON.stringify(curriculo[asignatura]).slice(0, 1500)}`;
      }
    } catch (e) { /* si curriculo no tiene esa forma, seguimos sin contexto extra */ }

    const systemPromptVision = `Eres Bro, el tutor de estudio de Mario (2º ESO). Mario te acaba de mandar una foto de un apunte de clase${asignatura ? ` de ${asignatura}` : ''} desde su Diario de clase.

Tu tarea AHORA MISMO es solo esto, en 1-2 frases cortas:
1. Di qué has visto en la foto (de qué trata el apunte), para confirmar que lo has leído bien.
2. Pregúntale a Mario si quiere que se lo expliques o corrijas con más detalle.

NO des la explicación completa todavía, aunque veas errores o creas que lo tienes claro. Espera a que Mario diga que sí. Tono cercano, como siempre (eres "Bro"), sin emojis de más.${contextoTemario}`;

    const imagenParaGroq = fotoBase64.startsWith('data:')
      ? fotoBase64
      : `data:image/jpeg;base64,${fotoBase64}`;

    const mensajesGroq = [
      { role: 'system', content: systemPromptVision },
      {
        role: 'user',
        content: [
          { type: 'text', text: texto && texto.trim() ? texto.trim() : 'Aquí tienes la foto de mi apunte.' },
          { type: 'image_url', image_url: { url: imagenParaGroq } },
        ],
      },
    ];

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'qwen/qwen3.8-27b',
        messages: mensajesGroq,
        temperature: 0.6,
        max_tokens: 500,
      }),
    });

    const data = await groqResponse.json();

    if (!groqResponse.ok) {
      console.error('❌ Error de Groq (vision):', JSON.stringify(data));
      return res.status(502).json({
        reply: '⚠️ Bro tiene un problema de configuración (key inválida o límite alcanzado). Avisa a un adulto para que lo revise, no eres tú, es cosa nuestra.'
      });
    }

    const text = data.choices?.[0]?.message?.content
      || 'Ey Mario, he recibido la foto pero se me ha ido la cabeza un momento. ¿Me la mandas otra vez? 🤙';

    res.json({ reply: text });

  } catch (err) {
    console.error('❌ Error en /bro-vision:', err);
    res.status(500).json({ reply: 'Ey Mario, me he colgado un momento con la foto. Mándamela otra vez bro 🤙' });
  }
});


app.listen(PORT, () => {
  console.log(`\n🛴 Bro Dashboard server corriendo en http://localhost:${PORT}`);
  console.log('   Seguridad activa (Helmet + CORS + RateLimit)\n');
  verificarGroqKey();
});




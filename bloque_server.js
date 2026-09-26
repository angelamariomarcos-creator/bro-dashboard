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

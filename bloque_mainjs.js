// ─── DIARIO DE CLASE → CHAT: pintar mensaje de usuario con foto ───
function addUserMessageConFoto(texto, fotoBase64) {
  const msgs = document.getElementById('chatMessages');
  if (!msgs) return;
  const msg = document.createElement('div');
  msg.className = 'msg msg-user';
  const textoHtml = texto && texto.trim() ? `<div>${escapeHtml(texto)}</div>` : '';
  msg.innerHTML = `<div class="msg-bubble">${textoHtml}<img src="${fotoBase64}" alt="Apunte" style="max-width:200px;max-height:200px;border-radius:8px;display:block;margin-top:${textoHtml ? '6px' : '0'};" /></div>`;
  msgs.appendChild(msg);
  msgs.scrollTop = msgs.scrollHeight;
  state.chatHistory.push({ role: 'user', content: texto && texto.trim() ? texto.trim() : '[Foto de un apunte]' });
}

// ─── DIARIO DE CLASE → CHAT: pedir análisis de la foto a Bro ───
async function pedirAnalisisApunte(asignatura, texto, fotoBase64) {
  const msgs = document.getElementById('chatMessages');
  if (msgs) msgs.scrollIntoView({ behavior: 'smooth', block: 'start' });

  addUserMessageConFoto(texto, fotoBase64);

  try {
    const response = await fetch('/bro-vision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fotoBase64,
        asignatura,
        texto,
        curso: localStorage.getItem('bro_curso') || '2',
      }),
    });

    if (!response.ok) throw new Error('Error servidor');
    const data = await response.json();
    addBroMessage(data.reply);
  } catch (error) {
    console.error('Error Bro (vision):', error);
    addBroMessage('Ey Mario, me he colgado un momento mirando la foto. ¿Me la vuelves a mandar? 🤙');
  }
}

// Hace capturas recortadas de cada sección de Bro Dashboard para la
// presentación de Gamma. No toca ningún archivo del proyecto, solo abre
// la app en un navegador controlado y guarda imágenes en una carpeta nueva.
//
// USO:
//   1. npm install puppeteer --no-save   (tarda un poco, descarga un Chromium)
//   2. Asegúrate de que el servidor está corriendo (node server.js)
//   3. Ajusta APP_URL abajo si tu puerto no es el 3000
//   4. node capturar_presentacion.js
//
// Las imágenes salen en la carpeta capturas-presentacion/, ya numeradas
// y con nombre descriptivo, listas para arrastrar a Gamma en orden.

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const APP_URL = 'http://localhost:3002';
const OUTPUT_DIR = path.join(__dirname, 'capturas-presentacion');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR);
}

async function capturarElemento(page, selector, nombreArchivo) {
  try {
    const el = await page.$(selector);
    if (!el) {
      console.log(`⚠️  No encontrado: ${selector} (se salta "${nombreArchivo}")`);
      return;
    }
    await el.screenshot({ path: path.join(OUTPUT_DIR, nombreArchivo) });
    console.log(`✅ ${nombreArchivo}`);
  } catch (err) {
    console.log(`⚠️  Error capturando ${selector}:`, err.message);
  }
}

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 940 });

  console.log(`Abriendo ${APP_URL} ...`);
  await page.goto(APP_URL, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 800));

  // 1. Pantalla de bienvenida (elegir ánimo), antes de nada
  await capturarElemento(page, '.mood-card', '01-pantalla-bienvenida.png');

  // Elegimos "A tope" para poder ver el resto de la app
  const botonVerde = await page.$('.mood-btn.mood-green');
  if (botonVerde) {
    await botonVerde.click();
    await new Promise(r => setTimeout(r, 1200)); // esperar animación + primer mensaje de Bro
  }

  // 2. Resto de secciones, una a una
  await capturarElemento(page, '.postit-pink', '02-horario-semanal.png');
  await capturarElemento(page, '.postit-yellow', '03-logros-y-monedas.png');
  await capturarElemento(page, '.stats-card', '04-progreso-semanal.png');
  await capturarElemento(page, '.postit-cyan', '05-tareas-del-dia.png');
  await capturarElemento(page, '.postit-lime', '06-diario-de-clase.png');
  await capturarElemento(page, '.chat-container', '07-chat-con-bro.png');
  await capturarElemento(page, '.timer-card', '08-temporizador-y-avatar.png');
  await capturarElemento(page, '.boss-card', '09-preparar-examen.png');
  await capturarElemento(page, '.spotify-card', '10-musica-de-fondo.png');
  await capturarElemento(page, '.help-card', '11-guia-rapida.png');

  // 12. Panorámica completa de la app, para la portada o el cierre
  try {
    await page.screenshot({ path: path.join(OUTPUT_DIR, '12-panoramica-completa.png') });
    console.log('✅ 12-panoramica-completa.png');
  } catch (err) {
    console.log('⚠️  Error en la panorámica:', err.message);
  }

  await browser.close();
  console.log(`\nListo. Revisa la carpeta: ${OUTPUT_DIR}`);
})();

// Genera un PDF de la presentación (una diapositiva por página) con las
// capturas ya metidas dentro, listo para adjuntar en LinkedIn o por correo.
//
// USO (desde C:\bro-dashboard, con presentacion.html y la carpeta
// capturas-presentacion/ en la raíz):
//   node generar_pdf.js
//
// Si te dice que no encuentra 'puppeteer':
//   npm install puppeteer --no-save

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

let puppeteer;
try {
  puppeteer = require('puppeteer');
} catch (e) {
  console.error("❌ Falta puppeteer. Ejecuta primero:  npm install puppeteer --no-save");
  process.exit(1);
}

const HTML = path.join(__dirname, 'presentacion.html');
const CAPTURAS = path.join(__dirname, 'capturas-presentacion');
const SALIDA = path.join(__dirname, 'Bro-Dashboard-presentacion.pdf');

// Estilos de impresión: una diapositiva por página. Se inyectan desde aquí para
// que funcione aunque presentacion.html sea la versión antigua.
const CSS_IMPRESION = `
  @page { size: 1280px 720px; margin: 0; }
  html, body { height: auto !important; overflow: visible !important; background: #D6D0C4 !important;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .deck { width: auto !important; height: auto !important; }
  .slide { position: relative !important; display: flex !important; opacity: 1 !important;
    width: 1280px !important; height: 720px !important; overflow: hidden !important;
    break-after: page; page-break-after: always; }
  .slide:last-child { break-after: auto; page-break-after: auto; }
  .nav, .progress-track { display: none !important; }
`;

(async () => {
  if (!fs.existsSync(HTML)) {
    console.error('❌ No encuentro presentacion.html en ' + __dirname);
    process.exit(1);
  }
  if (!fs.existsSync(CAPTURAS)) {
    console.error('❌ No encuentro la carpeta capturas-presentacion/. Genérala antes con: node capturar_presentacion.js');
    process.exit(1);
  }

  const browser = await puppeteer.launch();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    await page.goto(pathToFileURL(HTML).href, { waitUntil: 'networkidle0' });
    await page.evaluate(() => document.fonts.ready);

    // Avisa si alguna captura no se ha cargado (el HTML pinta un cuadro "Falta ...")
    const faltan = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.slide-image-wrap.missing')).map((el) => el.textContent.trim())
    );
    if (faltan.length) {
      console.warn('⚠️  Capturas que faltan (saldrán como cuadro vacío en el PDF):');
      faltan.forEach((f) => console.warn('   - ' + f));
    }

    await page.addStyleTag({ content: CSS_IMPRESION });
    await page.emulateMediaType('print');
    await page.pdf({ path: SALIDA, preferCSSPageSize: true, printBackground: true });

    const diapositivas = await page.evaluate(() => document.querySelectorAll('.slide').length);
    const bytes = fs.statSync(SALIDA).size;
    const mb = (bytes / 1024 / 1024).toFixed(2);
    console.log('✅ PDF creado: ' + SALIDA + '  (' + diapositivas + ' diapositivas, ' + mb + ' MB)');
    if (bytes < 100 * 1024) {
      console.warn('⚠️  Pesa muy poco para llevar capturas. Revisa que capturas-presentacion/ tenga los PNG con contenido.');
    }
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error('❌ Error generando el PDF:', err.message);
  process.exit(1);
});

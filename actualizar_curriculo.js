// Script de una sola ejecución: añade las 5 asignaturas que faltaban a
// curriculo.json, conservando intactas las 7 que ya había.
// Uso: colocar este archivo en la raíz de C:\bro-dashboard (junto a
// curriculo.json) y ejecutar:  node actualizar_curriculo.js

const fs = require('fs');
const path = require('path');

const ruta = path.join(__dirname, 'curriculo.json');

let curriculo = {};
try {
  const raw = fs.readFileSync(ruta, 'utf8');
  curriculo = JSON.parse(raw);
} catch (err) {
  console.error('❌ No se pudo leer curriculo.json:', err.message);
  process.exit(1);
}

const nuevasAsignaturas = {
  educacion_fisica: {
    nombre: 'Educación Física',
    unidadActual: 'U1: Condición Física y Calentamiento',
    objetivos: [
      'Diferenciar y aplicar las fases del calentamiento general y específico',
      'Identificar las capacidades físicas básicas: fuerza, resistencia, velocidad y flexibilidad',
    ],
  },
  plastica: {
    nombre: 'Plástica',
    unidadActual: 'U1: El Punto, la Línea y el Plano',
    objetivos: [
      'Aplicar el punto y la línea como elementos básicos de representación gráfica',
      'Diferenciar formas geométricas y orgánicas en composiciones sencillas',
    ],
  },
  valores: {
    nombre: 'Valores Éticos',
    unidadActual: 'U1: La Dignidad de la Persona y los Derechos Humanos',
    objetivos: [
      'Identificar los Derechos Humanos y su origen histórico',
      'Reflexionar sobre la dignidad humana como fundamento de la convivencia',
    ],
  },
  tic: {
    nombre: 'TIC',
    unidadActual: 'U1: El Ordenador y los Sistemas Operativos',
    objetivos: [
      'Identificar los componentes internos y periféricos de un ordenador',
      'Gestionar archivos y carpetas dentro de un sistema operativo',
    ],
  },
  optativa: {
    nombre: 'Refuerzo de Matemáticas',
    unidadActual: 'U1: Repaso de Operaciones Básicas y Fracciones',
    objetivos: [
      'Reforzar el cálculo con números enteros, decimales y fracciones',
      'Afianzar la resolución de problemas aritméticos sencillos paso a paso',
    ],
  },
};

let añadidas = 0;
let sobrescritas = 0;

for (const [clave, datos] of Object.entries(nuevasAsignaturas)) {
  if (curriculo[clave]) {
    sobrescritas++;
  } else {
    añadidas++;
  }
  curriculo[clave] = datos;
}

fs.writeFileSync(ruta, JSON.stringify(curriculo, null, 2), 'utf8');

console.log(`✅ curriculo.json actualizado.`);
console.log(`   Asignaturas nuevas añadidas: ${añadidas}`);
console.log(`   Asignaturas existentes sobrescritas: ${sobrescritas}`);
console.log(`   Total de asignaturas en el archivo: ${Object.keys(curriculo).length}`);

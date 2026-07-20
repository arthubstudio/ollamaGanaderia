export const PESO_MINIMO_VENTA_KG = 380;

export const VACUNAS_OBLIGATORIAS_VENTA = [
  "Brucelosis",
  "Rabia Paralítica Bovina",
  "Carbón Sintomático (Pierna Negra) y Edema Maligno"
];

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function formatNumber(value) {
  return Number(value).toLocaleString("es-MX", { maximumFractionDigits: 2 });
}

export function evaluateVentaReadiness({ nombre, peso, vacunasAplicadas = [] }) {
  const vacunasSet = new Set(vacunasAplicadas.map(normalize));
  const vacunasFaltantes = VACUNAS_OBLIGATORIAS_VENTA.filter(
    (vacuna) => !vacunasSet.has(normalize(vacuna))
  );
  const vacunasCumplidas = VACUNAS_OBLIGATORIAS_VENTA.filter(
    (vacuna) => vacunasSet.has(normalize(vacuna))
  );
  const detalleVacunas = [
    `Vacunas cumplidas: ${vacunasCumplidas.length ? vacunasCumplidas.join(", ") : "ninguna"}.`,
    `Vacunas faltantes: ${vacunasFaltantes.length ? vacunasFaltantes.join(", ") : "ninguna"}.`
  ].join(" ");

  if (peso === null || peso === undefined || !Number.isFinite(Number(peso))) {
    return {
      lista: false,
      peso: null,
      pesoFaltante: null,
      vacunasCumplidas,
      vacunasFaltantes,
      respuesta: `No puedo determinar si ${nombre} esta listo para la venta porque no tiene un peso registrado. ${detalleVacunas}`
    };
  }

  const pesoActual = Number(peso);
  const pesoFaltante = Math.max(0, PESO_MINIMO_VENTA_KG - pesoActual);
  const pesoCumplido = pesoActual >= PESO_MINIMO_VENTA_KG;
  const vacunasCompletas = vacunasFaltantes.length === 0;

  if (pesoCumplido && vacunasCompletas) {
    return {
      lista: true,
      peso: pesoActual,
      pesoFaltante: 0,
      vacunasCumplidas,
      vacunasFaltantes: [],
      respuesta: `${nombre} esta listo para la venta. Peso actual: ${formatNumber(pesoActual)} kg. ${detalleVacunas}`
    };
  }

  const partes = [`${nombre} todavia no esta listo para la venta.`];
  if (!pesoCumplido) {
    partes.push(
      `Tiene un peso de ${formatNumber(pesoActual)} kg y necesita llegar al menos a ${PESO_MINIMO_VENTA_KG} kg. Le faltan ${formatNumber(pesoFaltante)} kg.`
    );
  }
  partes.push(detalleVacunas);

  return {
    lista: false,
    peso: pesoActual,
    pesoFaltante,
    vacunasCumplidas,
    vacunasFaltantes,
    respuesta: partes.join(" ")
  };
}

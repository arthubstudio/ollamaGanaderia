export const PESO_MINIMO_VENTA_KG = 550;

export const VACUNAS_OBLIGATORIAS_VENTA = [
  "Brucelosis",
  "Clostridiales",
  "Complejo Respiratorio",
  "Rabia"
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

  if (peso === null || peso === undefined || !Number.isFinite(Number(peso))) {
    return {
      lista: false,
      peso: null,
      pesoFaltante: null,
      vacunasFaltantes,
      respuesta: `No puedo determinar si ${nombre} esta listo para la venta porque no tiene un peso registrado.`
    };
  }

  const pesoActual = Number(peso);
  const pesoFaltante = Math.max(0, PESO_MINIMO_VENTA_KG - pesoActual);
  const pesoCumplido = pesoActual >= PESO_MINIMO_VENTA_KG;
  const vacunasCumplidas = vacunasFaltantes.length === 0;

  if (pesoCumplido && vacunasCumplidas) {
    return {
      lista: true,
      peso: pesoActual,
      pesoFaltante: 0,
      vacunasFaltantes: [],
      respuesta: `${nombre} esta listo para la venta. Pesa ${formatNumber(pesoActual)} kg y tiene aplicadas todas las vacunas obligatorias.`
    };
  }

  const partes = [`${nombre} todavia no esta listo para la venta.`];
  if (!pesoCumplido) {
    partes.push(
      `Tiene un peso de ${formatNumber(pesoActual)} kg y necesita llegar al menos a ${PESO_MINIMO_VENTA_KG} kg. Le faltan ${formatNumber(pesoFaltante)} kg.`
    );
  }
  if (!vacunasCumplidas) {
    partes.push(`Vacunas faltantes: ${vacunasFaltantes.join(", ")}.`);
  }

  return {
    lista: false,
    peso: pesoActual,
    pesoFaltante,
    vacunasFaltantes,
    respuesta: partes.join(" ")
  };
}

import { ollama } from "~/lib/ollama";

import { getPeso } from "./tools/getPeso";
import { getEstado } from "./tools/getEstado";
import { getEdad } from "./tools/getEdad";
import { getVacunas } from "./tools/getVacunas";
import { getEnfermedades } from "./tools/getEnfermedades";
import { getHistorial } from "./tools/getHistorial";
import { getVenta } from "./tools/getVenta";
import { getResumen } from "./tools/getResumen";
import { crearBovino } from "./tools/crearBovino";
import { crearVacuna } from "./tools/crearVacuna";
import { aplicarVacuna } from "./tools/aplicarVacuna";
import { registrarPeso } from "./tools/registrarPeso";
import { registrarEnfermedad } from "./tools/registrarEnfermedad";

type AnyObject = Record<string, any>;

function safeJsonParse(value: unknown): AnyObject {
  if (!value) return {};

  if (typeof value === "object") {
    return value as AnyObject;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value) as AnyObject;
    } catch {
      return { nombre: value };
    }
  }

  return {};
}

function yearsFromDate(dateValue: string | Date | null | undefined): number | null {
  if (!dateValue) return null;

  const birth = new Date(dateValue);
  if (Number.isNaN(birth.getTime())) return null;

  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();

  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    years -= 1;
  }

  return years;
}

function asTextList(items: any[], mapFn: (item: any) => string): string {
  if (!Array.isArray(items) || items.length === 0) return "Sin registros.";
  return items.map(mapFn).join("\n");
}

function buildRespuesta(toolName: string, args: AnyObject, resultado: any): string {
  const nombre = String(args.nombre ?? "").trim() || "la vaca";

  switch (toolName) {
    case "getPeso": {
      if (!resultado) return `No encontré peso registrado para ${nombre}.`;
      return `${nombre} pesa actualmente ${resultado.peso} kg.`;
    }

    case "getEstado": {
      if (!resultado) return `No encontré estado registrado para ${nombre}.`;
      return `${nombre} está ${String(resultado.estado ?? "activa")}.`;
    }

    case "getEdad": {
      if (!resultado?.fecha_nacimiento) {
        return `No encontré fecha de nacimiento registrada para ${nombre}.`;
      }

      const edad = yearsFromDate(resultado.fecha_nacimiento);
      if (edad === null) {
        return `No pude calcular la edad de ${nombre}.`;
      }

      return `${nombre} tiene aproximadamente ${edad} años.`;
    }

    case "getVacunas": {
      if (!Array.isArray(resultado) || resultado.length === 0) {
        return `${nombre} no tiene vacunas registradas.`;
      }

      return `Vacunas de ${nombre}:\n${asTextList(resultado, (r) => {
        const vac = r.vacuna_nombre ?? r.nombre ?? "Vacuna";
        const fecha = r.fecha_aplicacion ? ` (${r.fecha_aplicacion})` : "";
        const vet = r.veterinario ? ` - Vet: ${r.veterinario}` : "";
        return `- ${vac}${fecha}${vet}`;
      })}`;
    }

    case "getEnfermedades": {
      if (!Array.isArray(resultado) || resultado.length === 0) {
        return `${nombre} no tiene enfermedades registradas.`;
      }

      return `Enfermedades de ${nombre}:\n${asTextList(resultado, (r) => {
        const enf = r.nombre ?? "Enfermedad";
        const fecha = r.fecha ? ` (${r.fecha})` : "";
        const tra = r.tratamiento ? ` - ${r.tratamiento}` : "";
        const vet = r.veterinario ? ` - Vet: ${r.veterinario}` : "";
        return `- ${enf}${fecha}${tra}${vet}`;
      })}`;
    }

    case "getHistorial": {
      if (!Array.isArray(resultado) || resultado.length === 0) {
        return `${nombre} no tiene historial de propiedad.`;
      }

      return `Historial de propiedad de ${nombre}:\n${asTextList(resultado, (r) => {
        const dueno = r.dueno ?? r.dueno_nombre ?? "Sin dueño";
        const rancho = r.rancho ?? r.rancho_nombre ?? "Sin rancho";
        const ini = r.fecha_inicio ? `Desde: ${r.fecha_inicio}` : "";
        const fin = r.fecha_fin ? `Hasta: ${r.fecha_fin}` : "Hasta: Actualidad";
        return `- Dueño: ${dueno} | Rancho: ${rancho} | ${ini} | ${fin}`;
      })}`;
    }

    case "getVenta": {
      if (!Array.isArray(resultado) || resultado.length === 0) {
        return `${nombre} no tiene ventas registradas.`;
      }

      const venta = resultado[0];
      return `${nombre} ya fue vendida.\nComprador: ${venta.comprador ?? "N/D"}\nPrecio: ${venta.precio ?? "N/D"}\nFecha: ${venta.fecha ?? "N/D"}`;
    }

    case "getResumen": {
      if (!resultado) return `No encontré esa vaca en tu cuenta.`;

      return `Nombre: ${resultado.nombre ?? nombre}
Arete: ${resultado.numero_arete ?? "N/D"}
Raza: ${resultado.raza ?? "N/D"}
Sexo: ${resultado.sexo ?? "N/D"}
Estado: ${resultado.estado ?? "N/D"}`.trim();
    }

    case "crearBovino": {
      if (!resultado?.ok) return resultado?.error ?? "No pude registrar el bovino.";
      const v = resultado.bovino;
      const tipo = v.sexo === "Macho" ? "Toro" : "Vaca";
      return `Bovino registrado correctamente (${tipo}):
- Nombre: ${v.nombre}
- Arete: ${v.numero_arete}
- Raza: ${v.raza}
- Sexo: ${v.sexo}
- Estado: ${v.estado ?? "activa"}`;
    }

    case "crearVacuna": {
      if (!resultado?.ok) return resultado?.error ?? "No pude crear la vacuna.";
      const v = resultado.vacuna;
      return `Vacuna "${v.nombre}" agregada al catálogo correctamente.`;
    }

    case "aplicarVacuna": {
      if (!resultado?.ok) return resultado?.error ?? "No pude aplicar la vacuna.";
      return `Vacuna "${resultado.vacuna.nombre}" aplicada a ${resultado.bovino.nombre} el ${resultado.aplicacion.fecha_aplicacion}.`;
    }

    case "registrarPeso": {
      if (!resultado?.ok) return resultado?.error ?? "No pude registrar el peso.";
      return `Peso de ${resultado.bovino.nombre} registrado: ${resultado.registro.peso} kg (${resultado.registro.fecha}).`;
    }

    case "registrarEnfermedad": {
      if (!resultado?.ok) return resultado?.error ?? "No pude registrar la enfermedad.";
      return `Enfermedad "${resultado.registro.nombre}" registrada para ${resultado.bovino.nombre}.`;
    }

    default:
      return typeof resultado === "string" ? resultado : JSON.stringify(resultado, null, 2);
  }
}

function buildToolSchemas() {
  const common = {
    type: "object",
    properties: {
      nombre: { type: "string" }
    },
    required: ["nombre"]
  } as const;

  return [
    {
      type: "function",
      function: {
        name: "getPeso",
        description: "Obtiene el último peso de una vaca",
        parameters: common
      }
    },
    {
      type: "function",
      function: {
        name: "getEstado",
        description: "Obtiene el estado actual de una vaca",
        parameters: common
      }
    },
    {
      type: "function",
      function: {
        name: "getEdad",
        description: "Obtiene la fecha de nacimiento de una vaca",
        parameters: common
      }
    },
    {
      type: "function",
      function: {
        name: "getVacunas",
        description: "Obtiene las vacunas aplicadas a una vaca",
        parameters: common
      }
    },
    {
      type: "function",
      function: {
        name: "getEnfermedades",
        description: "Obtiene enfermedades registradas de una vaca",
        parameters: common
      }
    },
    {
      type: "function",
      function: {
        name: "getHistorial",
        description: "Obtiene historial de propiedad de una vaca",
        parameters: common
      }
    },
    {
      type: "function",
      function: {
        name: "getVenta",
        description: "Obtiene información de venta de una vaca",
        parameters: common
      }
    },
    {
      type: "function",
      function: {
        name: "getResumen",
        description: "Obtiene información completa de una vaca",
        parameters: common
      }
    },
    {
      type: "function",
      function: {
        name: "crearBovino",
        description: "Registra un nuevo bovino (vaca hembra o toro macho) en el sistema",
        parameters: {
          type: "object",
          properties: {
            numero_arete: { type: "string", description: "Identificador corto del arete, ej. A-101" },
            nombre: { type: "string", description: "Nombre corto del bovino, máx. 5 palabras" },
            raza: { type: "string", description: "Raza del bovino, ej. Holstein, Angus" },
            sexo: { type: "string", description: "Solo Hembra (vaca) o Macho (toro)" },
            fecha_nacimiento: { type: "string", description: "Fecha YYYY-MM-DD (opcional)" },
            estado: { type: "string", description: "activa, vendida, etc. (opcional)" }
          },
          required: ["numero_arete", "nombre", "raza", "sexo"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "crearVacuna",
        description: "Agrega una nueva vacuna al catálogo del usuario",
        parameters: {
          type: "object",
          properties: {
            nombre: { type: "string", description: "Nombre de la vacuna" },
            descripcion: { type: "string", description: "Descripción (opcional)" }
          },
          required: ["nombre"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "aplicarVacuna",
        description: "Aplica una vacuna del catálogo a una vaca",
        parameters: {
          type: "object",
          properties: {
            nombre_vaca: { type: "string", description: "Nombre de la vaca" },
            vacuna_nombre: { type: "string", description: "Nombre de la vacuna a aplicar" },
            fecha_aplicacion: { type: "string", description: "Fecha YYYY-MM-DD (opcional, hoy por defecto)" },
            veterinario: { type: "string", description: "Nombre del veterinario (opcional)" },
            observaciones: { type: "string", description: "Observaciones (opcional)" }
          },
          required: ["nombre_vaca", "vacuna_nombre"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "registrarPeso",
        description: "Registra el peso de una vaca",
        parameters: {
          type: "object",
          properties: {
            nombre: { type: "string", description: "Nombre de la vaca" },
            peso: { type: "number", description: "Peso en kilogramos" },
            fecha: { type: "string", description: "Fecha YYYY-MM-DD (opcional)" }
          },
          required: ["nombre", "peso"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "registrarEnfermedad",
        description: "Registra una enfermedad para una vaca",
        parameters: {
          type: "object",
          properties: {
            nombre: { type: "string", description: "Nombre de la vaca" },
            enfermedad: { type: "string", description: "Nombre de la enfermedad" },
            tratamiento: { type: "string", description: "Tratamiento (opcional)" },
            fecha: { type: "string", description: "Fecha YYYY-MM-DD (opcional)" },
            veterinario: { type: "string", description: "Veterinario (opcional)" }
          },
          required: ["nombre", "enfermedad"]
        }
      }
    }
  ] as const;
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  const pregunta = String(body?.pregunta ?? "").trim();

  const conversationId = body?.conversation_id ? String(body.conversation_id) : null;
  const usuarioId = body?.usuario_id ? Number(body.usuario_id) : null;

  if (!pregunta) {
    return {
      encontrado: false,
      tool: null,
      argumentos: null,
      resultado: null,
      respuesta: "Escribe una pregunta."
    };
  }

  let response;

  try {
    response = await ollama.chat({
      model: "llama3.2:latest",
      messages: [
        {
          role: "system",
          content: `
Eres un asistente ganadero que puede CONSULTAR y GESTIONAR el sistema.

Terminología:
- "Bovinos" incluye vacas (hembras) y toros (machos).
- Una vaca SIEMPRE es hembra. Un toro SIEMPRE es macho. No aceptes contradicciones.

CONSULTAS: usa getPeso, getEstado, getEdad, getVacunas, getEnfermedades, getHistorial, getVenta, getResumen.

ACCIONES (cuando el usuario pida crear, agregar, registrar o aplicar):
- crearBovino: registrar un bovino nuevo (vaca o toro)
- crearVacuna: agregar una vacuna al catálogo
- aplicarVacuna: aplicar una vacuna a un bovino
- registrarPeso: registrar o anotar un peso
- registrarEnfermedad: registrar una enfermedad

Reglas estrictas para registrar bovinos:
- NO uses frases, bromas, párrafos ni texto conversacional como datos.
- Cada campo debe ser corto y concreto: arete (ej. A-101), nombre (ej. Lola), raza (ej. Holstein), sexo (Hembra o Macho).
- Si falta algún dato obligatorio o el usuario responde con texto confuso, NO llames crearBovino. Pregunta solo por el dato faltante, uno a la vez.
- Si el usuario mezcla "vaca" con sexo masculino, explícale que debe elegir Hembra o registrar un toro (Macho).

Reglas generales:
- No inventes datos. Usa las herramientas para leer y escribir en la base de datos.
- Si no encuentras el bovino en la cuenta del usuario, indícalo.
`.trim()
        },
        {
          role: "user",
          content: pregunta
        }
      ],
      tools: buildToolSchemas()
    });
  } catch (error: any) {
    return {
      encontrado: false,
      tool: null,
      argumentos: null,
      resultado: null,
      respuesta: "",
      error: String(error?.message ?? error)
    };
  }

  const toolCall = response.message?.tool_calls?.[0];

  if (!toolCall) {
    return {
      encontrado: false,
      tool: null,
      argumentos: null,
      resultado: null,
      respuesta: response.message?.content ?? ""
    };
  }

  const toolName = toolCall.function?.name ?? null;
  const argumentos = safeJsonParse(toolCall.function?.arguments);

  let resultado: any = null;

  try {
    switch (toolName) {
      case "getPeso":
        resultado = await getPeso(String(argumentos.nombre ?? ""), usuarioId);
        break;

      case "getEstado":
        resultado = await getEstado(String(argumentos.nombre ?? ""), usuarioId);
        break;

      case "getEdad":
        resultado = await getEdad(String(argumentos.nombre ?? ""), usuarioId);
        break;

      case "getVacunas":
        resultado = await getVacunas(String(argumentos.nombre ?? ""), usuarioId);
        break;

      case "getEnfermedades":
        resultado = await getEnfermedades(String(argumentos.nombre ?? ""), usuarioId);
        break;

      case "getHistorial":
        resultado = await getHistorial(String(argumentos.nombre ?? ""), usuarioId);
        break;

      case "getVenta":
        resultado = await getVenta(String(argumentos.nombre ?? ""), usuarioId);
        break;

      case "getResumen":
        resultado = await getResumen(String(argumentos.nombre ?? ""), usuarioId);
        break;

      case "crearBovino":
        resultado = await crearBovino(
          {
            numero_arete: String(argumentos.numero_arete ?? ""),
            nombre: String(argumentos.nombre ?? ""),
            raza: String(argumentos.raza ?? ""),
            sexo: String(argumentos.sexo ?? ""),
            fecha_nacimiento: argumentos.fecha_nacimiento
              ? String(argumentos.fecha_nacimiento)
              : undefined,
            estado: argumentos.estado ? String(argumentos.estado) : undefined
          },
          usuarioId
        );
        break;

      case "crearVacuna":
        resultado = await crearVacuna(
          {
            nombre: String(argumentos.nombre ?? ""),
            descripcion: argumentos.descripcion
              ? String(argumentos.descripcion)
              : undefined
          },
          usuarioId
        );
        break;

      case "aplicarVacuna":
        resultado = await aplicarVacuna(
          {
            nombre_vaca: String(argumentos.nombre_vaca ?? ""),
            vacuna_nombre: String(argumentos.vacuna_nombre ?? ""),
            fecha_aplicacion: argumentos.fecha_aplicacion
              ? String(argumentos.fecha_aplicacion)
              : undefined,
            veterinario: argumentos.veterinario
              ? String(argumentos.veterinario)
              : undefined,
            observaciones: argumentos.observaciones
              ? String(argumentos.observaciones)
              : undefined
          },
          usuarioId
        );
        break;

      case "registrarPeso":
        resultado = await registrarPeso(
          {
            nombre: String(argumentos.nombre ?? ""),
            peso: Number(argumentos.peso),
            fecha: argumentos.fecha ? String(argumentos.fecha) : undefined
          },
          usuarioId
        );
        break;

      case "registrarEnfermedad":
        resultado = await registrarEnfermedad(
          {
            nombre: String(argumentos.nombre ?? ""),
            enfermedad: String(argumentos.enfermedad ?? ""),
            tratamiento: argumentos.tratamiento
              ? String(argumentos.tratamiento)
              : undefined,
            fecha: argumentos.fecha ? String(argumentos.fecha) : undefined,
            veterinario: argumentos.veterinario
              ? String(argumentos.veterinario)
              : undefined
          },
          usuarioId
        );
        break;

      default:
        resultado = null;
        break;
    }
  } catch (error: any) {
    return {
      encontrado: true,
      tool: toolName,
      argumentos,
      resultado: null,
      respuesta: "Ocurrió un error al ejecutar la herramienta.",
      error: String(error?.message ?? error)
    };
  }

  const respuesta = buildRespuesta(toolName ?? "", argumentos, resultado);

  return {
    encontrado: true,
    tool: toolName,
    argumentos,
    resultado,
    respuesta
  };
});
import { ollama } from "~/lib/ollama";
import { buildHistorialMessages } from "~/lib/conversationContext";

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
import { transferirPropiedad } from "./tools/transferirPropiedad";
import { inferWriteActionFromQuestion } from "~/lib/iaWriteActionRouter";

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

function parseToolCallFromContent(content: string): {
  name: string;
  arguments: AnyObject;
} | null {
  const trimmed = (content ?? "").trim();
  if (!trimmed.startsWith("{")) return null;

  try {
    const parsed = JSON.parse(trimmed) as AnyObject;
    const name = String(parsed.name ?? parsed.function?.name ?? "").trim();
    if (!name) return null;

    const rawArgs =
      parsed.parameters ?? parsed.arguments ?? parsed.function?.arguments;

    return { name, arguments: safeJsonParse(rawArgs) };
  } catch {
    // JSON malformado que algunos modelos devuelven como texto
  }

  const nameMatch = trimmed.match(/"name"\s*:\s*"(\w+)"/);
  if (!nameMatch?.[1]) return null;

  const args: AnyObject = {};
  const argPatterns: [string, RegExp][] = [
    ["nombre", /"nombre"\s*:\s*\\?"([^"\\]+)/],
    ["nombre_vaca", /"nombre_vaca"\s*:\s*\\?"([^"\\]+)/],
    ["vacuna_nombre", /"vacuna_nombre"\s*:\s*\\?"([^"\\]+)/],
    ["numero_arete", /"numero_arete"\s*:\s*\\?"([^"\\]+)/],
    ["raza", /"raza"\s*:\s*\\?"([^"\\]+)/],
    ["sexo", /"sexo"\s*:\s*\\?"([^"\\]+)/],
    ["peso", /"peso"\s*:\s*([0-9.]+)/],
    ["enfermedad", /"enfermedad"\s*:\s*\\?"([^"\\]+)/]
  ];

  for (const [key, pattern] of argPatterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) args[key] = match[1];
  }

  return { name: nameMatch[1], arguments: args };
}

function extractToolCall(response: { message?: AnyObject }) {
  const toolCall = response.message?.tool_calls?.[0];
  if (toolCall?.function?.name) {
    return {
      name: String(toolCall.function.name),
      arguments: safeJsonParse(toolCall.function.arguments)
    };
  }

  const content = String(response.message?.content ?? "");
  return parseToolCallFromContent(content);
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
      if (resultado?.aplicada) {
        return "La vacuna se ha creado y se ha asignado a la vaca o bovino correspondiente.";
      }
      const v = resultado.vacuna;
      return `Vacuna "${v.nombre}" agregada al catálogo correctamente.`;
    }

    case "aplicarVacuna": {
      if (!resultado?.ok) return resultado?.error ?? "No pude aplicar la vacuna.";
      if (resultado.vacunaCreada) {
        return "La vacuna se ha creado y se ha asignado a la vaca o bovino correspondiente.";
      }
      const tipo = resultado.labelBovino ?? "bovino";
      return `Vacuna "${resultado.vacuna.nombre}" aplicada a ${resultado.bovino.nombre} (${tipo}) el ${resultado.aplicacion.fecha_aplicacion}.`;
    }

    case "registrarPeso": {
      if (!resultado?.ok) return resultado?.error ?? "No pude registrar el peso.";
      return `Peso de ${resultado.bovino.nombre} registrado: ${resultado.registro.peso} kg (${resultado.registro.fecha}).`;
    }

    case "registrarEnfermedad": {
      if (!resultado?.ok) return resultado?.error ?? "No pude registrar la enfermedad.";
      const tipo = resultado.bovino?.sexo === "Macho" ? "bovino" : "vaca";
      return `Enfermedad "${resultado.registro.nombre}" registrada para ${resultado.bovino.nombre} (${tipo}).`;
    }

    case "transferirPropiedad": {
      if (!resultado?.ok) {
        return resultado?.error ?? "No pude transferir la propiedad.";
      }

      const partes: string[] = [];
      if (resultado.duenoCreado && resultado.dueno) {
        partes.push(`Dueño "${resultado.dueno.nombre}" creado`);
      }
      if (resultado.ranchoCreado && resultado.rancho) {
        partes.push(`Rancho "${resultado.rancho.nombre}" creado`);
      }

      const detalle = partes.length
        ? `${partes.join(" y ")} y asignado a ${resultado.bovino.nombre}.`
        : `Propiedad de ${resultado.bovino.nombre} actualizada correctamente.`;

      const duenoTxt = resultado.dueno?.nombre
        ? `Dueño: ${resultado.dueno.nombre}.`
        : "";
      const ranchoTxt = resultado.rancho?.nombre
        ? `Rancho: ${resultado.rancho.nombre}.`
        : "";

      return `${detalle} ${duenoTxt} ${ranchoTxt}`.trim();
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
        description: "Aplica una vacuna del catálogo a un bovino (vaca o toro). Si la vacuna no existe, se crea automáticamente.",
        parameters: {
          type: "object",
          properties: {
            nombre_vaca: { type: "string", description: "Nombre del bovino (vaca o toro)" },
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
        description: "Registra o aplica una enfermedad a un bovino. Si el usuario dice 'aplicar enfermedad', usa esta herramienta (NO aplicarVacuna).",
        parameters: {
          type: "object",
          properties: {
            nombre_vaca: { type: "string", description: "Nombre del bovino (vaca o toro)" },
            enfermedad: { type: "string", description: "Nombre de la enfermedad" },
            tratamiento: { type: "string", description: "Tratamiento (opcional)" },
            fecha: { type: "string", description: "Fecha YYYY-MM-DD (opcional)" },
            veterinario: { type: "string", description: "Veterinario (opcional)" }
          },
          required: ["nombre_vaca", "enfermedad"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "transferirPropiedad",
        description: "Transfiere la propiedad de un bovino a un dueño y/o rancho. Si el dueño o rancho no existen, se crean automáticamente.",
        parameters: {
          type: "object",
          properties: {
            nombre_vaca: { type: "string", description: "Nombre del bovino (vaca o toro)" },
            dueno_nombre: { type: "string", description: "Nombre del dueño (opcional si hay rancho)" },
            rancho_nombre: { type: "string", description: "Nombre del rancho (opcional si hay dueño)" },
            fecha_inicio: { type: "string", description: "Fecha YYYY-MM-DD (opcional, hoy por defecto)" },
            observaciones: { type: "string", description: "Observaciones (opcional)" }
          },
          required: ["nombre_vaca"]
        }
      }
    }
  ] as const;
}

async function executeToolCall(
  toolName: string,
  argumentos: AnyObject,
  usuarioId: number | null,
  nombreAnimalContexto: string | null
) {
  switch (toolName) {
    case "getPeso":
      return getPeso(String(argumentos.nombre ?? ""), usuarioId);

    case "getEstado":
      return getEstado(String(argumentos.nombre ?? ""), usuarioId);

    case "getEdad":
      return getEdad(String(argumentos.nombre ?? ""), usuarioId);

    case "getVacunas":
      return getVacunas(String(argumentos.nombre ?? ""), usuarioId);

    case "getEnfermedades":
      return getEnfermedades(String(argumentos.nombre ?? ""), usuarioId);

    case "getHistorial":
      return getHistorial(String(argumentos.nombre ?? ""), usuarioId);

    case "getVenta":
      return getVenta(String(argumentos.nombre ?? ""), usuarioId);

    case "getResumen":
      return getResumen(String(argumentos.nombre ?? ""), usuarioId);

    case "crearBovino":
      return crearBovino(
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

    case "crearVacuna": {
      const resultado = await crearVacuna(
        {
          nombre: String(argumentos.nombre ?? ""),
          descripcion: argumentos.descripcion
            ? String(argumentos.descripcion)
            : undefined
        },
        usuarioId
      );

      if (resultado?.ok && nombreAnimalContexto) {
        const applyResult = await aplicarVacuna(
          {
            nombre_vaca: nombreAnimalContexto,
            vacuna_nombre: String(argumentos.nombre ?? "")
          },
          usuarioId
        );

        if (applyResult.ok) {
          return {
            ...resultado,
            aplicada: true,
            bovino: applyResult.bovino,
            aplicacion: applyResult.aplicacion
          };
        }
      }

      return resultado;
    }

    case "aplicarVacuna": {
      const nombreBovino =
        String(argumentos.nombre_vaca ?? "").trim() ||
        nombreAnimalContexto ||
        "";

      return aplicarVacuna(
        {
          nombre_vaca: nombreBovino,
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
    }

    case "registrarPeso":
      return registrarPeso(
        {
          nombre: String(argumentos.nombre ?? ""),
          peso: Number(argumentos.peso),
          fecha: argumentos.fecha ? String(argumentos.fecha) : undefined
        },
        usuarioId
      );

    case "registrarEnfermedad": {
      const nombreBovinoEnf =
        String(argumentos.nombre_vaca ?? argumentos.nombre ?? "").trim() ||
        nombreAnimalContexto ||
        "";

      return registrarEnfermedad(
        {
          nombre_vaca: nombreBovinoEnf,
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
    }

    case "transferirPropiedad": {
      const nombreBovinoTrans =
        String(argumentos.nombre_vaca ?? "").trim() ||
        nombreAnimalContexto ||
        "";

      return transferirPropiedad(
        {
          nombre_vaca: nombreBovinoTrans,
          dueno_nombre: argumentos.dueno_nombre
            ? String(argumentos.dueno_nombre)
            : undefined,
          rancho_nombre: argumentos.rancho_nombre
            ? String(argumentos.rancho_nombre)
            : undefined,
          fecha_inicio: argumentos.fecha_inicio
            ? String(argumentos.fecha_inicio)
            : undefined,
          observaciones: argumentos.observaciones
            ? String(argumentos.observaciones)
            : undefined
        },
        usuarioId
      );
    }

    default:
      return null;
  }
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  const pregunta = String(body?.pregunta ?? "").trim();

  const conversationId = body?.conversation_id ? String(body.conversation_id) : null;
  const usuarioId = body?.usuario_id ? Number(body.usuario_id) : null;
  const historial = Array.isArray(body?.historial) ? body.historial : [];
  const animalContext = body?.animal_context ?? null;
  const nombreAnimalContexto = animalContext?.nombre
    ? String(animalContext.nombre).trim()
    : null;

  if (!pregunta) {
    return {
      encontrado: false,
      tool: null,
      argumentos: null,
      resultado: null,
      respuesta: "Escribe una pregunta."
    };
  }

  const inferredAction = inferWriteActionFromQuestion(
    pregunta,
    nombreAnimalContexto
  );

  if (inferredAction) {
    try {
      const resultado = await executeToolCall(
        inferredAction.tool,
        inferredAction.args,
        usuarioId,
        nombreAnimalContexto
      );

      const respuesta = buildRespuesta(
        inferredAction.tool,
        inferredAction.args,
        resultado
      );

      return {
        encontrado: true,
        tool: inferredAction.tool,
        argumentos: inferredAction.args,
        resultado,
        respuesta
      };
    } catch (error: any) {
      return {
        encontrado: true,
        tool: inferredAction.tool,
        argumentos: inferredAction.args,
        resultado: null,
        respuesta: "Ocurrió un error al ejecutar la herramienta.",
        error: String(error?.message ?? error)
      };
    }
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
- aplicarVacuna: aplicar una VACUNA a un bovino
- registrarPeso: registrar o anotar un peso
- registrarEnfermedad: registrar o aplicar una ENFERMEDAD a un bovino
- transferirPropiedad: transferir propiedad a un dueño y/o rancho (crea dueño/rancho si no existen)

Reglas para vacunas vs enfermedades (MUY IMPORTANTE):
- Si el usuario menciona ENFERMEDAD, usa registrarEnfermedad. NUNCA uses aplicarVacuna para enfermedades.
- Si el usuario menciona VACUNA, usa aplicarVacuna. NUNCA uses registrarEnfermedad para vacunas.
- Si el usuario pide APLICAR una vacuna a un bovino, usa aplicarVacuna (no crearVacuna).
- Si el mensaje incluye "(sobre el bovino X)", ese es el bovino al que debes aplicar la acción.
- Si el usuario confirma registrar/aplicar algo en contexto de un bovino anterior, usa ese bovino del contexto.
- NUNCA respondas con JSON en texto. Siempre invoca la herramienta correspondiente.
- No confundas el arete con el nombre del bovino. Usa el NOMBRE del bovino, no partes del arete.

Reglas para propiedad:
- Si el usuario pide transferir propiedad, asignar dueño o asignar rancho, usa transferirPropiedad.
- Si el dueño o rancho no existen, transferirPropiedad los crea automáticamente.

Reglas estrictas para registrar bovinos:
- NO uses frases, bromas, párrafos ni texto conversacional como datos.
- Cada campo debe ser corto y concreto: arete (ej. A-101), nombre (ej. Lola), raza (ej. Holstein), sexo (Hembra o Macho).
- Si falta algún dato obligatorio o el usuario responde con texto confuso, NO llames crearBovino. Pregunta solo por el dato faltante, uno a la vez.
- Si el usuario mezcla "vaca" con sexo masculino, explícale que debe elegir Hembra o registrar un toro (Macho).

Reglas generales:
- Usa el HISTORIAL DE CONVERSACIÓN para entender referencias como "esa vaca", "y cuánto pesa", "la anterior", etc.
- No inventes datos. Usa las herramientas para leer y escribir en la base de datos.
- Si no encuentras el bovino en la cuenta del usuario, indícalo.
`.trim()
        },
        ...buildHistorialMessages(historial),
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

  const toolCall = extractToolCall(response);

  if (!toolCall) {
    const content = String(response.message?.content ?? "");
    const pareceJsonHerramienta = /^\s*\{.*"name"\s*:\s*"/.test(content);

    return {
      encontrado: false,
      tool: null,
      argumentos: null,
      resultado: null,
      respuesta: pareceJsonHerramienta
        ? "No pude completar la acción. Intenta de nuevo con el nombre del bovino y la vacuna."
        : content
    };
  }

  const toolName = toolCall.name;
  const argumentos = toolCall.arguments;

  let resultado: any = null;

  try {
    resultado = await executeToolCall(
      toolName,
      argumentos,
      usuarioId,
      nombreAnimalContexto
    );
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
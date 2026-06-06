import ollama from "ollama";

import { getPeso } from "./tools/getPeso";
import { getEstado } from "./tools/getEstado";
import { getEdad } from "./tools/getEdad";
import { getVacunas } from "./tools/getVacunas";
import { getEnfermedades } from "./tools/getEnfermedades";
import { getHistorial } from "./tools/getHistorial";
import { getVenta } from "./tools/getVenta";
import { getResumen } from "./tools/getResumen";

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
      if (!resultado) return `No encontré información de ${nombre}.`;

      return `Nombre: ${resultado.nombre ?? nombre}
Arete: ${resultado.numero_arete ?? "N/D"}
Raza: ${resultado.raza ?? "N/D"}
Sexo: ${resultado.sexo ?? "N/D"}
Estado: ${resultado.estado ?? "N/D"}
`;
    }

    default:
      return typeof resultado === "string" ? resultado : JSON.stringify(resultado, null, 2);
  }
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const pregunta = String(body?.pregunta ?? "").trim();

  if (!pregunta) {
    return {
      encontrado: false,
      tool: null,
      argumentos: null,
      resultado: null,
      respuesta: "Escribe una pregunta."
    };
  }

  const response = await ollama.chat({
    model: "llama3.2:latest",
    messages: [
      {
        role: "system",
        content: `
Eres un asistente ganadero.

Debes usar herramientas cuando necesites consultar información exacta de la base de datos.
No inventes datos.
Si la pregunta es sobre una vaca, intenta usar la herramienta más adecuada.
`
      },
      {
        role: "user",
        content: pregunta
      }
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "getPeso",
          description: "Obtiene el último peso de una vaca",
          parameters: {
            type: "object",
            properties: {
              nombre: { type: "string" }
            },
            required: ["nombre"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getEstado",
          description: "Obtiene el estado actual de una vaca",
          parameters: {
            type: "object",
            properties: {
              nombre: { type: "string" }
            },
            required: ["nombre"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getEdad",
          description: "Obtiene la fecha de nacimiento de una vaca",
          parameters: {
            type: "object",
            properties: {
              nombre: { type: "string" }
            },
            required: ["nombre"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getVacunas",
          description: "Obtiene las vacunas aplicadas a una vaca",
          parameters: {
            type: "object",
            properties: {
              nombre: { type: "string" }
            },
            required: ["nombre"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getEnfermedades",
          description: "Obtiene enfermedades registradas de una vaca",
          parameters: {
            type: "object",
            properties: {
              nombre: { type: "string" }
            },
            required: ["nombre"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getHistorial",
          description: "Obtiene historial de propiedad de una vaca",
          parameters: {
            type: "object",
            properties: {
              nombre: { type: "string" }
            },
            required: ["nombre"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getVenta",
          description: "Obtiene información de venta de una vaca",
          parameters: {
            type: "object",
            properties: {
              nombre: { type: "string" }
            },
            required: ["nombre"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getResumen",
          description: "Obtiene información completa de una vaca",
          parameters: {
            type: "object",
            properties: {
              nombre: { type: "string" }
            },
            required: ["nombre"]
          }
        }
      }
    ]
  });

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
        resultado = await getPeso(String(argumentos.nombre ?? ""));
        break;

      case "getEstado":
        resultado = await getEstado(String(argumentos.nombre ?? ""));
        break;

      case "getEdad":
        resultado = await getEdad(String(argumentos.nombre ?? ""));
        break;

      case "getVacunas":
        resultado = await getVacunas(String(argumentos.nombre ?? ""));
        break;

      case "getEnfermedades":
        resultado = await getEnfermedades(String(argumentos.nombre ?? ""));
        break;

      case "getHistorial":
        resultado = await getHistorial(String(argumentos.nombre ?? ""));
        break;

      case "getVenta":
        resultado = await getVenta(String(argumentos.nombre ?? ""));
        break;

      case "getResumen":
        resultado = await getResumen(String(argumentos.nombre ?? ""));
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
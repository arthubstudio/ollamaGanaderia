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
import { crearDueno } from "./tools/crearDueno";
import { crearRancho } from "./tools/crearRancho";
import { eliminarBovino } from "./tools/eliminarBovino";
import { eliminarEnfermedad } from "./tools/eliminarEnfermedad";
import { eliminarVacunaAplicada } from "./tools/eliminarVacunaAplicada";
import { eliminarVacuna } from "./tools/eliminarVacuna";
import { eliminarDueno } from "./tools/eliminarDueno";
import { eliminarRancho } from "./tools/eliminarRancho";
import { actualizarEnfermedad } from "./tools/actualizarEnfermedad";
import { actualizarBovino } from "./tools/actualizarBovino";
import { quitarPropiedad } from "./tools/quitarPropiedad";
import { inferActionFromQuestion } from "~/lib/iaWriteActionRouter";
import { needsBovinoAssignment } from "~/lib/iaIntentRouter";
import { requireUserId } from "~/server/utils/session";
import {
  aceptarSolicitudAmistad,
  aceptarTransferencia,
  buscarRaza,
  buscarUsuario,
  cancelarTransferencia,
  crearRaza,
  crearSolicitudTransferencia,
  enviarMensaje,
  enviarSolicitudAmistad,
  leerConversacion,
  listarBovinosEnviados,
  listarBovinosRecibidos,
  listarConversaciones,
  listarRazas,
  listarTransferencias,
  rechazarSolicitudAmistad,
  rechazarTransferencia
} from "./tools/platformTools";

type AnyObject = Record<string, any>;

const PLATFORM_TOOL_SCHEMAS = [
  {
    type: "function",
    function: {
      name: "buscarUsuario",
      description: "Busca usuarios por correo, nombre exacto, nombre parcial y similitud.",
      parameters: { type: "object", properties: { busqueda: { type: "string" } }, required: ["busqueda"] }
    }
  },
  {
    type: "function",
    function: {
      name: "crearSolicitudTransferencia",
      description: "Solicita transferir un bovino a otra cuenta. No cambia la propiedad hasta que el receptor acepte.",
      parameters: {
        type: "object",
        properties: {
          nombre_bovino: { type: "string" },
          usuario_destino: { type: "string", description: "Nombre o correo del usuario destino" },
          destination_rancho_id: { type: "number" },
          mensaje: { type: "string" }
        },
        required: ["nombre_bovino", "usuario_destino"]
      }
    }
  },
  ...["aceptarTransferencia", "rechazarTransferencia", "cancelarTransferencia"].map((name) => ({
    type: "function" as const,
    function: {
      name,
      description: `${name} de bovino por ID.`,
      parameters: { type: "object", properties: { transferencia_id: { type: "number" }, rancho_destino_id: { type: "number" } }, required: ["transferencia_id"] }
    }
  })),
  ...["listarTransferencias", "listarBovinosRecibidos", "listarBovinosEnviados"].map((name) => ({
    type: "function" as const,
    function: {
      name,
      description: `${name} de la cuenta autenticada.`,
      parameters: { type: "object", properties: { direccion: { type: "string" }, estado: { type: "string" } } }
    }
  })),
  {
    type: "function",
    function: {
      name: "buscarRaza",
      description: "Busca una raza exacta en el catalogo global.",
      parameters: { type: "object", properties: { nombre: { type: "string" } }, required: ["nombre"] }
    }
  },
  {
    type: "function",
    function: {
      name: "crearRaza",
      description: "Crea una raza nueva solo despues de que el usuario lo confirme.",
      parameters: {
        type: "object",
        properties: { nombre: { type: "string" }, tipo: { type: "string" }, pais_origen: { type: "string" }, descripcion: { type: "string" } },
        required: ["nombre"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "listarRazas",
      description: "Lista como maximo diez razas y comunica que el catalogo completo esta en el menu.",
      parameters: { type: "object", properties: { busqueda: { type: "string" }, tipo: { type: "string" }, limite: { type: "number" } } }
    }
  },
  {
    type: "function",
    function: {
      name: "enviarSolicitudAmistad",
      description: "Envia una solicitud de contacto a otro usuario.",
      parameters: { type: "object", properties: { usuario_destino: { type: "string" }, mensaje: { type: "string" } }, required: ["usuario_destino"] }
    }
  },
  ...["aceptarSolicitudAmistad", "rechazarSolicitudAmistad"].map((name) => ({
    type: "function" as const,
    function: {
      name,
      description: `${name} por ID.`,
      parameters: { type: "object", properties: { solicitud_id: { type: "number" } }, required: ["solicitud_id"] }
    }
  })),
  {
    type: "function",
    function: {
      name: "enviarMensaje",
      description: "Envia un mensaje a un contacto existente.",
      parameters: { type: "object", properties: { usuario_destino: { type: "string" }, mensaje: { type: "string" } }, required: ["usuario_destino", "mensaje"] }
    }
  },
  {
    type: "function",
    function: {
      name: "leerConversacion",
      description: "Lee la conversacion con un contacto.",
      parameters: { type: "object", properties: { usuario_destino: { type: "string" } }, required: ["usuario_destino"] }
    }
  },
  {
    type: "function",
    function: {
      name: "listarConversaciones",
      description: "Lista conversaciones, contactos y solicitudes de amistad.",
      parameters: { type: "object", properties: {} }
    }
  }
] as const;

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

function firstTextValue(source: AnyObject, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }

  return "";
}

function normalizeToolArguments(
  toolName: string,
  argumentos: AnyObject,
  nombreAnimalContexto: string | null
) {
  const normalized: AnyObject = { ...argumentos };

  const bovinoName = firstTextValue(normalized, [
    "nombre_vaca",
    "nombre_bovino",
    "bovino_nombre",
    "nombre_animal",
    "animal",
    "vaca",
    "bovino",
    "toro"
  ]);

  if (
    [
      "aplicarVacuna",
      "registrarEnfermedad",
      "transferirPropiedad",
      "eliminarVacunaAplicada",
      "eliminarEnfermedad",
      "quitarPropiedad"
    ].includes(toolName) &&
    !normalized.nombre_vaca
  ) {
    normalized.nombre_vaca = bovinoName || nombreAnimalContexto || "";
  }

  if (toolName === "registrarPeso" && !normalized.nombre) {
    normalized.nombre =
      bovinoName ||
      firstTextValue(normalized, ["nombre"]) ||
      nombreAnimalContexto ||
      "";
  }

  if (toolName === "aplicarVacuna" && !normalized.vacuna_nombre) {
    normalized.vacuna_nombre = firstTextValue(normalized, [
      "vacuna_nombre",
      "nombre_vacuna",
      "vacuna",
      "nombre"
    ]);
  }

  if (toolName === "registrarEnfermedad" && !normalized.enfermedad) {
    normalized.enfermedad = firstTextValue(normalized, [
      "enfermedad",
      "nombre_enfermedad",
      "diagnostico"
    ]);
  }

  if (toolName === "registrarPeso" && normalized.peso === undefined) {
    const peso = firstTextValue(normalized, [
      "peso",
      "peso_kg",
      "kilogramos",
      "kg"
    ]);
    if (peso) normalized.peso = Number(peso);
  }

  if (toolName === "crearBovino") {
    if (!normalized.raza) {
      normalized.raza = firstTextValue(normalized, ["raza", "breed"]);
    }

    if (!normalized.sexo) {
      normalized.sexo = firstTextValue(normalized, ["sexo", "genero"]);
    }
  }

  return normalized;
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

    case "crearDueno": {
      if (!resultado?.ok) return resultado?.error ?? "No pude crear el dueño.";
      if (resultado.creado) {
        return `Dueño "${resultado.dueno.nombre}" creado correctamente en tu catálogo.`;
      }
      return `El dueño "${resultado.dueno.nombre}" ya existía en tu catálogo.`;
    }

    case "crearRancho": {
      if (!resultado?.ok) return resultado?.error ?? "No pude crear el rancho.";
      if (resultado.creado) {
        return `Rancho "${resultado.rancho.nombre}" creado correctamente en tu catálogo.`;
      }
      return `El rancho "${resultado.rancho.nombre}" ya existía en tu catálogo.`;
    }

    case "eliminarBovino": {
      if (!resultado?.ok) return resultado?.error ?? "No pude eliminar el bovino.";
      return `Bovino "${resultado.bovino.nombre}" eliminado correctamente.`;
    }

    case "eliminarEnfermedad": {
      if (!resultado?.ok) return resultado?.error ?? "No pude eliminar la enfermedad.";
      return `Enfermedad "${resultado.eliminada.nombre}" eliminada de ${resultado.bovino.nombre}.`;
    }

    case "eliminarVacunaAplicada": {
      if (!resultado?.ok) return resultado?.error ?? "No pude quitar la vacuna.";
      return `Vacuna "${resultado.vacuna_nombre}" quitada de ${resultado.bovino.nombre}.`;
    }

    case "eliminarVacuna": {
      if (!resultado?.ok) return resultado?.error ?? "No pude eliminar la vacuna.";
      return `Vacuna "${resultado.vacuna.nombre}" eliminada del catálogo.`;
    }

    case "eliminarDueno": {
      if (!resultado?.ok) return resultado?.error ?? "No pude eliminar el dueño.";
      return `Dueño "${resultado.dueno.nombre}" eliminado correctamente.`;
    }

    case "eliminarRancho": {
      if (!resultado?.ok) return resultado?.error ?? "No pude eliminar el rancho.";
      return `Rancho "${resultado.rancho.nombre}" eliminado correctamente.`;
    }

    case "actualizarBovino": {
      if (!resultado?.ok) return resultado?.error ?? "No pude actualizar el bovino.";
      return `Bovino "${resultado.bovino.nombre}" actualizado correctamente.`;
    }

    case "actualizarEnfermedad": {
      if (!resultado?.ok) return resultado?.error ?? "No pude actualizar la enfermedad.";
      return `Enfermedad de ${resultado.bovino.nombre} actualizada correctamente.`;
    }

    case "quitarPropiedad": {
      if (!resultado?.ok) return resultado?.error ?? "No pude quitar la asignación.";
      const partes: string[] = [];
      if (resultado.quito_rancho) partes.push("rancho");
      if (resultado.quito_dueno) partes.push("dueño");
      return `Se quitó ${partes.join(" y ")} de ${resultado.bovino.nombre}.`;
    }

    case "buscarUsuario": {
      if (!resultado?.ok) return resultado?.error ?? "No pude buscar usuarios.";
      if (!resultado.matches?.length) return "No encontre usuarios relacionados.";
      return `Usuarios encontrados:\n${resultado.matches.map((item: any) => `- ${item.nombre} (${item.email})`).join("\n")}`;
    }

    case "crearSolicitudTransferencia": {
      if (!resultado?.ok) {
        const matches = resultado?.matches ?? [];
        if (resultado?.reason === "ambiguous" && matches.length) {
          return `Encontre ${matches.length} usuarios relacionados:\n${matches.map((item: any) => `- ${item.nombre} (${item.email})`).join("\n")}\nIndica el correo electronico del usuario correcto.`;
        }
        return resultado?.error ?? "No pude crear la solicitud de transferencia.";
      }
      return `La transferencia de ${resultado.transfer.bovino.nombre} fue enviada a ${resultado.transfer.destination.nombre} (${resultado.transfer.destination.email}). El bovino seguira en tu cuenta hasta que sea aceptada.`;
    }

    case "aceptarTransferencia":
      if (!resultado?.ok) return resultado?.error ?? "No pude aceptar la transferencia.";
      return `Transferencia aceptada. ${resultado.bovino.nombre} ahora esta en tu cuenta con el arete ${resultado.bovino.numero_arete}.`;

    case "rechazarTransferencia":
      return resultado?.ok ? "Transferencia rechazada. La propiedad no cambio." : resultado?.error;

    case "cancelarTransferencia":
      return resultado?.ok ? "Transferencia cancelada. La propiedad no cambio." : resultado?.error;

    case "listarTransferencias":
    case "listarBovinosRecibidos":
    case "listarBovinosEnviados": {
      if (!resultado?.ok) return resultado?.error ?? "No pude consultar transferencias.";
      const items = resultado.transfers ?? [];
      if (!items.length) return "No hay transferencias con esos filtros.";
      return items.slice(0, 10).map((item: any) =>
        `- ${item.bovino_nombre} | ${item.direction === "sent" ? "enviada a" : "recibida de"} ${item.direction === "sent" ? item.destination_user_name : item.source_user_name} | ${item.status}`
      ).join("\n");
    }

    case "buscarRaza":
      return resultado?.breed
        ? `La raza ${resultado.breed.nombre} esta registrada y activa.`
        : "Esa raza no existe registrada. Deseas crearla?";

    case "crearRaza":
      if (!resultado?.ok) return resultado?.error ?? "No pude crear la raza.";
      return resultado.created
        ? `La raza ${resultado.breed.nombre} fue creada correctamente.`
        : `La raza ${resultado.breed.nombre} ya estaba registrada.`;

    case "crearRazaYBovino": {
      if (!resultado?.ok) return resultado?.error ?? "No pude crear la raza y el bovino.";
      const v = resultado.bovino;
      return `${v.nombre} fue registrado correctamente con la raza ${v.raza} y el arete ${v.numero_arete}.`;
    }

    case "listarRazas": {
      if (!resultado?.ok) return resultado?.error ?? "No pude consultar las razas.";
      const items = resultado.breeds ?? [];
      if (!items.length) return "No encontre razas con esos filtros.";
      return `Razas disponibles:\n${items.map((item: any) => `- ${item.nombre} (${item.tipo})`).join("\n")}\nPuedes consultar todas las razas desde el menu Catalogo de Razas.`;
    }

    case "enviarSolicitudAmistad":
      if (!resultado?.ok) return resultado?.error ?? "No pude enviar la solicitud.";
      return resultado.autoAccepted
        ? `La solicitud pendiente de ${resultado.user.nombre} fue aceptada y ahora son contactos.`
        : `Solicitud de contacto enviada a ${resultado.user.nombre}.`;

    case "aceptarSolicitudAmistad":
      return resultado?.ok ? "Solicitud aceptada. Ya pueden conversar." : resultado?.error;

    case "rechazarSolicitudAmistad":
      return resultado?.ok ? "Solicitud de contacto rechazada." : resultado?.error;

    case "enviarMensaje":
      return resultado?.ok
        ? `Mensaje enviado a ${resultado.recipient.nombre}.`
        : resultado?.error ?? "No pude enviar el mensaje.";

    case "leerConversacion": {
      if (!resultado?.ok) return resultado?.error ?? "No pude leer la conversacion.";
      const messages = resultado.messages ?? [];
      if (!messages.length) return `Aun no hay mensajes con ${resultado.recipient.nombre}.`;
      return messages.slice(-10).map((item: any) => `- ${item.sender_name}: ${item.content}`).join("\n");
    }

    case "listarConversaciones": {
      if (!resultado?.ok) return resultado?.error ?? "No pude listar conversaciones.";
      const items = resultado.conversations ?? [];
      if (!items.length) return "No tienes conversaciones comunitarias.";
      return items.slice(0, 10).map((item: any) => `- ${item.contact_name}: ${item.last_message ?? "Sin mensajes"} (${item.unread_count} sin leer)`).join("\n");
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
            nombre: { type: "string", description: "Nombre corto del bovino, máx. 5 palabras" },
            raza: { type: "string", description: "Raza del bovino, ej. Holstein, Angus" },
            sexo: { type: "string", description: "Solo Hembra (vaca) o Macho (toro)" },
            fecha_nacimiento: { type: "string", description: "Fecha YYYY-MM-DD (opcional)" },
            estado: { type: "string", description: "activa, vendida, etc. (opcional)" }
          },
          required: ["nombre", "raza", "sexo"]
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
    },
    ...PLATFORM_TOOL_SCHEMAS
  ] as const;
}

async function executeToolCall(
  toolName: string,
  argumentos: AnyObject,
  usuarioId: number | null,
  nombreAnimalContexto: string | null
) {
  argumentos = normalizeToolArguments(
    toolName,
    argumentos,
    nombreAnimalContexto
  );

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
          nombre: String(argumentos.nombre ?? ""),
          raza: String(argumentos.raza ?? ""),
          breed_id: argumentos.breed_id ? Number(argumentos.breed_id) : undefined,
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

      const debeAplicar =
        Boolean(argumentos.aplicar_a_bovino) ||
        (Boolean(nombreAnimalContexto) &&
          Boolean(argumentos._pregunta) &&
          needsBovinoAssignment(String(argumentos._pregunta)));

      if (resultado?.ok && debeAplicar && nombreAnimalContexto) {
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

    case "crearDueno":
      return crearDueno(
        {
          nombre: String(argumentos.nombre ?? ""),
          telefono: argumentos.telefono ? String(argumentos.telefono) : undefined,
          direccion: argumentos.direccion ? String(argumentos.direccion) : undefined
        },
        usuarioId
      );

    case "crearRancho":
      return crearRancho(
        {
          nombre: String(argumentos.nombre ?? ""),
          ubicacion: argumentos.ubicacion ? String(argumentos.ubicacion) : undefined,
          dueno_nombre: argumentos.dueno_nombre
            ? String(argumentos.dueno_nombre)
            : undefined
        },
        usuarioId
      );

    case "eliminarBovino":
      return eliminarBovino({ nombre: String(argumentos.nombre ?? "") }, usuarioId);

    case "eliminarEnfermedad":
      return eliminarEnfermedad(
        {
          nombre_vaca: String(argumentos.nombre_vaca ?? ""),
          enfermedad: String(argumentos.enfermedad ?? "")
        },
        usuarioId
      );

    case "eliminarVacunaAplicada":
      return eliminarVacunaAplicada(
        {
          nombre_vaca: String(argumentos.nombre_vaca ?? ""),
          vacuna_nombre: String(argumentos.vacuna_nombre ?? "")
        },
        usuarioId
      );

    case "eliminarVacuna":
      return eliminarVacuna({ nombre: String(argumentos.nombre ?? "") }, usuarioId);

    case "eliminarDueno":
      return eliminarDueno({ nombre: String(argumentos.nombre ?? "") }, usuarioId);

    case "eliminarRancho":
      return eliminarRancho({ nombre: String(argumentos.nombre ?? "") }, usuarioId);

    case "actualizarBovino":
      return actualizarBovino(
        {
          nombre: String(argumentos.nombre ?? ""),
          nuevo_nombre: argumentos.nuevo_nombre
            ? String(argumentos.nuevo_nombre)
            : undefined,
          numero_arete: argumentos.numero_arete
            ? String(argumentos.numero_arete)
            : undefined,
          raza: argumentos.raza ? String(argumentos.raza) : undefined,
          sexo: argumentos.sexo ? String(argumentos.sexo) : undefined,
          estado: argumentos.estado ? String(argumentos.estado) : undefined
        },
        usuarioId
      );

    case "actualizarEnfermedad":
      return actualizarEnfermedad(
        {
          nombre_vaca: String(argumentos.nombre_vaca ?? ""),
          enfermedad: String(argumentos.enfermedad ?? ""),
          nuevo_nombre: argumentos.nuevo_nombre
            ? String(argumentos.nuevo_nombre)
            : undefined,
          tratamiento: argumentos.tratamiento
            ? String(argumentos.tratamiento)
            : undefined,
          veterinario: argumentos.veterinario
            ? String(argumentos.veterinario)
            : undefined
        },
        usuarioId
      );

    case "quitarPropiedad":
      return quitarPropiedad(
        {
          nombre_vaca: String(argumentos.nombre_vaca ?? ""),
          quitar_rancho: argumentos.quitar_rancho !== false,
          quitar_dueno: argumentos.quitar_dueno !== false
        },
        usuarioId
      );

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

    case "buscarUsuario":
      return buscarUsuario({ busqueda: String(argumentos.busqueda ?? "") }, usuarioId);

    case "crearSolicitudTransferencia":
      return crearSolicitudTransferencia({
        nombre_bovino: String(argumentos.nombre_bovino ?? argumentos.nombre_vaca ?? nombreAnimalContexto ?? ""),
        usuario_destino: String(argumentos.usuario_destino ?? argumentos.destination_email ?? ""),
        destination_rancho_id: argumentos.destination_rancho_id ? Number(argumentos.destination_rancho_id) : undefined,
        mensaje: argumentos.mensaje ? String(argumentos.mensaje) : undefined
      }, usuarioId);

    case "aceptarTransferencia":
      return aceptarTransferencia({
        transferencia_id: Number(argumentos.transferencia_id),
        rancho_destino_id: argumentos.rancho_destino_id ? Number(argumentos.rancho_destino_id) : undefined
      }, usuarioId);

    case "rechazarTransferencia":
      return rechazarTransferencia({ transferencia_id: Number(argumentos.transferencia_id) }, usuarioId);

    case "cancelarTransferencia":
      return cancelarTransferencia({ transferencia_id: Number(argumentos.transferencia_id) }, usuarioId);

    case "listarTransferencias":
      return listarTransferencias({ direccion: argumentos.direccion, estado: argumentos.estado }, usuarioId);

    case "listarBovinosRecibidos":
      return listarBovinosRecibidos({ estado: argumentos.estado }, usuarioId);

    case "listarBovinosEnviados":
      return listarBovinosEnviados({ estado: argumentos.estado }, usuarioId);

    case "buscarRaza":
      return buscarRaza({ nombre: String(argumentos.nombre ?? "") }, usuarioId);

    case "crearRaza":
      return crearRaza({
        nombre: String(argumentos.nombre ?? ""),
        tipo: argumentos.tipo ? String(argumentos.tipo) : undefined,
        pais_origen: argumentos.pais_origen ? String(argumentos.pais_origen) : undefined,
        descripcion: argumentos.descripcion ? String(argumentos.descripcion) : undefined
      }, usuarioId);

    case "crearRazaYBovino": {
      const race = await crearRaza({ nombre: String(argumentos.raza ?? "") }, usuarioId);
      if (!race.ok) return race;
      return crearBovino({
        nombre: String(argumentos.nombre ?? ""),
        raza: String(race.breed.nombre),
        breed_id: Number(race.breed.id),
        sexo: String(argumentos.sexo ?? ""),
        fecha_nacimiento: argumentos.fecha_nacimiento ? String(argumentos.fecha_nacimiento) : undefined,
        estado: argumentos.estado ? String(argumentos.estado) : undefined
      }, usuarioId);
    }

    case "listarRazas":
      return listarRazas({
        busqueda: argumentos.busqueda ? String(argumentos.busqueda) : undefined,
        tipo: argumentos.tipo ? String(argumentos.tipo) : undefined,
        limite: argumentos.limite ? Number(argumentos.limite) : 10
      }, usuarioId);

    case "enviarSolicitudAmistad":
      return enviarSolicitudAmistad({
        usuario_destino: String(argumentos.usuario_destino ?? ""),
        mensaje: argumentos.mensaje ? String(argumentos.mensaje) : undefined
      }, usuarioId);

    case "aceptarSolicitudAmistad":
      return aceptarSolicitudAmistad({ solicitud_id: Number(argumentos.solicitud_id) }, usuarioId);

    case "rechazarSolicitudAmistad":
      return rechazarSolicitudAmistad({ solicitud_id: Number(argumentos.solicitud_id) }, usuarioId);

    case "enviarMensaje":
      return enviarMensaje({
        usuario_destino: String(argumentos.usuario_destino ?? ""),
        mensaje: String(argumentos.mensaje ?? "")
      }, usuarioId);

    case "leerConversacion":
      return leerConversacion({ usuario_destino: String(argumentos.usuario_destino ?? "") }, usuarioId);

    case "listarConversaciones":
      return listarConversaciones({}, usuarioId);

    default:
      return null;
  }
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  const pregunta = String(body?.pregunta ?? "").trim();
  const directTool = body?.direct_tool ? String(body.direct_tool) : "";
  const directArgs = body?.direct_args && typeof body.direct_args === "object"
    ? body.direct_args as AnyObject
    : null;

  const conversationId = body?.conversation_id ? String(body.conversation_id) : null;
  const usuarioId = requireUserId(event);
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

  if (directTool && directArgs) {
    const argumentos = normalizeToolArguments(
      directTool,
      directArgs,
      nombreAnimalContexto
    );

    try {
      const resultado = await executeToolCall(
        directTool,
        argumentos,
        usuarioId,
        nombreAnimalContexto
      );

      return {
        encontrado: true,
        tool: directTool,
        argumentos,
        resultado,
        respuesta: buildRespuesta(directTool, argumentos, resultado)
      };
    } catch (error: any) {
      console.error("Error ejecutando herramienta directa de IA:", {
        tool: directTool,
        argumentos,
        error
      });

      return {
        encontrado: true,
        tool: directTool,
        argumentos,
        resultado: null,
        respuesta: "No pude completar la accion por un problema interno. Revisa los datos e intenta de nuevo."
      };
    }
  }

  const inferredAction = inferActionFromQuestion(
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

CONSULTAS (cuando el usuario PREGUNTA, no cuando pide crear/aplicar):
- getVacunas: "qué vacunas tiene", "vacunas de Lola"
- getEnfermedades, getPeso, getEdad, getHistorial, getVenta, getResumen
- Si el usuario pregunta, NUNCA crees ni modifiques registros.

ACCIONES DE CREACIÓN EN CATÁLOGO (sin asignar a bovino):
- crearDueno: solo crear dueño en catálogo
- crearRancho: solo crear rancho en catálogo
- crearVacuna: solo agregar vacuna al catálogo

ACCIONES CON ASIGNACIÓN A BOVINO:
- aplicarVacuna, registrarEnfermedad, transferirPropiedad
- Solo usa estas si el usuario pide explícitamente aplicar, asignar o transferir a un bovino.

ACCIONES CRUD:
- crearBovino, actualizarBovino, eliminarBovino
- registrarEnfermedad, actualizarEnfermedad, eliminarEnfermedad
- aplicarVacuna, eliminarVacunaAplicada, eliminarVacuna
- eliminarDueno, eliminarRancho, quitarPropiedad
- registrarPeso

TRANSFERENCIAS ENTRE CUENTAS:
- Si el usuario dice enviar, mandar o transferir un bovino a otro usuario, usa crearSolicitudTransferencia.
- transferirPropiedad solo cambia dueno o rancho dentro de la misma cuenta.
- Nunca aceptes, rechaces o canceles una transferencia sin su ID y sin la sesion autorizada.

RAZAS Y COMUNIDAD:
- Usa buscarRaza y listarRazas para consultar el catalogo global.
- No inventes razas. crearRaza requiere confirmacion del usuario.
- Usa enviarSolicitudAmistad antes del chat; enviarMensaje solo funciona entre contactos.
- Para destinatarios ambiguos, pide el correo exacto y no elijas por tu cuenta.

Reglas para vacunas vs enfermedades vs consultas (MUY IMPORTANTE):
- PREGUNTA sobre vacunas → getVacunas. ACCIÓN sobre vacunas → aplicarVacuna o crearVacuna.
- Si el usuario menciona ENFERMEDAD para registrar → registrarEnfermedad. Para consultar → getEnfermedades.
- Si el usuario pide APLICAR una vacuna a un bovino, usa aplicarVacuna (no crearVacuna).
- crearDueno/crearRancho NO asignan a bovinos. transferirPropiedad SÍ asigna a un bovino.
- Si falta el nombre del bovino para eliminar/actualizar, pregunta cuál con una lista.

Reglas estrictas para registrar bovinos:
- NO uses frases, bromas, párrafos ni texto conversacional como datos.
- Cada campo debe ser corto y concreto: nombre (ej. Lola), raza (ej. Holstein), sexo (Hembra o Macho). El arete se genera automaticamente y no debe pedirse al usuario.
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
  const argumentos = normalizeToolArguments(
    toolName,
    toolCall.arguments,
    nombreAnimalContexto
  );

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

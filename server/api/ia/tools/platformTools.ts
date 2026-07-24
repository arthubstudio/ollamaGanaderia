import { createBreed, findBreedByName, listBreeds } from "~/server/services/breedService";
import {
  acceptBovinoTransfer,
  cancelBovinoTransfer,
  createBovinoTransfer,
  listBovinoTransfers,
  rejectBovinoTransfer
} from "~/server/services/accountTransfer";
import {
  acceptFriendRequest,
  getOrCreateDirectConversation,
  listCommunityConversations,
  listFriendRequests,
  listFriends,
  readCommunityConversation,
  rejectFriendRequest,
  sendCommunityMessage,
  sendFriendRequest
} from "~/server/services/community";
import { publishPersistedCommunityMessage } from "~/server/services/communityRealtime";
import { resolveSingleUser, searchUsers } from "~/server/services/userDirectory";

function requireSession(usuarioId?: number | null) {
  if (!usuarioId) return null;
  return Number(usuarioId);
}

export async function buscarUsuario(args: { busqueda: string }, usuarioId?: number | null) {
  const userId = requireSession(usuarioId);
  if (!userId) return { ok: false as const, error: "Se requiere sesion." };
  const matches = await searchUsers(args.busqueda, userId);
  return { ok: true as const, matches };
}

export async function crearSolicitudTransferencia(args: {
  nombre_bovino: string;
  usuario_destino: string;
  destination_rancho_id?: number;
  mensaje?: string;
}, usuarioId?: number | null) {
  const userId = requireSession(usuarioId);
  if (!userId) return { ok: false as const, error: "Se requiere sesion." };
  const result = await createBovinoTransfer({
    sourceUserId: userId,
    bovinoName: args.nombre_bovino,
    destinationQuery: args.usuario_destino,
    destinationRanchoId: args.destination_rancho_id,
    message: args.mensaje
  });
  return result.ok
    ? result
    : {
        ...result,
        requiresDestinationSelection: result.reason === "ambiguous_user"
      };
}

export async function aceptarTransferencia(args: { transferencia_id: number; rancho_destino_id?: number }, usuarioId?: number | null) {
  const userId = requireSession(usuarioId);
  if (!userId) return { ok: false as const, error: "Se requiere sesion." };
  return { ok: true as const, ...(await acceptBovinoTransfer(userId, args.transferencia_id, args.rancho_destino_id)) };
}

export async function rechazarTransferencia(args: { transferencia_id: number }, usuarioId?: number | null) {
  const userId = requireSession(usuarioId);
  if (!userId) return { ok: false as const, error: "Se requiere sesion." };
  return { ok: true as const, transfer: await rejectBovinoTransfer(userId, args.transferencia_id) };
}

export async function cancelarTransferencia(args: { transferencia_id: number }, usuarioId?: number | null) {
  const userId = requireSession(usuarioId);
  if (!userId) return { ok: false as const, error: "Se requiere sesion." };
  return { ok: true as const, transfer: await cancelBovinoTransfer(userId, args.transferencia_id) };
}

export async function listarTransferencias(args: { direccion?: string; estado?: string }, usuarioId?: number | null) {
  const userId = requireSession(usuarioId);
  if (!userId) return { ok: false as const, error: "Se requiere sesion." };
  return { ok: true as const, transfers: await listBovinoTransfers(userId, args.direccion, args.estado) };
}

export const listarBovinosRecibidos = (args: { estado?: string }, usuarioId?: number | null) =>
  listarTransferencias({ direccion: "received", estado: args.estado }, usuarioId);

export const listarBovinosEnviados = (args: { estado?: string }, usuarioId?: number | null) =>
  listarTransferencias({ direccion: "sent", estado: args.estado }, usuarioId);

export async function buscarRaza(args: { nombre: string }, usuarioId?: number | null) {
  if (!requireSession(usuarioId)) return { ok: false as const, error: "Se requiere sesion." };
  const breed = await findBreedByName(args.nombre);
  return { ok: true as const, breed };
}

export async function crearRaza(args: {
  nombre: string;
  tipo?: string;
  pais_origen?: string;
  descripcion?: string;
}, usuarioId?: number | null) {
  const userId = requireSession(usuarioId);
  if (!userId) return { ok: false as const, error: "Se requiere sesion." };
  const result = await createBreed({
    userId,
    nombre: args.nombre,
    tipo: args.tipo,
    paisOrigen: args.pais_origen,
    descripcion: args.descripcion
  });
  return { ok: true as const, ...result };
}

export async function listarRazas(args: { busqueda?: string; tipo?: string; limite?: number }, usuarioId?: number | null) {
  if (!requireSession(usuarioId)) return { ok: false as const, error: "Se requiere sesion." };
  const result = await listBreeds({ search: args.busqueda, type: args.tipo, active: true, limit: Math.min(args.limite ?? 10, 10) });
  return { ok: true as const, breeds: result.items, total: result.total };
}

export async function enviarSolicitudAmistad(args: { usuario_destino: string; mensaje?: string }, usuarioId?: number | null) {
  const userId = requireSession(usuarioId);
  if (!userId) return { ok: false as const, error: "Se requiere sesion." };
  const result = await sendFriendRequest({ senderUserId: userId, recipientQuery: args.usuario_destino, message: args.mensaje });
  if (result.ok) return result;
  const errorByReason: Record<string, string> = {
    not_found: `No encontre al usuario "${args.usuario_destino}".`,
    ambiguous: "Hay varios usuarios con ese nombre. Indica el correo exacto.",
    self_request: "No puedes enviarte una solicitud de amistad a ti mismo.",
    already_friends: "Ese usuario ya esta en tus contactos.",
    already_pending: "Ya existe una solicitud de amistad pendiente entre ambas cuentas."
  };
  return {
    ...result,
    requiresDestinationSelection: result.reason === "ambiguous",
    error: errorByReason[result.reason] ?? "No se pudo enviar la solicitud de amistad."
  };
}

export async function aceptarSolicitudAmistad(args: { solicitud_id: number }, usuarioId?: number | null) {
  const userId = requireSession(usuarioId);
  if (!userId) return { ok: false as const, error: "Se requiere sesion." };
  return { ok: true as const, friendship: await acceptFriendRequest(userId, args.solicitud_id) };
}

export async function rechazarSolicitudAmistad(args: { solicitud_id: number }, usuarioId?: number | null) {
  const userId = requireSession(usuarioId);
  if (!userId) return { ok: false as const, error: "Se requiere sesion." };
  return { ok: true as const, request: await rejectFriendRequest(userId, args.solicitud_id) };
}

export async function enviarMensaje(args: { usuario_destino: string; mensaje: string }, usuarioId?: number | null) {
  const userId = requireSession(usuarioId);
  if (!userId) return { ok: false as const, error: "Se requiere sesion." };
  const recipient = await resolveSingleUser(args.usuario_destino, userId);
  if (recipient.status !== "found") {
    return {
      ok: false as const,
      reason: recipient.status,
      matches: recipient.matches,
      error: recipient.status === "not_found" ? "No encontre al destinatario." : "Indica el correo exacto del destinatario."
    };
  }
  const conversation = await getOrCreateDirectConversation(userId, recipient.user.id);
  const message = await sendCommunityMessage({ userId, conversationId: conversation.id, content: args.mensaje });
  await publishPersistedCommunityMessage(message).catch((error) => {
    console.error("No se pudo publicar el mensaje de IA por WebSocket:", error);
  });
  return { ok: true as const, conversation, message, recipient: recipient.user };
}

export async function leerConversacion(args: { usuario_destino: string }, usuarioId?: number | null) {
  const userId = requireSession(usuarioId);
  if (!userId) return { ok: false as const, error: "Se requiere sesion." };
  const recipient = await resolveSingleUser(args.usuario_destino, userId);
  if (recipient.status !== "found") return { ok: false as const, error: "Indica el correo exacto de un contacto." };
  const conversation = await getOrCreateDirectConversation(userId, recipient.user.id);
  const messages = await readCommunityConversation(userId, conversation.id);
  return { ok: true as const, conversation, recipient: recipient.user, messages };
}

export async function listarConversaciones(_args: Record<string, never>, usuarioId?: number | null) {
  const userId = requireSession(usuarioId);
  if (!userId) return { ok: false as const, error: "Se requiere sesion." };
  return {
    ok: true as const,
    conversations: await listCommunityConversations(userId),
    contacts: await listFriends(userId),
    requests: await listFriendRequests(userId)
  };
}

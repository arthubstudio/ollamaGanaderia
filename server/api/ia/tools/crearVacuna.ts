import { crearVacunaUsuario } from "~/lib/vacunaService";

export type CrearVacunaArgs = {
  nombre: string;
  descripcion?: string;
};

export async function crearVacuna(
  args: CrearVacunaArgs,
  usuarioId?: number | null
) {
  const result = await crearVacunaUsuario({
    nombre: args.nombre,
    descripcion: args.descripcion,
    usuarioId: Number(usuarioId)
  });

  if (!result.ok) {
    return { ok: false as const, error: result.error };
  }

  return { ok: true as const, vacuna: result.vacuna };
}

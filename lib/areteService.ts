import { formatAreteConsecutivo } from "~/lib/areteFormat.js";

type SqlTransaction = {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<any[]>;
};

export async function generarSiguienteArete(tx: SqlTransaction, usuarioId: number) {
  const rows = await tx`
    INSERT INTO bovino_arete_sequences (usuario_id, last_value)
    VALUES (${usuarioId}, 1)
    ON CONFLICT (usuario_id)
    DO UPDATE SET last_value = bovino_arete_sequences.last_value + 1,
                  updated_at = NOW()
    RETURNING last_value
  `;

  return formatAreteConsecutivo(rows[0]?.last_value);
}

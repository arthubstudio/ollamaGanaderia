export function formatAreteConsecutivo(value) {
  const consecutivo = Number(value);
  if (!Number.isInteger(consecutivo) || consecutivo < 1 || consecutivo > 9999) {
    throw new Error("ARETE_SEQUENCE_EXHAUSTED");
  }
  return `MX-${String(consecutivo).padStart(4, "0")}`;
}

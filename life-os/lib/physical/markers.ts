/** Notas que la importación de Segundo Cerebro usa como marca; no son texto del usuario. */
export function isImportMarker(notes: string | null | undefined) {
  return !!notes && (notes === "Importado de Segundo Cerebro" || /^segundo-cerebro:\d+$/.test(notes));
}

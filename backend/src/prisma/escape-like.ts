export function escaparLike(valor: string) {
  return valor.replace(/[\\%_]/g, String.raw`\$&`);
}

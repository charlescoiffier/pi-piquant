/** Garde uniquement les chiffres 0-9 d'une saisie libre. */
export function freeDigits(input: string, count: number): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < input.length && out.length < count; i++) {
    const c = input.charCodeAt(i);
    if (c >= 48 && c <= 57) out.push(c - 48);
  }
  return Uint8Array.from(out);
}

/**
 * Formatta un numero in formato italiano: punto per migliaia, virgola per decimali.
 * Es: 36502.63 → "36.502,63", -5000 → "-5.000,00"
 * Implementazione manuale per garantire il formato anche in SSR senza ICU.
 */
export function formatItalianNumber(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (!isFinite(num)) return "";
  const isNegative = num < 0;
  const fixed = Math.abs(num).toFixed(2);
  const [intPart, decPart] = fixed.split(".");
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const result = `${withThousands},${decPart}`;
  return isNegative ? `-${result}` : result;
}

/**
 * Parsifica un numero in formato italiano (o inglese) restituendo un float.
 * Es: "36.502,63" → 36502.63, "36502.63" → 36502.63
 */
export function parseItalianNumber(raw: string): number {
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  return parseFloat(normalized);
}

/**
 * Valuta una formula con supporto per la variabile `prev`.
 * Es: "=prev+100" con prev=1000 → 1100
 */
export function evaluateFormula(input: string, prev: number | null): number | null {
  if (!input.startsWith("=")) return null;
  const expr = input.slice(1).trim();
  const prevValue = prev ?? 0;
  try {
    const withPrev = expr.replace(/prev/gi, prevValue.toString());
    const sanitized = withPrev.replace(/,/g, ".");
    if (!/^[\d\s+\-*/().]+$/.test(sanitized)) return null;
    const result = new Function(`return (${sanitized})`)();
    if (typeof result !== "number" || !isFinite(result)) return null;
    return Math.round(result * 100) / 100;
  } catch {
    return null;
  }
}

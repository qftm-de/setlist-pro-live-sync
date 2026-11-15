/** UUID v4 ohne feste Rückfallkennung. getRandomValues gibt es auch ohne TLS. */
export function neueUuid(quelle: Crypto = globalThis.crypto): string {
  if (quelle && typeof quelle.randomUUID === "function") {
    return quelle.randomUUID();
  }
  if (!quelle || typeof quelle.getRandomValues !== "function") {
    throw new Error("Dieser Browser stellt keine sichere Zufallsquelle bereit.");
  }
  const bytes = new Uint8Array(16);
  quelle.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((wert) => wert.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Eroare cu cod stabil și o indicație pentru utilizator (în română). Nu se înghit erori în tăcere. */
export class MmsError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly hint?: string,
  ) {
    super(message);
    this.name = "MmsError";
  }
}

export function formatError(e: unknown): string {
  if (e instanceof MmsError) return `[${e.code}] ${e.message}${e.hint ? `\n  → ${e.hint}` : ""}`;
  if (e instanceof Error) return e.stack ?? e.message;
  return String(e);
}

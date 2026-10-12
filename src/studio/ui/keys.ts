/**
 * Chei React stabile pentru listele afișate: din conținutul elementului, cu numărul aparițiilor pentru
 * duplicate. Spre deosebire de index, cheia rămâne a aceluiași element când lista se schimbă.
 */
export function keyed<T>(items: readonly T[], keyOf: (item: T) => string): Array<{ key: string; item: T }> {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const base = keyOf(item);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return { key: n ? `${base}#${n}` : base, item };
  });
}

/**
 * Straturile de text, într-un singur loc (compilatorul, validatorul și critica le folosesc la fel).
 * LAYOUT = textul se așază cu fontul real (rânduri + mărime calculate la compilare).
 */
export const LAYOUT_TEXT_CAPS: ReadonlySet<string> = new Set([
  "text.word-reveal",
  "text.char-reveal",
  "text.mask-reveal",
  "text.slam",
  "text.pop",
  "text.blur-reveal",
  "text.tracking",
  "text.typewriter",
  "text.split",
  "text.highlight",
  "text.outline-fill",
  "text.glitch",
  "text.big-word",
  "text.body",
]);

/** Textul care se citește pe ecran (testul de 360 px, timpul de citire, zonele sigure). */
export const READABLE_TEXT_CAPS: ReadonlySet<string> = new Set([...LAYOUT_TEXT_CAPS, "text.counter"]);

export const DATA_CAPS: ReadonlySet<string> = new Set(["text.counter", "data.bars", "data.line", "data.ring", "data.compare", "data.pie"]);

/** Capabilitățile care afișează o captură sau un material ca interfață. */
export const SCREEN_CAPS: ReadonlySet<string> = new Set(["media.screen", "media.device-3d", "media.stack-3d", "ui.zoom-lens", "media.cards"]);

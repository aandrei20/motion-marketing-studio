import fontsJson from "../../library/fonts/fonts.json";
import type { TimelineFont } from "../core/schema";

export interface LibraryFont {
  id: string;
  family: string;
  style?: string;
  file: string;
  weight: string;
  axes: string[];
  roles: string[];
  personality: string[];
  license: string;
  source: string;
}

export const LIBRARY_FONTS: LibraryFont[] = fontsJson.fonts as LibraryFont[];

export function libraryFont(id: string): LibraryFont {
  const f = LIBRARY_FONTS.find((x) => x.id === id);
  if (!f) throw new Error(`Fontul „${id}” nu există în library/fonts/fonts.json`);
  return f;
}

export function toTimelineFont(f: LibraryFont): TimelineFont {
  return { family: f.family, src: f.file, weight: f.weight, style: f.style === "italic" ? "italic" : "normal" };
}

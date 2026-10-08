import fs from "node:fs";
import path from "node:path";

/** Buffer audio stereo, eșantioane float în [-1, 1]. */
export interface Stereo {
  sr: number;
  L: Float32Array;
  R: Float32Array;
}

export const SR = 48000;

export function makeStereo(n: number, sr = SR): Stereo {
  return { sr, L: new Float32Array(n), R: new Float32Array(n) };
}

export function stereoLength(s: Stereo): number {
  return s.L.length;
}

/** Citește WAV PCM 16/24/32 biți sau float 32 (mono sau stereo). */
export function readWav(file: string): Stereo {
  const buf = fs.readFileSync(file);
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") throw new Error(`Nu e WAV: ${file}`);
  let off = 12;
  let fmt: { format: number; channels: number; sr: number; bits: number } | null = null;
  let dataOff = -1;
  let dataLen = 0;
  while (off + 8 <= buf.length) {
    const id = buf.toString("ascii", off, off + 4);
    const len = buf.readUInt32LE(off + 4);
    if (id === "fmt ") {
      let format = buf.readUInt16LE(off + 8);
      if (format === 0xfffe) format = buf.readUInt16LE(off + 8 + 24); // WAVE_FORMAT_EXTENSIBLE: sub-format
      fmt = { format, channels: buf.readUInt16LE(off + 10), sr: buf.readUInt32LE(off + 12), bits: buf.readUInt16LE(off + 22) };
    } else if (id === "data") {
      dataOff = off + 8;
      dataLen = Math.min(len, buf.length - dataOff);
      break;
    }
    off += 8 + len + (len % 2);
  }
  if (!fmt || dataOff < 0) throw new Error(`WAV fără fmt/data: ${file}`);
  const bytes = fmt.bits / 8;
  const frames = Math.floor(dataLen / (bytes * fmt.channels));
  const out = makeStereo(frames, fmt.sr);
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < Math.min(2, fmt.channels); c++) {
      const p = dataOff + (i * fmt.channels + c) * bytes;
      let v: number;
      if (fmt.format === 3 && fmt.bits === 32) v = buf.readFloatLE(p);
      else if (fmt.bits === 16) v = buf.readInt16LE(p) / 32768;
      else if (fmt.bits === 24) v = buf.readIntLE(p, 3) / 8388608;
      else if (fmt.bits === 32) v = buf.readInt32LE(p) / 2147483648;
      else if (fmt.bits === 8) v = (buf.readUInt8(p) - 128) / 128;
      else throw new Error(`Format WAV nesuportat: ${fmt.bits} biți`);
      (c === 0 ? out.L : out.R)[i] = v;
    }
    if (fmt.channels === 1) out.R[i] = out.L[i];
  }
  return out;
}

/** Scrie WAV PCM 24 biți stereo (cu dither TPDF determinist la cuantizare). */
export function writeWav(file: string, s: Stereo, bits: 16 | 24 = 24): void {
  const n = s.L.length;
  const bytes = bits / 8;
  const data = Buffer.alloc(n * 2 * bytes);
  const max = bits === 16 ? 32767 : 8388607;
  let seed = 22222;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 2; c++) {
      const v = (c === 0 ? s.L : s.R)[i];
      const d = (rnd() - rnd()) / max; // TPDF ±1 LSB
      const q = Math.max(-max - 1, Math.min(max, Math.round((v + d) * max)));
      const p = (i * 2 + c) * bytes;
      if (bits === 16) data.writeInt16LE(q, p);
      else data.writeIntLE(q, p, 3);
    }
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(2, 22);
  header.writeUInt32LE(s.sr, 24);
  header.writeUInt32LE(s.sr * 2 * bytes, 28);
  header.writeUInt16LE(2 * bytes, 32);
  header.writeUInt16LE(bits, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(data.length, 40);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.concat([header, data]));
}

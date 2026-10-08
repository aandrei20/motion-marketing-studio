/**
 * Vocea: furnizori TTS printr-o interfață comună + vocea utilizatorului din fișier.
 *  - windows   : voci Windows OneCore (offline, gratuit; ex. „Microsoft Andrei” ro-RO), cu marcaje de cuvinte
 *  - say       : macOS `say` (offline), fără marcaje de cuvinte (se estimează)
 *  - espeak    : Linux `espeak-ng` (offline, calitate redusă), fără marcaje
 *  - elevenlabs: API (cheie ELEVENLABS_API_KEY), cu marcaje pe caractere
 *  - openai    : API (cheie OPENAI_API_KEY), fără marcaje
 * Fiecare clip se ține în cache după (furnizor, voce, viteză, text).
 */
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { optionalEnv, requireEnv } from "../core/env";
import { MmsError } from "../core/errors";
import { PATHS } from "../core/paths";
import type { VoiceWord } from "../core/schema";
import { decodeAudio, trimSilence } from "./decode";
import { Biquad } from "./dsp";
import { readWav, writeWav, type Stereo } from "./wav";

export type VoiceProvider = "windows" | "say" | "espeak" | "elevenlabs" | "openai";

export interface VoiceRequest {
  provider: VoiceProvider;
  voice: string;
  text: string;
  /** 1 = normal */
  rate?: number;
  language?: string;
}

export interface VoiceResult {
  audio: Stereo;
  words: VoiceWord[];
  wordTiming: "engine" | "estimated";
  provider: VoiceProvider | "user-file";
  voice: string;
}

function run(cmd: string, args: string[], input?: string): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { windowsHide: true });
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d.toString()));
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("error", reject);
    p.on("close", (code) => resolve({ code: code ?? -1, stdout: out, stderr: err }));
    if (input) p.stdin.end(input);
    else p.stdin.end();
  });
}

/** Timpi estimați pentru cuvinte: proporțional cu lungimea, cu pauze la punctuație. */
export function estimateWordTimes(text: string, durationSec: number): VoiceWord[] {
  const words = text.split(/\s+/).filter(Boolean);
  const weights = words.map((w) => Math.max(1, w.replace(/[^\p{L}\p{N}]/gu, "").length) + (/[.,!?;:]$/.test(w) ? 3 : 0.6));
  const total = weights.reduce((a, b) => a + b, 0);
  let t = 0;
  return words.map((w, i) => {
    const d = (weights[i] / total) * durationSec;
    const start = t;
    t += d;
    return { text: w, startSec: start, endSec: t - (/[.,!?;:]$/.test(w) ? d * 0.3 : 0) };
  });
}

async function windowsTts(req: VoiceRequest, work: string): Promise<{ wav: string; words: Array<{ text: string; start: number }> }> {
  const textFile = path.join(work, "text.txt");
  const wav = path.join(work, "out.wav");
  const meta = path.join(work, "meta.json");
  fs.writeFileSync(textFile, req.text, "utf8");
  const script = path.join(PATHS.root, "scripts", "tts", "winrt-tts.ps1");
  const r = await run("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script, "-TextFile", textFile, "-Voice", req.voice, "-Out", wav, "-MetaOut", meta, "-Rate", String(req.rate ?? 1)]);
  if (r.code !== 0 || !fs.existsSync(wav)) throw new MmsError("TTS_FAILED", `Sinteza Windows a eșuat: ${r.stderr.slice(-800)}`, "Verifică numele vocii cu: npm run mms -- voices");
  const m = JSON.parse(fs.readFileSync(meta, "utf8").replace(/^﻿/, "")) as { words: Array<{ text: string; start: number }> | { text: string; start: number } };
  const words = Array.isArray(m.words) ? m.words : m.words ? [m.words] : [];
  return { wav, words };
}

export async function listVoices(): Promise<Array<{ provider: VoiceProvider; name: string; language: string; gender?: string }>> {
  const out: Array<{ provider: VoiceProvider; name: string; language: string; gender?: string }> = [];
  if (process.platform === "win32") {
    const f = path.join(PATHS.cache, "voices.json");
    fs.mkdirSync(PATHS.cache, { recursive: true });
    const r = await run("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(PATHS.root, "scripts", "tts", "winrt-voices.ps1"), "-Out", f]);
    if (r.code === 0 && fs.existsSync(f)) {
      const raw = JSON.parse(fs.readFileSync(f, "utf8").replace(/^﻿/, "")) as Array<{ name: string; language: string; gender: string }> | { name: string; language: string; gender: string };
      for (const v of Array.isArray(raw) ? raw : [raw]) out.push({ provider: "windows", name: v.name, language: v.language, gender: v.gender });
    }
  }
  if (process.platform === "darwin") {
    const r = await run("say", ["-v", "?"]);
    for (const line of r.stdout.split("\n")) {
      const m = line.match(/^(.+?)\s{2,}([a-z]{2}[_-][A-Z]{2})/);
      if (m) out.push({ provider: "say", name: m[1].trim(), language: m[2].replace("_", "-") });
    }
  }
  if (optionalEnv("ELEVENLABS_API_KEY")) out.push({ provider: "elevenlabs", name: "(voice_id din contul ElevenLabs)", language: "multi" });
  if (optionalEnv("OPENAI_API_KEY")) out.push({ provider: "openai", name: "alloy | echo | fable | onyx | nova | shimmer", language: "multi" });
  return out;
}

/** Lanț de procesare pentru voce: high-pass, căldură, prezență, nivelare lentă (clar pe difuzor de telefon). */
export function polishVoice(s: Stereo): Stereo {
  const chain = () => [new Biquad("highpass", 75, 0.707), new Biquad("peaking", 180, 0.9, 1.0), new Biquad("peaking", 3500, 0.8, 2.2), new Biquad("highshelf", 9000, 0.7, 1.2)];
  const cl = chain();
  const cr = chain();
  const n = s.L.length;
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let l = s.L[i];
    let r = s.R[i];
    for (const f of cl) l = f.tick(l);
    for (const f of cr) r = f.tick(r);
    L[i] = l;
    R[i] = r;
  }
  // nivelare RMS ~3:1 deasupra pragului (fereastră 50 ms), câștig netezit
  const win = Math.round(0.05 * s.sr);
  const g = new Float32Array(n);
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += (L[i] * L[i] + R[i] * R[i]) / 2;
    if (i >= win) acc -= (L[i - win] * L[i - win] + R[i - win] * R[i - win]) / 2;
    const rms = Math.sqrt(Math.max(0, acc) / win) + 1e-9;
    const thr = 0.08;
    g[i] = rms > thr ? (thr * (rms / thr) ** (1 / 3)) / rms : 1;
  }
  let sm = 1;
  const k = Math.exp(-1 / win);
  for (let i = 0; i < n; i++) {
    sm = g[i] + (sm - g[i]) * k;
    L[i] *= sm;
    R[i] *= sm;
  }
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const norm = peak > 0 ? 0.89 / peak : 1;
  for (let i = 0; i < n; i++) {
    L[i] *= norm;
    R[i] *= norm;
  }
  return { sr: s.sr, L, R };
}

function words(text: string, engine: Array<{ text: string; start: number }>, headSec: number, duration: number): VoiceWord[] {
  if (!engine.length) return estimateWordTimes(text, duration);
  const textWords = text.split(/\s+/).filter(Boolean);
  const starts = engine.map((w) => Math.max(0, w.start - headSec));
  // folosim cuvintele din textul original (cu diacritice și punctuație) dacă numărul coincide
  const src = textWords.length === engine.length ? textWords : engine.map((w) => w.text);
  return src.map((w, i) => ({ text: w, startSec: starts[i], endSec: i + 1 < starts.length ? Math.max(starts[i] + 0.05, starts[i + 1] - 0.02) : duration }));
}

/** Sintetizează o replică (cu cache). */
export async function synthesize(req: VoiceRequest, cacheDir: string): Promise<VoiceResult & { file: string }> {
  const key = crypto.createHash("sha256").update(JSON.stringify([req.provider, req.voice, req.rate ?? 1, req.text])).digest("hex").slice(0, 20);
  const file = path.join(cacheDir, `${key}.wav`);
  const metaFile = path.join(cacheDir, `${key}.json`);
  if (fs.existsSync(file) && fs.existsSync(metaFile)) {
    const meta = JSON.parse(fs.readFileSync(metaFile, "utf8")) as { words: VoiceWord[]; wordTiming: "engine" | "estimated" };
    return { audio: readWav(file), words: meta.words, wordTiming: meta.wordTiming, provider: req.provider, voice: req.voice, file };
  }
  fs.mkdirSync(cacheDir, { recursive: true });
  const work = path.join(PATHS.cache, "tts-work", key);
  fs.mkdirSync(work, { recursive: true });
  let raw: Stereo;
  let engineWords: Array<{ text: string; start: number }> = [];
  switch (req.provider) {
    case "windows": {
      if (process.platform !== "win32") throw new MmsError("TTS_UNAVAILABLE", "Vocile Windows sunt disponibile doar pe Windows.");
      const r = await windowsTts(req, work);
      raw = await decodeAudio(r.wav);
      engineWords = r.words;
      break;
    }
    case "say": {
      const out = path.join(work, "out.wav");
      const r = await run("say", ["-v", req.voice, "-r", String(Math.round(180 * (req.rate ?? 1))), "-o", out, "--file-format=WAVE", "--data-format=LEI16@48000", req.text]);
      if (r.code !== 0) throw new MmsError("TTS_FAILED", `macOS say a eșuat: ${r.stderr}`);
      raw = await decodeAudio(out);
      break;
    }
    case "espeak": {
      const out = path.join(work, "out.wav");
      const r = await run("espeak-ng", ["-v", req.voice, "-s", String(Math.round(165 * (req.rate ?? 1))), "-w", out, req.text]);
      if (r.code !== 0) throw new MmsError("TTS_FAILED", `espeak-ng a eșuat (este instalat?): ${r.stderr}`);
      raw = await decodeAudio(out);
      break;
    }
    case "elevenlabs": {
      const apiKey = requireEnv("ELEVENLABS_API_KEY", "vocea ElevenLabs");
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(req.voice)}/with-timestamps`, {
        method: "POST",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ text: req.text, model_id: optionalEnv("ELEVENLABS_MODEL") ?? "eleven_multilingual_v2", voice_settings: { stability: 0.5, similarity_boost: 0.75, speed: req.rate ?? 1 } }),
      });
      if (!res.ok) throw new MmsError("TTS_FAILED", `ElevenLabs a răspuns ${res.status}: ${(await res.text()).slice(0, 400)}`);
      const j = (await res.json()) as { audio_base64: string; alignment?: { characters: string[]; character_start_times_seconds: number[] } };
      const mp3 = path.join(work, "out.mp3");
      fs.writeFileSync(mp3, Buffer.from(j.audio_base64, "base64"));
      raw = await decodeAudio(mp3);
      if (j.alignment) {
        let cur = "";
        let start = 0;
        j.alignment.characters.forEach((ch, i) => {
          if (/\s/.test(ch)) {
            if (cur) engineWords.push({ text: cur, start });
            cur = "";
          } else {
            if (!cur) start = j.alignment!.character_start_times_seconds[i];
            cur += ch;
          }
        });
        if (cur) engineWords.push({ text: cur, start });
      }
      break;
    }
    case "openai": {
      const apiKey = requireEnv("OPENAI_API_KEY", "vocea OpenAI");
      const res = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: optionalEnv("OPENAI_TTS_MODEL") ?? "gpt-4o-mini-tts", voice: req.voice, input: req.text, response_format: "wav", speed: req.rate ?? 1 }),
      });
      if (!res.ok) throw new MmsError("TTS_FAILED", `OpenAI a răspuns ${res.status}: ${(await res.text()).slice(0, 400)}`);
      const wav = path.join(work, "out.wav");
      fs.writeFileSync(wav, Buffer.from(await res.arrayBuffer()));
      raw = await decodeAudio(wav);
      break;
    }
    default:
      throw new MmsError("TTS_UNKNOWN", `Furnizor de voce necunoscut: ${String(req.provider)}`);
  }
  const { audio: trimmed, headSec } = trimSilence(raw);
  const polished = polishVoice(trimmed);
  const duration = polished.L.length / polished.sr;
  const w = words(req.text, engineWords, headSec, duration);
  const timing = engineWords.length ? "engine" : "estimated";
  writeWav(file, polished, 24);
  fs.writeFileSync(metaFile, JSON.stringify({ words: w, wordTiming: timing, provider: req.provider, voice: req.voice, text: req.text }, null, 2));
  fs.rmSync(work, { recursive: true, force: true });
  return { audio: readWav(file), words: w, wordTiming: timing, provider: req.provider, voice: req.voice, file };
}

/** Vocea utilizatorului dintr-un fișier: decodare, curățare, timpi de cuvinte estimați din transcriere. */
export async function voiceFromFile(file: string, transcript: string): Promise<VoiceResult> {
  const raw = await decodeAudio(file);
  const { audio } = trimSilence(raw);
  const polished = polishVoice(audio);
  const duration = polished.L.length / polished.sr;
  return { audio: polished, words: transcript ? estimateWordTimes(transcript, duration) : [], wordTiming: "estimated", provider: "user-file", voice: path.basename(file) };
}

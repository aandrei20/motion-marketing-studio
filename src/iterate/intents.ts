/**
 * Iterație în limbaj natural (română și engleză), cu schimbări locale: fiecare comandă devine o
 * operație pe storyboard/script, aplicată într-o versiune nouă, cu jurnal de schimbări.
 * Ce nu se recunoaște aici se cere lui Claude în Claude Code (care editează JSON-ul și validează).
 */
import { MmsError } from "../core/errors";
import { parseTimeToSec } from "../core/time";
import type { Brief, CreativeDirection, Script, Storyboard, StoryboardScene, Timeline } from "../core/schema";
import type { AssetManifest } from "../core/schema";
import { bestRegion } from "../recipes/kit";

export type Op =
  | { op: "zoom-at"; sec: number; target: string }
  | { op: "cta-hold"; sec: number }
  | { op: "transitions-speed"; factor: number }
  | { op: "music-under-voice"; deltaDb: number }
  | { op: "music-level"; deltaDb: number }
  | { op: "music-off" }
  | { op: "use-original-hook" }
  | { op: "hook-energy"; style: "aggressive" | "calm" }
  | { op: "direction"; direction: CreativeDirection }
  | { op: "scene-length"; sec: number | null; sceneIndex: number | null; deltaSec: number }
  | { op: "set-text-at"; sec: number; text: string }
  | { op: "replace-asset-at"; sec: number; assetId: string }
  | { op: "sfx-level"; deltaDb: number };

const N = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[„”"]/g, '"');

const num = (s: string | undefined, d: number) => (s ? Number(s.replace(",", ".")) : d);

/** Interpretează o comandă. Întoarce lista de operații sau aruncă o eroare cu exemple. */
export function parseCommand(input: string): Op[] {
  const raw = input.trim();
  const t = N(raw);
  const ops: Op[] = [];
  const timeMatch = t.match(/(?:la|at|secunda|second|sec\.?|@)\s*(\d{1,2}:\d{2}(?:\.\d+)?|\d+(?:[.,]\d+)?)\s*(?:s|sec|secunde)?/);
  const sec = timeMatch ? parseTimeToSec(timeMatch[1]) : null;

  if (/(zoom|mareste|mărește|apropie|push)/.test(t) && sec !== null) {
    const target = raw.replace(/.*?(?:zoom|push)(?:-in)?\s*(?:pe|in|into|on|la|spre|to)?\s*/i, "").replace(/^(the|pe|la)\s+/i, "").trim() || "zona principală";
    ops.push({ op: "zoom-at", sec, target });
  }
  const hold = t.match(/(?:cta|card(?:ul)? final|final card|end card)[^\d]*(?:hold|sa stea|stea|ramana|tine|holds?)?[^\d]*(\d+(?:[.,]\d+)?)\s*(?:s|sec|secunde|seconds?)/);
  if (hold) ops.push({ op: "cta-hold", sec: num(hold[1], 2.5) });
  if (/(tranziti\w*|transitions?)[^.]*?(mai rapid\w*|faster|quicker|mai scurt\w*)/.test(t) || /(faster|mai rapide?) (tranziti\w*|transitions?)/.test(t)) ops.push({ op: "transitions-speed", factor: 0.6 });
  if (/(tranziti\w*|transitions?)[^.]*?(mai lent\w*|slower|mai lung\w*)/.test(t)) ops.push({ op: "transitions-speed", factor: 1.4 });
  if (/(mai putina muzica|less music|lower the music|muzica mai incet)[^.]*(sub voce|under the voice|under voice)/.test(t) || /(sub voce|under the voice)[^.]*(mai putina|less|mai incet)/.test(t)) ops.push({ op: "music-under-voice", deltaDb: -5 });
  else if (/(muzica mai tare|more music|louder music)/.test(t)) ops.push({ op: "music-level", deltaDb: 3 });
  else if (/(muzica mai incet|less music|quieter music|lower the music)/.test(t)) ops.push({ op: "music-level", deltaDb: -3 });
  if (/(fara muzica|no music|scoate muzica|remove the music)/.test(t)) ops.push({ op: "music-off" });
  if (/(efecte(le)? sonore mai incet|less sfx|quieter (sound )?effects)/.test(t)) ops.push({ op: "sfx-level", deltaDb: -4 });
  if (/(efecte(le)? sonore mai tare|louder (sound )?effects|more sfx)/.test(t)) ops.push({ op: "sfx-level", deltaDb: 3 });
  if (/(fraza (mea )?(exacta|originala)|original phrase|exact phrase|ce ti-am dat|i gave you)/.test(t)) ops.push({ op: "use-original-hook" });
  if (/hook/.test(t) && /(agresiv|aggressive|mai puternic|stronger|punchier)/.test(t)) ops.push({ op: "hook-energy", style: "aggressive" });
  if (/hook/.test(t) && /(mai calm|calmer|mai bland|softer)/.test(t)) ops.push({ op: "hook-energy", style: "calm" });
  const dirMap: Array<[RegExp, CreativeDirection]> = [
    [/(mai )?premium|cinematic|luxos|luxury/, "premium"],
    [/emotional|mai cald|warmer/, "emotional"],
    [/mai agresiv\b(?!.*hook)|more aggressive(?!.*hook)/, "aggressive"],
    [/mai tehnic|more technical/, "technical"],
    [/mai minimal|more minimal|mai simplu|simpler/, "minimal"],
    [/mai energic|more energetic|mai social/, "energetic"],
  ];
  if (/(fa|make|sa para|feel|mai|more)/.test(t) && !/hook/.test(t)) for (const [re, d] of dirMap) if (re.test(t)) {
    ops.push({ op: "direction", direction: d });
    break;
  }
  const len = t.match(/scena\s*(\d+)[^\d]*(mai (lunga|scurta)|longer|shorter)[^\d]*(?:cu|by)?\s*(\d+(?:[.,]\d+)?)?/) ?? t.match(/scene\s*(\d+)[^\d]*(longer|shorter)[^\d]*(?:by)?\s*(\d+(?:[.,]\d+)?)?/);
  if (len) {
    const longer = /lunga|longer/.test(len[0]);
    const amount = num(len[len.length - 1], 1);
    ops.push({ op: "scene-length", sec: null, sceneIndex: Number(len[1]) - 1, deltaSec: longer ? amount : -amount });
  }
  const txt = raw.match(/(?:textul|text)[^„"]*?(?:la|at)\s*([\d:.,]+)[^„"]*?[„"](.+?)[”"]/i);
  if (txt) {
    const s2 = parseTimeToSec(txt[1]);
    if (s2 !== null) ops.push({ op: "set-text-at", sec: s2, text: txt[2] });
  }
  const repl = raw.match(/(?:inlocuieste|înlocuiește|replace)[^\d]*(?:la|at)\s*([\d:.,]+)[^\w]*(?:cu|with)\s+([a-z0-9-]+)/i);
  if (repl) {
    const s3 = parseTimeToSec(repl[1]);
    if (s3 !== null) ops.push({ op: "replace-asset-at", sec: s3, assetId: repl[2] });
  }
  if (!ops.length)
    throw new MmsError(
      "COMMAND_UNKNOWN",
      `Nu recunosc comanda „${raw}”.`,
      'Exemple: „la 00:14 zoom pe câmpul de căutare”, „CTA-ul să stea 3 secunde”, „tranziții mai rapide”, „mai puțină muzică sub voce”, „folosește fraza mea exactă”, „fă hook-ul mai agresiv”, „fă-l mai premium”, „scena 2 mai lungă cu 1 secundă”, „schimbă textul la 5 în „…””. Pentru altceva, cere-i lui Claude în Claude Code.',
    );
  return ops;
}

export interface ApplyContext {
  storyboard: Storyboard;
  script: Script;
  brief: Brief;
  timeline: Timeline;
  assets: AssetManifest;
}

function sceneAt(ctx: ApplyContext, sec: number): { sb: StoryboardScene; idx: number } {
  const f = Math.round(sec * ctx.timeline.fps);
  const tl = [...ctx.timeline.scenes].reverse().find((s) => f >= s.from && f < s.from + s.durationInFrames) ?? ctx.timeline.scenes[ctx.timeline.scenes.length - 1];
  const idx = ctx.storyboard.scenes.findIndex((s) => s.id === tl.id);
  if (idx < 0) throw new MmsError("SCENE_MISSING", `Scena de la ${sec}s nu mai există în storyboard.`);
  return { sb: ctx.storyboard.scenes[idx], idx };
}

/** Aplică operațiile pe copii ale storyboard-ului și scriptului. Întoarce descrierea fiecărei schimbări. */
export function applyOps(ctx: ApplyContext, ops: Op[]): { storyboard: Storyboard; script: Script; changes: Array<{ op: string; description: string; params: Record<string, unknown> }> } {
  const sb: Storyboard = structuredClone(ctx.storyboard);
  const script: Script = structuredClone(ctx.script);
  const changes: Array<{ op: string; description: string; params: Record<string, unknown> }> = [];
  const work = { ...ctx, storyboard: sb };
  const fps = ctx.timeline.fps;
  for (const o of ops) {
    switch (o.op) {
      case "zoom-at": {
        const { sb: s } = sceneAt(work, o.sec);
        const assetId = (Array.isArray(s.slots.screen) ? s.slots.screen[0] : s.slots.screen) ?? s.focus?.assetId;
        const asset = ctx.assets.assets.find((a) => a.id === assetId);
        if (!asset) throw new MmsError("ZOOM_NO_SCREEN", `Scena de la ${o.sec}s (${s.id}) nu are o captură pe care să se facă zoom.`);
        const region = bestRegion(asset.capture?.regions ?? [], o.target, ["input", "button", "custom", "heading", "nav", "image", "text"]);
        if (!region) throw new MmsError("ZOOM_NO_REGION", `Nu găsesc în captură o zonă potrivită pentru „${o.target}”.`);
        s.focus = { assetId: asset.id, region: region.id };
        const tl = ctx.timeline.scenes.find((x) => x.id === s.id)!;
        const local = Math.max(0, Math.round(o.sec * fps) - tl.from) / tl.durationInFrames;
        s.camera = { capability: "camera.push", params: { from: 1, to: null, start: Math.min(0.8, local), end: Math.min(1, local + 0.35), ease: "inOut" } };
        changes.push({ op: o.op, description: `Zoom pe „${region.label}” la ${o.sec}s (scena ${s.id}).`, params: { sceneId: s.id, region: region.id } });
        break;
      }
      case "cta-hold": {
        const s = sb.scenes.find((x) => x.narrativeRole === "cta");
        if (!s) throw new MmsError("NO_CTA", "Nu există scenă de CTA.");
        const tl = ctx.timeline.scenes.find((x) => x.id === s.id);
        const current = tl ? tl.durationInFrames / fps : 3;
        s.durationSec = Math.max(current, current - 2.5 + o.sec);
        changes.push({ op: o.op, description: `CTA-ul ține ${o.sec}s nemișcat (scena ${s.id}: ${s.durationSec.toFixed(2)}s).`, params: { sceneId: s.id, holdSec: o.sec } });
        break;
      }
      case "transitions-speed": {
        for (const s of sb.scenes.slice(1)) {
          const tl = ctx.timeline.scenes.find((x) => x.id === s.id);
          const cur = tl?.transitionIn;
          if (!cur || cur.durationInFrames === 0) continue;
          s.transitionIn = { capability: cur.capability, durationFrames: Math.max(2, Math.round(cur.durationInFrames * o.factor)), params: cur.params };
        }
        changes.push({ op: o.op, description: o.factor < 1 ? "Tranziții mai rapide (×0,6)." : "Tranziții mai lente (×1,4).", params: { factor: o.factor } });
        break;
      }
      case "music-under-voice":
        sb.audio.duckDb = Math.max(-30, sb.audio.duckDb + o.deltaDb);
        changes.push({ op: o.op, description: `Muzica scade mai mult sub voce (ducking ${sb.audio.duckDb} dB).`, params: { duckDb: sb.audio.duckDb } });
        break;
      case "music-level":
        sb.audio.musicGainDb += o.deltaDb;
        changes.push({ op: o.op, description: `Muzica ${o.deltaDb > 0 ? "mai tare" : "mai încet"} (${sb.audio.musicGainDb > 0 ? "+" : ""}${sb.audio.musicGainDb} dB).`, params: { musicGainDb: sb.audio.musicGainDb } });
        break;
      case "sfx-level":
        sb.audio.sfxGainDb += o.deltaDb;
        changes.push({ op: o.op, description: `Efecte sonore ${o.deltaDb > 0 ? "mai tare" : "mai încet"} (${sb.audio.sfxGainDb} dB).`, params: { sfxGainDb: sb.audio.sfxGainDb } });
        break;
      case "music-off":
        sb.audio.music = false;
        changes.push({ op: o.op, description: "Fără muzică în această versiune.", params: {} });
        break;
      case "use-original-hook": {
        const original = ctx.brief.userVision.hooks[0];
        if (!original) throw new MmsError("NO_USER_HOOK", "În brief nu există un hook scris de utilizator.");
        const hook = script.lines.find((l) => l.isHook);
        if (!hook) throw new MmsError("NO_HOOK", "Scriptul nu are replică de hook.");
        hook.voiceover = original;
        hook.onScreen = original;
        hook.origin = "user-verbatim";
        hook.claimIds = [];
        const scene = sb.scenes.find((s) => s.lineIds.includes(hook.id));
        if (scene) scene.text = { ...scene.text, headline: original };
        changes.push({ op: o.op, description: `Hook-ul folosește exact fraza utilizatorului: „${original}”.`, params: { lineId: hook.id } });
        break;
      }
      case "hook-energy": {
        const s = sb.scenes[0];
        s.energy = o.style === "aggressive" ? Math.min(1, s.energy + 0.2) : Math.max(0.3, s.energy - 0.2);
        s.recipe = { id: "hook-kinetic", params: s.recipe.id === "hook-kinetic" ? s.recipe.params : {} };
        s.overrides = s.overrides.filter((x) => !x.slot.startsWith("text."));
        if (o.style === "aggressive") {
          s.overrides.push({ slot: "text-", capability: "text.slam", params: { fromScale: 2.6, shake: 18 } });
          s.camera = { capability: "camera.shake", params: { hits: [0.05, 0.5], strength: "medium", zoom: 1.04 } };
          s.durationSec = s.durationSec ? Math.max(1.2, s.durationSec * 0.85) : null;
        } else {
          s.overrides.push({ slot: "text-", capability: "text.blur-reveal", params: {} });
          s.camera = { capability: "camera.push", params: { from: 1, to: 1.08, ease: "out" } };
        }
        changes.push({ op: o.op, description: o.style === "aggressive" ? "Hook mai agresiv: slam, tremur pe impact, energie mai mare, puțin mai scurt." : "Hook mai calm: apariție din blur, push lent.", params: { sceneId: s.id } });
        break;
      }
      case "direction":
        sb.direction = o.direction;
        for (const s of sb.scenes) s.transitionIn = null;
        changes.push({ op: o.op, description: `Direcția acestei versiuni devine „${o.direction}” (tranzițiile se aleg din nou).`, params: { direction: o.direction } });
        break;
      case "scene-length": {
        const s = o.sceneIndex !== null ? sb.scenes[o.sceneIndex] : sceneAt(work, o.sec ?? 0).sb;
        if (!s) throw new MmsError("SCENE_MISSING", "Scena cerută nu există.");
        const tl = ctx.timeline.scenes.find((x) => x.id === s.id);
        const cur = s.durationSec ?? (tl ? tl.durationInFrames / fps : 2);
        s.durationSec = Math.max(0.8, cur + o.deltaSec);
        changes.push({ op: o.op, description: `Scena ${s.id}: ${cur.toFixed(2)}s → ${s.durationSec.toFixed(2)}s.`, params: { sceneId: s.id } });
        break;
      }
      case "set-text-at": {
        const { sb: s } = sceneAt(work, o.sec);
        const before = s.text.headline ?? "";
        s.text = { ...s.text, headline: o.text };
        changes.push({ op: o.op, description: `Textul scenei ${s.id}: „${before}” → „${o.text}”.`, params: { sceneId: s.id } });
        break;
      }
      case "replace-asset-at": {
        const { sb: s } = sceneAt(work, o.sec);
        const a = ctx.assets.assets.find((x) => x.id === o.assetId);
        if (!a) throw new MmsError("ASSET_MISSING", `Nu există materialul ${o.assetId}.`);
        const slot = Object.keys(s.slots).find((k) => k !== "logo") ?? "screen";
        s.slots = { ...s.slots, [slot]: a.id };
        if (s.focus) s.focus = undefined;
        changes.push({ op: o.op, description: `Scena ${s.id}: materialul din „${slot}” devine ${a.id}.`, params: { sceneId: s.id, assetId: a.id } });
        break;
      }
    }
  }
  return { storyboard: sb, script, changes };
}

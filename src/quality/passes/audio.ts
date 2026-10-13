/** Pasa 6 a buclei de calitate: audio. */
import type { IssueDraft } from "../issues";
import type { CheckDef } from "../checks";

export const AUDIO_CHECKS: CheckDef[] = [
  {
    id: "audio.mix",
    version: 1,
    pass: "audio",
    title: "Raportul mixului: −14 LUFS, true peak, clipping, tăceri; voce acoperită; beat grid sigur",
    categories: ["audio"],
    method: "audio",
    perFormat: false,
    run: (ctx, fid) => {
      const t = ctx.timelines[fid];
      const out: IssueDraft[] = [];
      if (!ctx.mix)
        return [
          {
            frame: null,
            sceneId: null,
            dimension: "audio",
            severity: "high",
            problem: "Versiunea nu are încă mix audio.",
            recommendation: "Rulează pasul audio (mms audio).",
            method: "audio",
          },
        ];
      for (const p of ctx.mix.problems)
        out.push({
          frame: null,
          sceneId: null,
          dimension: "audio",
          severity: "high",
          problem: p,
          recommendation: "Ajustează muzica/efectele sau marchează tăcerea ca intenționată.",
          method: "audio",
        });
      for (const s of ctx.mix.silences.filter((x) => !x.intentional))
        out.push({
          frame: Math.round(s.startSec * t.fps),
          sceneId: null,
          durationSec: s.endSec - s.startSec,
          dimension: "audio",
          severity: "medium",
          problem: `Tăcere neintenționată ${(s.endSec - s.startSec).toFixed(1)} s.`,
          recommendation: "Muzica sau un efect trebuie să acopere golul (sau marchează scena cu tăcere intenționată).",
          method: "audio",
        });
      const bg = t.audio.beatGrid;
      if (bg && bg.source === "detected" && bg.confidence < 0.35)
        out.push({
          frame: null,
          sceneId: null,
          dimension: "beat-sync",
          severity: "low",
          problem: `Tempo-ul muzicii e detectat cu încredere mică (${bg.confidence.toFixed(2)}): tăieturile nu se aliniază pe bătăi.`,
          recommendation: "Fixează tempo-ul în brief (audio.music.bpm) dacă îl știi; altfel ascultă și notează pe timestamp.",
          method: "audio",
          confidence: 0.9,
        });
      const voiceFrames = t.audio.cues.filter((c) => c.kind === "voice").length;
      if (ctx.brief.audio.voice.mode !== "none" && voiceFrames === 0)
        out.push({
          frame: null,
          sceneId: null,
          dimension: "audio",
          severity: "high",
          problem: "Brief-ul cere voce, dar timeline-ul nu are nicio replică de voce.",
          recommendation: "Verifică vocea (mms voice) și recompilează.",
          method: "audio",
        });
      return out;
    },
  },
];

/** Audio: vocea și mixul, ajustările, notele tale după ascultare și cue sheet-ul. */
import { useState } from "react";
import type { Ctx } from "../App";
import { api, fileUrl } from "../api";
import { captionsOf, Section, tc } from "../common";

export function AudioPanel({ ctx }: { ctx: Ctx }) {
  const m = ctx.version?.mixReport;
  const tl = ctx.version?.timelines[ctx.formatId];
  const [notes, setNotes] = useState("");
  const mixUrl = tl?.audio.src ? fileUrl(tl.audio.src) : null;
  const cap = captionsOf(ctx);
  return (
    <div className="cols">
      <Section
        title="Mix"
        aside={
          <button type="button" className="btn" onClick={() => ctx.runJob("audio")}>
            Refă mixul
          </button>
        }
      >
        {m ? (
          <>
            <div className="stats">
              <div>
                <b>{m.integratedLufs ?? "—"}</b>
                <span>LUFS (țintă {m.targetLufs})</span>
              </div>
              <div>
                <b>{m.truePeakDbtp}</b>
                <span>dBTP (plafon {m.truePeakCeiling})</span>
              </div>
              <div>
                <b>{m.clippedSamples}</b>
                <span>eșantioane la limită</span>
              </div>
              <div>
                <b>{m.silences.filter((s) => !s.intentional).length}</b>
                <span>tăceri neintenționate</span>
              </div>
            </div>
            <p className={m.ok ? "ok" : "warn"}>{m.ok ? "Mixul trece verificările tehnice." : m.problems.join(" ")}</p>
            {mixUrl ? (
              cap ? (
                <audio controls src={mixUrl} className="wide">
                  <track kind="captions" src={cap.src} srcLang={cap.lang} label="Subtitrări" default />
                </audio>
              ) : (
                // biome-ignore lint/a11y/useMediaCaption: fără voce în reclamă nu există replici de subtitrat
                <audio controls src={mixUrl} className="wide" />
              )
            ) : null}
            <p className="muted small">Recenzenții AI nu aud: ascultă cu atenție (pe telefon, la volum normal) și notează problemele pe timestamp.</p>
          </>
        ) : (
          <p>Nu există încă un mix pentru această versiune.</p>
        )}
        <h3>Ajustări (versiune nouă, prin comenzi)</h3>
        <div className="steps">
          {["mai puțină muzică sub voce", "muzica mai tare", "muzica mai încet", "efectele sonore mai încet", "fără muzică"].map((c) => (
            <button type="button" key={c} className="btn tiny" onClick={() => ctx.runJob("iterate", { command: c })}>
              {c}
            </button>
          ))}
        </div>
        <h3>Notele tale după ascultare</h3>
        <textarea rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={"secunda 7,3: logo-ul e prea mic\n11: muzica sună ciudat"} />
        <button
          type="button"
          className="btn primary"
          disabled={!notes.trim() || !ctx.versionId || !tl}
          onClick={async () => {
            const findings = notes
              .split("\n")
              .map((l) => l.trim())
              .filter(Boolean)
              .map((l) => {
                const mm = l.match(/(\d{1,2}:\d{2}(?:[.,]\d+)?|\d+(?:[.,]\d+)?)\s*[:\-–]\s*(.+)/);
                const sec = mm
                  ? mm[1].includes(":")
                    ? Number(mm[1].split(":")[0]) * 60 + Number(mm[1].split(":")[1].replace(",", "."))
                    : Number(mm[1].replace(",", "."))
                  : null;
                const frame = sec !== null ? Math.round(sec * tl!.fps) : null;
                const scene = frame !== null ? (tl!.scenes.filter((s) => s.from <= frame).slice(-1)[0]?.id ?? null) : null;
                return {
                  frame,
                  timecode: frame !== null ? tc(frame, tl!.fps) : null,
                  sceneId: scene,
                  dimension: "audio" as const,
                  severity: "high" as const,
                  problem: mm ? mm[2] : l,
                  recommendation: "Corectează doar zona notată.",
                };
              });
            try {
              await api.review(ctx.bundle.project.id, ctx.versionId!, { reviewer: "user-notes", findings });
              ctx.notify(`${findings.length} note salvate în critica versiunii.`);
              setNotes("");
              await ctx.reload();
            } catch (e) {
              ctx.notify((e as Error).message, "err");
            }
          }}
        >
          Salvează notele
        </button>
      </Section>
      <Section title={`Cue sheet (${ctx.version?.cueSheet?.length ?? 0})`}>
        <p className="muted small">Fiecare efect vizual își declară sunetul; vocea și efectele au momentul exact.</p>
        {/* biome-ignore lint/a11y/noNoninteractiveTabindex: zona derulabilă trebuie să se poată derula și din tastatură (WCAG 2.1.1, axe „scrollable-region-focusable”) */}
        <section className="scroll" aria-label="Cue sheet: momentele sonore" tabIndex={0}>
          <table className="table">
            <thead>
              <tr>
                <th>Timp</th>
                <th>Tip</th>
                <th>Sunet</th>
                <th>dB</th>
                <th>De ce</th>
              </tr>
            </thead>
            <tbody>
              {(ctx.version?.cueSheet ?? []).map((c) => (
                <tr key={c.id} onClick={() => ctx.seek(c.atFrame)} className="clickable">
                  <td>
                    <code>{c.timecode}</code>
                  </td>
                  <td>{c.kind}</td>
                  <td>{c.kind === "voice" ? c.sound.split("/").pop() : c.sound}</td>
                  <td>{c.gainDb}</td>
                  <td className="small">{c.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </Section>
    </div>
  );
}

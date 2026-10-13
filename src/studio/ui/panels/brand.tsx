/** Brand kit-ul: culori, tipografie, logo și regulile lui. */
import { useEffect, useState } from "react";
import type { Ctx } from "../App";
import { api } from "../api";
import { Section } from "../common";

export function BrandPanel({ ctx }: { ctx: Ctx }) {
  const [b, setB] = useState(ctx.bundle.brand);
  useEffect(() => setB(ctx.bundle.brand), [ctx.bundle.brand]);
  if (!b)
    return (
      <Section title="Brand kit">
        <p>Nu există încă. Se deduce din captura site-ului și din logo.</p>
        <button type="button" className="btn primary" onClick={() => ctx.runJob("brand")}>
          Deduce brand kit-ul
        </button>
      </Section>
    );
  const colorKeys = ["primary", "accent", "secondary", "background", "surface", "text", "textMuted"] as const;
  const logos = ctx.bundle.assets.assets.filter((a) => a.role === "logo");
  const fonts = ["Inter", "Archivo", "Space Grotesk", "Instrument Serif", "JetBrains Mono", "Manrope"];
  const fontRef: Record<string, string> = {
    Inter: "inter",
    Archivo: "archivo",
    "Space Grotesk": "space-grotesk",
    "Instrument Serif": "instrument-serif",
    "JetBrains Mono": "jetbrains-mono",
    Manrope: "manrope",
  };
  return (
    <div className="cols">
      <Section title="Culori" aside={<span className="muted small">sursă: {b.colors.origin}</span>}>
        <div className="colors">
          {colorKeys.map((k) => (
            <label key={k} className="color">
              <input
                type="color"
                value={(b.colors[k] as string | undefined) ?? "#000000"}
                onChange={(e) => setB({ ...b, colors: { ...b.colors, [k]: e.target.value, origin: "user" } })}
              />
              <span>{k}</span>
              <code>{b.colors[k]}</code>
            </label>
          ))}
        </div>
        <div className="brand-preview" style={{ background: b.colors.background, color: b.colors.text, fontFamily: b.typography.display.family }}>
          <div style={{ fontSize: 34, fontWeight: 800 }}>
            Titlu cu <span style={{ color: b.colors.accent }}>accent</span>
          </div>
          <div style={{ fontFamily: b.typography.body.family, color: b.colors.textMuted }}>Text secundar în fontul de corp.</div>
          <span className="pill" style={{ background: b.colors.primary }}>
            Buton principal
          </span>
        </div>
      </Section>
      <Section title="Tipografie, logo, reguli">
        {(["display", "body"] as const).map((role) => (
          <label key={role}>
            Font {role === "display" ? "titluri" : "corp"}
            <select
              value={b.typography[role].family}
              onChange={(e) =>
                setB({
                  ...b,
                  typography: {
                    ...b.typography,
                    [role]: { ...b.typography[role], family: e.target.value, source: "library", ref: fontRef[e.target.value] },
                    origin: "user",
                  },
                })
              }
            >
              {fonts.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>
        ))}
        <label className="check">
          <input
            type="checkbox"
            checked={b.typography.display.uppercase}
            onChange={(e) => setB({ ...b, typography: { ...b.typography, display: { ...b.typography.display, uppercase: e.target.checked } } })}
          />{" "}
          titluri cu majuscule
        </label>
        <label>
          Logo principal
          <select value={b.logo.primary ?? ""} onChange={(e) => setB({ ...b, logo: { ...b.logo, primary: e.target.value || undefined } })}>
            <option value="">—</option>
            {logos.map((l) => (
              <option key={l.id} value={l.id}>
                {l.originalName}
              </option>
            ))}
          </select>
        </label>
        <p className="muted small">Logo-ul se folosește la scară uniformă: fără recolorare, rotire sau deformare.</p>
        <button
          type="button"
          className="btn primary"
          onClick={async () => {
            try {
              await api.saveBrand(ctx.bundle.project.id, b);
              ctx.notify("Brand salvat. Recompilează versiunea ca să se aplice.");
              await ctx.reload();
            } catch (e) {
              ctx.notify((e as Error).message, "err");
            }
          }}
        >
          Salvează brand kit-ul
        </button>
      </Section>
    </div>
  );
}

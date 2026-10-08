import React, { useState } from "react";
import { api, type Meta } from "./api";

const CATEGORIES = ["saas", "mobile-app", "desktop-app", "website", "ai-product", "developer-tool", "fintech", "productivity", "creative-tool", "ecommerce", "startup", "enterprise", "digital-service", "other"];
const PLATFORMS = ["tiktok", "reels", "shorts", "youtube", "feed", "linkedin", "x", "generic"];

interface FormatRow {
  preset: string;
  width: number;
  height: number;
  platform: string;
  fps: number;
  durationSec: number;
}

export function NewProject({ meta, onCancel, onCreated, notify }: { meta: Meta; onCancel: () => void; onCreated: (id: string) => void; notify: (m: string, k?: "ok" | "err") => void }) {
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [product, setProduct] = useState("");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState("saas");
  const [textLang, setTextLang] = useState("");
  const [voiceLang, setVoiceLang] = useState("");
  const [formats, setFormats] = useState<FormatRow[]>([{ preset: "9x16", width: 1080, height: 1920, platform: "tiktok", fps: 30, durationSec: 30 }]);
  const slug = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  const set = (i: number, patch: Partial<FormatRow>) => setFormats((f) => f.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  return (
    <div className="card form-card">
      <h1>Proiect nou</h1>
      <p className="muted">Datele de bază. Restul (obiectiv, public, poveste, direcție, audio) se completează în Brief, prin întrebările A–H.</p>
      <div className="grid2">
        <label>
          Numele proiectului
          <input value={name} onChange={(e) => { setName(e.target.value); if (!id) setId(slug(e.target.value)); }} placeholder="Reclamă lansare toamnă" />
        </label>
        <label>
          Id (folder)
          <input value={id} onChange={(e) => setId(slug(e.target.value))} placeholder="lansare-toamna" />
        </label>
        <label>
          Produsul
          <input value={product} onChange={(e) => setProduct(e.target.value)} placeholder="Numele produsului" />
        </label>
        <label>
          Adresa (URL)
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
        </label>
        <label>
          Tipul produsului
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <div className="grid2 tight">
          <label>
            Limba textului (obligatoriu)
            <input value={textLang} onChange={(e) => setTextLang(e.target.value)} placeholder="ro, en, …" />
          </label>
          <label>
            Limba vocii
            <input value={voiceLang} onChange={(e) => setVoiceLang(e.target.value)} placeholder="ro, en, … (gol = fără voce)" />
          </label>
        </div>
      </div>
      <h3>Formate</h3>
      <table className="table">
        <thead>
          <tr>
            <th>Preset</th>
            <th>Lățime × înălțime</th>
            <th>Platformă</th>
            <th>FPS</th>
            <th>Durată (s)</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {formats.map((f, i) => (
            <tr key={i}>
              <td>
                <select value={f.preset} onChange={(e) => set(i, { preset: e.target.value })}>
                  {[...meta.formats, "custom"].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </td>
              <td>
                {f.preset === "custom" ? (
                  <span className="row">
                    <input type="number" value={f.width} onChange={(e) => set(i, { width: Number(e.target.value) })} /> ×
                    <input type="number" value={f.height} onChange={(e) => set(i, { height: Number(e.target.value) })} />
                  </span>
                ) : (
                  <span className="muted">din preset</span>
                )}
              </td>
              <td>
                <select value={f.platform} onChange={(e) => set(i, { platform: e.target.value })}>
                  {PLATFORMS.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </td>
              <td>
                <select value={f.fps} onChange={(e) => set(i, { fps: Number(e.target.value) })}>
                  {[24, 25, 30, 50, 60].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </td>
              <td>
                <input type="number" min={3} max={600} value={f.durationSec} onChange={(e) => set(i, { durationSec: Number(e.target.value) })} />
              </td>
              <td>{formats.length > 1 ? <button className="btn ghost" onClick={() => setFormats((x) => x.filter((_, k) => k !== i))}>×</button> : null}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn ghost" onClick={() => setFormats((f) => [...f, { preset: "16x9", width: 1920, height: 1080, platform: "youtube", fps: 30, durationSec: f[0]?.durationSec ?? 30 }])}>
        + format
      </button>
      <div className="actions">
        <button className="btn ghost" onClick={onCancel}>
          Renunță
        </button>
        <button
          className="btn primary"
          disabled={!id || !product || !textLang}
          onClick={async () => {
            try {
              await api.createProject({
                id,
                name: name || id,
                product: { name: product, url: url || undefined, category },
                formats: formats.map((f) => ({ preset: f.preset === "custom" ? undefined : f.preset, width: f.width, height: f.height, fps: f.fps, durationSec: f.durationSec, platform: f.platform })),
                textLang,
                voiceLang: voiceLang || null,
              });
              notify("Proiect creat.");
              onCreated(id);
            } catch (e) {
              notify((e as Error).message, "err");
            }
          }}
        >
          Creează proiectul
        </button>
      </div>
    </div>
  );
}

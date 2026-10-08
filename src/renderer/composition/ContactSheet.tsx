import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";

export type ContactSheetProps = {
  images: string[];
  labels: string[];
  cols: number;
  cellWidth: number;
  cellHeight: number;
  title: string;
};

/** Foaie de contact: cadrele unui preview într-o grilă, cu timecode, pentru revizuire rapidă. */
export const ContactSheet: React.FC<ContactSheetProps> = ({ images, labels, cols, cellWidth, cellHeight, title }) => {
  const pad = 12;
  const header = 56;
  return (
    <AbsoluteFill style={{ background: "#111217", fontFamily: "sans-serif" }}>
      <div style={{ position: "absolute", left: pad, top: 14, color: "#e8e8f0", fontSize: 26, fontWeight: 700 }}>{title}</div>
      {images.map((src, i) => {
        const c = i % cols;
        const r = Math.floor(i / cols);
        return (
          <div key={i} style={{ position: "absolute", left: pad + c * (cellWidth + pad), top: header + r * (cellHeight + pad + 26), width: cellWidth }}>
            <Img src={staticFile(src)} style={{ width: cellWidth, height: cellHeight, objectFit: "cover", display: "block", borderRadius: 4 }} />
            <div style={{ color: "#9aa0b8", fontSize: 18, marginTop: 4 }}>{labels[i] ?? ""}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export function contactSheetSize(n: number, cols: number, cellWidth: number, cellHeight: number): { width: number; height: number } {
  const rows = Math.ceil(n / cols);
  const w = 12 + cols * (cellWidth + 12);
  const h = 56 + rows * (cellHeight + 12 + 26) + 12;
  return { width: Math.ceil(w / 2) * 2, height: Math.ceil(h / 2) * 2 };
}

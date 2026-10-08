import React, { useEffect, useState } from "react";
import { cancelRender, continueRender, delayRender } from "remotion";
import type { TimelineFont } from "../../core/schema";
import { useAssetUrl } from "./context";

const loading = new Map<string, Promise<void>>();

function loadFont(f: TimelineFont, url: string): Promise<void> {
  const key = `${f.family}|${f.style}|${url}`;
  const existing = loading.get(key);
  if (existing) return existing;
  const p = (async () => {
    const face = new FontFace(f.family, `url("${url}")`, { weight: f.weight, style: f.style });
    await face.load();
    document.fonts.add(face);
  })();
  loading.set(key, p);
  return p;
}

/**
 * Încarcă fonturile timeline-ului înainte de a desena ceva. Copiii se randează abia după încărcare,
 * ca măsurarea textului și primul cadru să folosească fontul corect.
 */
export function FontGate({ fonts, children }: { fonts: TimelineFont[]; children: React.ReactNode }) {
  const url = useAssetUrl();
  const [handle] = useState(() => delayRender("Încarc fonturile timeline-ului", { timeoutInMilliseconds: 60_000 }));
  const [ready, setReady] = useState(false);
  const signature = fonts.map((f) => `${f.family}:${f.src}`).join(",");
  useEffect(() => {
    let cancelled = false;
    Promise.all(fonts.map((f) => loadFont(f, url(f.src))))
      .then(() => {
        if (cancelled) return;
        setReady(true);
        continueRender(handle);
      })
      .catch((e: unknown) => {
        // fără fallback tăcut: eroarea oprește randarea cu mesaj clar
        cancelRender(new Error(`Nu pot încărca fonturile (${signature}): ${(e as Error).message}`));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
  return ready ? <>{children}</> : null;
}

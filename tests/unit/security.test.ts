/**
 * Protecțiile studioului local: ce adrese poate deschide captura (SSRF) și id-urile care formează căi pe disc.
 * Fără rețea: doar IP-uri literale și nume care nu cer DNS.
 */
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkCaptureUrl, checkStepUrl, hostKind, type CheckedUrl } from "../../src/capture/url-policy";
import { MmsError } from "../../src/core/errors";
import { PATHS } from "../../src/core/paths";
import { projectDir, versionDir } from "../../src/projects/store";

const code = async (p: Promise<unknown> | (() => unknown)): Promise<string | null> => {
  try {
    await (typeof p === "function" ? p() : p);
    return null;
  } catch (e) {
    return e instanceof MmsError ? e.code : `non-MmsError: ${String(e)}`;
  }
};

describe("tipul gazdei", () => {
  it("rețeaua locală", () => {
    for (const h of [
      "127.0.0.1",
      "10.2.3.4",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.10",
      "169.254.1.1",
      "100.64.0.1",
      "0.0.0.0",
      "::1",
      "[::1]",
      "fd12::1",
      "fe80::1",
      "::ffff:127.0.0.1",
      "localhost",
      "app.localhost",
      "nas.local",
      "router",
      "printer.lan",
    ])
      expect(hostKind(h), h).toBe("local");
  });
  it("serviciile de metadate ale norilor", () => {
    for (const h of ["169.254.169.254", "metadata.google.internal", "100.100.100.200", "fd00:ec2::254"]) expect(hostKind(h), h).toBe("metadata");
  });
  it("internetul", () => {
    for (const h of ["8.8.8.8", "172.32.0.1", "93.184.215.14", "2606:4700::1111", "exemplu.ro"]) expect(hostKind(h), h).toBe("public");
  });
});

describe("adresa de start a capturii", () => {
  it("acceptă http(s) public, aplicația locală și o machetă din fișier", async () => {
    expect((await checkCaptureUrl("https://93.184.215.14/pagina")).kind).toBe("public");
    expect((await checkCaptureUrl("http://localhost:3000/")).kind).toBe("local");
    expect((await checkCaptureUrl("file:///C:/macheta/index.html")).kind).toBe("file");
  });
  it("refuză alte protocoale, datele de autentificare în adresă și metadatele", async () => {
    expect(await code(checkCaptureUrl("javascript:alert(1)"))).toBe("CAPTURE_URL");
    expect(await code(checkCaptureUrl("ftp://93.184.215.14/"))).toBe("CAPTURE_URL");
    expect(await code(checkCaptureUrl("nu e o adresă"))).toBe("CAPTURE_URL");
    expect(await code(checkCaptureUrl("https://ana:parola@93.184.215.14/"))).toBe("CAPTURE_URL");
    expect(await code(checkCaptureUrl("http://169.254.169.254/latest/meta-data/"))).toBe("CAPTURE_URL");
    expect(await code(checkCaptureUrl("http://metadata.google.internal/"))).toBe("CAPTURE_URL");
  });
  it("un pas „goto” al unei pagini publice nu duce în rețeaua locală sau pe disc", async () => {
    const pub: CheckedUrl = { url: new URL("https://93.184.215.14/"), kind: "public" };
    const loc: CheckedUrl = { url: new URL("http://localhost:3000/"), kind: "local" };
    expect(await code(checkStepUrl(pub, "https://93.184.215.14/preturi"))).toBeNull();
    expect(await code(checkStepUrl(pub, "http://127.0.0.1:8080/admin"))).toBe("CAPTURE_URL");
    expect(await code(checkStepUrl(pub, "file:///C:/Windows/win.ini"))).toBe("CAPTURE_URL");
    // pe aplicația ta locală pașii pot merge oriunde în ea, dar niciodată spre metadate
    expect(await code(checkStepUrl(loc, "http://localhost:3000/setari"))).toBeNull();
    expect(await code(checkStepUrl(loc, "http://169.254.169.254/"))).toBe("CAPTURE_URL");
  });
});

describe("id-urile care devin căi pe disc", () => {
  it("proiectul: doar slug, fără ieșire din projects/", async () => {
    expect(projectDir("reclama-mea")).toBe(path.join(PATHS.projects, "reclama-mea"));
    for (const id of ["..", "../alt-proiect", "..\\..\\windows", "a/b", "Majuscule", "", "x".repeat(81), "C:\\temp"])
      expect(await code(() => projectDir(id)), id).toBe("PROJECT_ID");
  });
  it("versiunea: doar v1, v2…, fără ieșire din versions/", async () => {
    expect(versionDir("reclama-mea", "v12")).toBe(path.join(PATHS.projects, "reclama-mea", "versions", "v12"));
    for (const v of ["..", "../../alt-proiect/versions/v1", "v1/../..", "final", "v", ""])
      expect(await code(() => versionDir("reclama-mea", v)), v).toBe("VERSION_ID");
  });
});

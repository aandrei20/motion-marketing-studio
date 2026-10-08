/**
 * Detecția datelor personale: ce trebuie prins (email, telefon, IBAN, card, CNP, ID de cont, nume din salut)
 * și ce nu trebuie confundat (date, ore, prețuri, cifre de interfață, verbul „ai”).
 */
import { describe, expect, it } from "vitest";
import { cnpValid, findPii, ibanValid, luhn } from "../../src/assets/pii";
import { ocrImage } from "../../src/assets/ocr";

const kinds = (t: string) => findPii(t).map((h) => h.kind);

describe("date personale în text", () => {
  it("prinde datele reale", () => {
    expect(kinds("Scrie-ne la ana.pop@firma.ro")).toEqual(["email"]);
    expect(kinds("Sună la 0722 123 456 oricând")).toEqual(["phone"]);
    expect(kinds("Tel: +40 21 312 45 67")).toEqual(["phone"]);
    expect(kinds("IBAN RO49 AAAA 1B31 0075 9384 0000")).toEqual(["iban"]);
    expect(kinds("Card 4111 1111 1111 1111")).toEqual(["card"]);
    expect(kinds("CNP 1800101221144")).toEqual(["cnp"]);
    expect(kinds("ID client: AB-482913")).toEqual(["account-id"]);
    expect(findPii("Bună dimineața, Ana")).toEqual([{ kind: "name", match: "Ana" }]);
    expect(findPii("Welcome back, John Smith")[0]).toEqual({ kind: "name", match: "John Smith" });
  });
  it("nu confundă datele, orele, prețurile și cifrele de interfață", () => {
    expect(kinds("29 septembrie 2026: Rezumatul de luni")).toEqual([]);
    expect(kinds("Echipă · 8 € · per utilizator / lună")).toEqual([]);
    expect(kinds("Ai 6 sarcini azi. Două sunt blocate de ieri.")).toEqual([]);
    expect(kinds("18 / 24 sarcini finalizate")).toEqual([]);
    expect(kinds("Întâlnire la 10:30, 12.10.2026")).toEqual([]);
    expect(kinds("Cod comandă 1234567890123")).toEqual([]);
  });
  it("validatorii: Luhn, IBAN mod 97, cifra de control CNP", () => {
    expect(luhn("4111111111111111")).toBe(true);
    expect(luhn("4111111111111112")).toBe(false);
    expect(ibanValid("RO49AAAA1B31007593840000")).toBe(true);
    expect(ibanValid("RO48AAAA1B31007593840000")).toBe(false);
    expect(cnpValid("1800101221144")).toBe(true);
    expect(cnpValid("1800101221145")).toBe(false);
  });
});

describe("OCR offline", () => {
  it("pe alt sistem decât Windows spune că nu e disponibil (nu inventează text)", async () => {
    if (process.platform === "win32") return;
    const r = await ocrImage(__filename);
    expect(r.available).toBe(false);
    expect(r.lines).toEqual([]);
  });
});

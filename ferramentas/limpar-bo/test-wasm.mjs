// Fixture sintética, sem dados pessoais. Executa o MuPDF WASM real no Node.
import assert from "node:assert/strict";
import * as mupdf from "mupdf";
import { cleanWithEngine } from "./cleaner-wasm.mjs";

const UUIDS = [
  "e52045a3-9084-4630-a198-13994afa179f",
  "6cd4e1ed-32ae-4904-be50-4360e5a527e9",
  "12345678-abcd-abcd-abcd-1234567890ab",
];

function makeFixture(identifier, pageCount, withWatermark = true) {
  const pdf = new mupdf.PDFDocument();
  try {
    const font = pdf.addSimpleFont(new mupdf.Font("Helvetica"), "Latin");
    for (let p = 0; p < pageCount; p++) {
      const fonts = pdf.newDictionary();
      fonts.put("F1", font);
      const resources = pdf.newDictionary();
      resources.put("Font", fonts);
      const pageObject = pdf.addPage([0, 0, 595, 842], 0, resources, "");
      pdf.insertPage(-1, pageObject);

      const parts = [
        pdf.addStream("q\n"),
        pdf.addStream("q\n"),
        pdf.addStream("BT /F1 11 Tf 50 750 Td (BO TESTE PAGINA " + (p + 1) + ") Tj ET\n"),
        pdf.addStream("Q\n"),
      ];
      if (withWatermark) {
        const mark = "Q\n/gs" + (p + 1) + " gs\n/F1 12 Tf\n" +
          Array.from({ length: 84 }, (_, j) =>
            "BT\n0.5 0.86603 -0.86603 0.5 " +
            (j * 7.3 - 115).toFixed(5) + " " +
            (j * 9.1 - 80).toFixed(5) + " Tm\n(" +
            identifier + ") Tj\nET\n"
          ).join("");
        parts.push(pdf.addStream(mark));
      }
      const array = pdf.newArray();
      for (const item of parts) array.push(item);
      pdf.findPage(p).put("Contents", array);
    }
    const output = pdf.saveToBuffer("compress=yes");
    try { return new Uint8Array(output.asUint8Array()); }
    finally { output.destroy?.(); }
  } finally { pdf.destroy?.(); }
}
function asFile(bytes, name) {
  return {
    name,
    size: bytes.length,
    arrayBuffer: async () => bytes.slice().buffer,
  };
}

for (let i = 0; i < UUIDS.length; i++) {
  const pages = i + 1;
  const input = makeFixture(UUIDS[i], pages);
  const result = await cleanWithEngine(mupdf, asFile(input, "sintetico.pdf"));
  assert.equal(result.pages, pages);
  assert.equal(result.occurrences, pages * 84);
  assert.equal(result.identifier, UUIDS[i]);
  assert.ok(result.output.length > 100);
  console.log("OK: UUID dinâmico", i + 1, pages, "página(s),", result.occurrences, "marcas");
}
let rejected = false;
try {
  const absent = makeFixture(UUIDS[0], 1, false);
  await cleanWithEngine(mupdf, asFile(absent, "sem-marca.pdf"));
} catch (error) {
  rejected = /não reconhecido/i.test(String(error.message));
}
assert.ok(rejected, "PDF sem marca deve ser rejeitado sem modificação");
console.log("OK: documento sem marca rejeitado com segurança");

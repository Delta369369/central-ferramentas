/**
 * LIMPAR B.O. — MuPDF WebAssembly (MuPDF.js / Artifex)
 * Copyright (c) 2026 Central de Ferramentas Delta VICTOR
 * Dependência: MuPDF.js (AGPL-3.0-or-later), https://mupdf.com
 *
 * Reconhecimento estrutural de UUID ou sequência numérica variável:
 * a camada reconhecida contém APENAS comandos de texto diagonal repetido, em um fluxo /Contents independente da página.
 * O operador inicial Q é preservado para manter o balanceamento gráfico.
 * Nunca edita ou envia o arquivo original.
 */

const VERSION = "3.1.0";
const DEPENDENCIES = [
  "https://cdn.jsdelivr.net/npm/mupdf@1.28.6/dist/mupdf.js",
  "https://unpkg.com/mupdf@1.28.6/dist/mupdf.js",
];
let enginePromise;

async function loadEngine() {
  if (!enginePromise) {
    enginePromise = (async () => {
      let lastError;
      for (const url of DEPENDENCIES) {
        try {
          const module = await import(url);
          const api = module.Document ? module : module.default;
          if (!api?.Document || !api?.PDFDocument)
            throw new Error("Módulo MuPDF incompleto.");
          return api;
        } catch (e) {
          lastError = e;
        }
      }
      throw new Error(
        "Não foi possível carregar MuPDF WebAssembly. Confirme a conexão e tente novamente. " +
        (lastError?.message || "")
      );
    })().catch((error) => {
      enginePromise = null;
      throw error;
    });
  }
  return enginePromise;
}

const textDecoder = new TextDecoder("latin1");
const encoder = new TextEncoder();
const prefixRE = /^\s*Q\s+\/gs\d+\s+gs\s+\/F\d+\s+12\s+Tf\s*/i;
const commandRE = /BT\s+0\.5\s+0\.86603\s+-0\.86603\s+0\.5\s+-?\d+(?:\.\d+)?\s+-?\d+(?:\.\d+)?\s+Tm\s+\(([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)\s+Tj\s+ET\s*/gi;

const numericPrefixRE = /^\s*Q\s+q\s+\/Gs\d+\s+gs\s*/;
const numericCommandRE = /q\s+0\.52532\s+0\.8509\s+-0\.8509\s+0\.52532\s+-?\d+(?:\.\d+)?\s+-?\d+(?:\.\d+)?\s+cm\s+q\s+BT\s+\/F\d+\s+15\s+Tf\s+-?\d+(?:\.\d+)?\s+-?\d+(?:\.\d+)?\s+Td\s+\((\d{10})\)\s*Tj\s+ET\s+Q\s+Q\s*/g;

function analyzeStream(bytes) {
  if (bytes.length < 400 || bytes.length > 300000) return null;
  const content = textDecoder.decode(bytes);
  for (const [type, prefix, pattern, suffix] of [
    ["UUID", prefixRE, commandRE, ""],
    ["NUMERICO", numericPrefixRE, numericCommandRE, "Q"],
  ]) {
    const initial = prefix.exec(content);
    if (!initial) continue;
    const commands = content.slice(initial[0].length);
    const matches = [...commands.matchAll(pattern)];
    if (matches.length < 8 || matches.length > 2000) continue;
    const identifier = matches[0][1].toLowerCase();
    if (matches.some(m => m[1].toLowerCase() !== identifier)) continue;
    if (commands.replace(pattern, "").trim() !== suffix) continue;
    return { type, identifier, count: matches.length };
  }
  return null;
}

function readDecoded(stream) {
  const buffer = stream.readStream();
  try {
    // Copia para fora da memória WASM antes de destruir Buffer.
    return new Uint8Array(buffer.asUint8Array());
  } finally {
    buffer.destroy?.();
  }
}

function equalBytes(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function streamsOnPage(pdf, index) {
  const page = pdf.findPage(index);
  const contents = page.get("Contents");
  if (!contents || !contents.isArray())
    throw new Error(
      "A página " + (index + 1) +
      " não contém fluxos separados compatíveis; nenhum arquivo foi modificado."
    );
  const streams = [];
  for (let i = 0; i < contents.length; i++) {
    const item = contents.get(i);
    if (!item?.isStream())
      throw new Error("Fluxo inválido na página " + (index + 1) + ".");
    streams.push(item);
  }
  if (streams.length < 2)
    throw new Error("A página " + (index + 1) + " não possui uma camada separada.");
  return streams;
}

function hasDigitalSignatureBytes(bytes) {
  // Verificação conservadora: assinaturas PAdES possuem marcador /ByteRange.
  // Busca nos bytes para evitar acessar objetos PDF potencialmente reparados.
  const marker = [47,66,121,116,101,82,97,110,103,101]; // /ByteRange
  outer: for (let i = 0; i <= bytes.length - marker.length; i++) {
    if (bytes[i] !== marker[0]) continue;
    for (let j = 1; j < marker.length; j++) {
      if (bytes[i + j] !== marker[j]) continue outer;
    }
    return true;
  }
  return false;
}

export async function cleanBO(file, progress = () => {}) {
  if (!file || file.size === 0)
    throw new Error("Selecione um PDF válido.");
  if (file.size > 75 * 1024 * 1024)
    throw new Error("O limite por arquivo é de 75 MB.");

  progress("Carregando motor MuPDF WebAssembly…");
  const mupdf = await loadEngine();
  return cleanWithEngine(mupdf, file, progress);
}

// Motor injetável para validação automatizada sem baixar arquivos do usuário.
export async function cleanWithEngine(mupdf, file, progress = () => {}) {
  progress("Abrindo arquivo no MuPDF…");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (textDecoder.decode(bytes.subarray(0, 5)) !== "%PDF-")
    throw new Error("O arquivo selecionado não é um PDF.");
  let doc;
  let savedBuffer;
  let verified;
  try {
    doc = mupdf.Document.openDocument(bytes, "application/pdf");
    if (!(doc instanceof mupdf.PDFDocument))
      throw new Error("Arquivo não foi reconhecido como PDF.");
    if (doc.needsPassword())
      throw new Error("Este PDF exige uma senha de abertura.");
    if (hasDigitalSignatureBytes(bytes))
      throw new Error(
        "Este arquivo contém assinatura digital incorporada. " +
        "Para evitar sua invalidação, a limpeza foi cancelada."
      );

    const pages = doc.countPages();
    if (pages < 1 || pages > 500)
      throw new Error("Quantidade de páginas fora do intervalo suportado.");

    // Primeiro apenas ANALISA as páginas; nenhuma alteração é feita antes
    // de confirmar a camada em todas elas.
    const plans = [];
    let total = 0;
    let identifier = null;
    let patternType = null;
    for (let p = 0; p < pages; p++) {
      progress("Identificando camada diagonal: página " + (p + 1) + "/" + pages + "…");
      const streams = streamsOnPage(doc, p);
      const snapshots = streams.map(readDecoded);
      const matches = snapshots.map(analyzeStream);
      const candidates = matches
        .map((value, index) => ({ value, index }))
        .filter(({ value }) => value !== null);
      if (candidates.length !== 1) {
        throw new Error(
          "Padrão diagonal independente não reconhecido com segurança na página " +
          (p + 1) + ". Nenhuma alteração foi salva."
        );
      }
      const { value, index } = candidates[0];
      // Permite cada boletim ter um identificador próprio.
      // Impede aceitar duas marcas diferentes no MESMO arquivo.
      if (identifier !== null && (value.identifier !== identifier || value.type !== patternType))
        throw new Error("Identificadores divergentes entre as páginas.");
      identifier = value.identifier;
      patternType = value.type;
      plans.push({ pageIndex: p, streamIndex: index, expected: snapshots });
      total += value.count;
    }

    progress("Removendo apenas os fluxos reconhecidos…");
    for (const plan of plans) {
      const stream = streamsOnPage(doc, plan.pageIndex)[plan.streamIndex];
      // O Q preserva o estado gráfico anterior. Não remova esse operador.
      stream.writeStream(encoder.encode("Q\n"));
    }

    progress("Gravando cópia local do PDF…");
    savedBuffer = doc.saveToBuffer("garbage=2,compress=yes,encrypt=none");
    const output = new Uint8Array(savedBuffer.asUint8Array());

    progress("Verificando integridade dos demais fluxos…");
    verified = mupdf.Document.openDocument(output, "application/pdf");
    if (!(verified instanceof mupdf.PDFDocument) ||
        verified.needsPassword() ||
        verified.countPages() !== pages)
      throw new Error("A cópia gerada falhou na verificação de abertura.");

    for (const plan of plans) {
      const fresh = streamsOnPage(verified, plan.pageIndex);
      if (fresh.length !== plan.expected.length)
        throw new Error("A verificação detectou mudança na estrutura da página.");
      for (let j = 0; j < fresh.length; j++) {
        const current = readDecoded(fresh[j]);
        const expected = j === plan.streamIndex
          ? encoder.encode("Q\n")
          : plan.expected[j];
        if (!equalBytes(current, expected))
          throw new Error(
            "Conteúdo não relacionado à marca sofreu alteração na página " +
            (plan.pageIndex + 1) + ". Download cancelado."
          );
      }
    }
    return { output, pages, occurrences: total, identifier, patternType, engine: "MuPDF WASM " + VERSION };
  } finally {
    verified?.destroy?.();
    savedBuffer?.destroy?.();
    doc?.destroy?.();
  }
}

export function downloadBO(file, result) {
  const url = URL.createObjectURL(new Blob([result.output], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name.replace(/\.pdf$/i, "") + "_LIMPO.pdf";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export const version = VERSION;

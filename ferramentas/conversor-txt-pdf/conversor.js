const convertButton = document.getElementById("convertTxt");
const txtInput = document.getElementById("txtInput");
const convertStatus = document.getElementById("convertStatus");

convertButton.addEventListener("click", () => {
  txtInput.value = "";
  txtInput.click();
});

txtInput.addEventListener("change", async () => {
  const file = txtInput.files[0];
  if (!file) return;

  const filename = (file.name.replace(/\.txt$/i, "") || "relatorio") + ".pdf";
  let destination = null;
  try {
    if ("showSaveFilePicker" in window) {
      destination = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: "Documento PDF", accept: { "application/pdf": [".pdf"] } }]
      });
    }
    convertButton.disabled = true;
    convertStatus.textContent = "Convertendo arquivo…";

    const [buffer, fontResponse] = await Promise.all([
      file.arrayBuffer(),
      fetch("./ferramentas/conversor-txt-pdf/fonte.ttf")
    ]);
    if (!fontResponse.ok) throw new Error("Não foi possível carregar a fonte.");
    const bytes = new Uint8Array(buffer);
    let content;
    if (bytes[0] === 0xff && bytes[1] === 0xfe) {
      content = new TextDecoder("utf-16le").decode(bytes);
    } else if (bytes[0] === 0xfe && bytes[1] === 0xff) {
      content = new TextDecoder("utf-16be").decode(bytes);
    } else {
      try {
        content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch {
        content = new TextDecoder("windows-1252").decode(bytes);
      }
    }
    const fontBytes = new Uint8Array(await fontResponse.arrayBuffer());
    let fontBinary = "";
    for (let offset = 0; offset < fontBytes.length; offset += 8192) {
      fontBinary += String.fromCharCode(...fontBytes.subarray(offset, offset + 8192));
    }
    const pdf = new window.jspdf.jsPDF({ unit: "mm", format: "a4", compress: true });
    pdf.addFileToVFS("IBMPlexMono.ttf", btoa(fontBinary));
    pdf.addFont("IBMPlexMono.ttf", "IBMPlexMono", "normal");
    pdf.setFont("IBMPlexMono", "normal");
    pdf.setFontSize(10);
    const margin = 18;
    const width = pdf.internal.pageSize.getWidth() - margin * 2;
    // Garante que as 83 colunas do relatório caibam na largura útil do A4.
    const reportWidth = pdf.getTextWidth("=".repeat(83));
    pdf.setFontSize(Math.min(10, 10 * (width - 1) / reportWidth));
    const bottom = pdf.internal.pageSize.getHeight() - margin;
    const lineHeight = 4.8;
    let y = margin;
    for (const line of content.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n")) {
      const expanded = line.replace(/\t/g, "    ");
      const wrapped = expanded ? pdf.splitTextToSize(expanded, width) : [""];
      for (const part of wrapped) {
        if (y + lineHeight > bottom) {
          pdf.addPage();
          y = margin;
        }
        if (part) pdf.text(part, margin, y);
        y += lineHeight;
      }
    }
    const blob = pdf.output("blob");
    if (destination) {
      const writable = await destination.createWritable();
      await writable.write(blob);
      await writable.close();
    } else {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
    convertStatus.textContent = "PDF gerado com sucesso.";
  } catch (error) {
    if (error.name !== "AbortError") {
      console.error(error);
      convertStatus.textContent = "Não foi possível converter o arquivo. Tente novamente.";
    }
  } finally {
    convertButton.disabled = false;
  }
});

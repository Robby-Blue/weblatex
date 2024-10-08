import * as pdf from "/pdf-viewer.js";
import * as editor from "/code-editor.js";
import * as fs from "/file-system.js";

pdf.renderPDF();

async function uploadFile(src) {
  let res = await fetch(`/files/${openFilePath}`, {
    method: "POST",
    body: JSON.stringify({ text: src }),
    headers: {
      "Content-Type": "application/json",
    },
  });
  return res.status == 200;
}

async function updatePDF() {
  let res = await fetch("/pdf/compile", {
    method: "POST",
  });
  if (res.status != 200) return;
  pdf.renderPDF();
}

let uploadTimeoutId = null;
editor.onInput((src) => {
  if (uploadTimeoutId) {
    clearTimeout(uploadTimeoutId);
  }
  uploadTimeoutId = setTimeout(async () => {
    let success = await uploadFile(src);
    if (!success) return;
    updatePDF();
  }, 1000);
});

let socketProtocol = location.protocol == "https:" ? "wss://" : "ws://";
let socketUrl = socketProtocol + location.host;

let socket = io.connect(socketUrl);
import * as pdf from "/editor/pdf-viewer.js";
import * as editor from "/editor/code-editor.js";
import * as fs from "/editor/file-system.js";

let compileButton = document.getElementById("compile-button")

function button(id, cb) {
  let element = document.getElementById(id);
  element.addEventListener("click", cb);
}

pdf.renderPDF();

async function updatePDF() {
  let res = await fetch("/pdf/compile", {
    method: "POST",
  });
  if (res.status != 200) return;
  pdf.renderPDF();

  compileButton.classList.remove("red")
}

let uploadTimeoutId = null;
editor.onInput((src) => {
  if (uploadTimeoutId) {
    clearTimeout(uploadTimeoutId);
  }
  uploadTimeoutId = setTimeout(async () => {
    compileButton.classList.add("red")
    let success = await fs.updateCurrentFile(src);
    if (!success) return;
    updatePDF();
  }, 1000);
});

let socketProtocol = location.protocol == "https:" ? "wss://" : "ws://";
let socketUrl = socketProtocol + location.host;

let socket = io.connect(socketUrl);

button("compile-button", async (event) => {
  compileButton.classList.add("red")
  if (uploadTimeoutId) {
    clearTimeout(uploadTimeoutId);
  }
  // TODO: need to upload files first
  // add fields to the fs code indicating
  // whether each file has been synced
  // then make a function to sync all
  updatePDF();
});

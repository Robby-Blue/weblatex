import * as pdf from "/projects/editor/pdf-viewer.js";
import * as editor from "/projects/editor/code-editor.js";
import * as fs from "/projects/editor/file-system.js";
import * as compileErrors from "/projects/editor/compile-error-handler.js";
import * as settings from "/jsapis/settings.js";

let pathName = decodeURIComponent(window.location.pathname);
let projectPath = pathName.substring("/projects/editor/".length);
let sid = undefined;

let compileButton = document.getElementById("compile-button");

function button(id, cb) {
    let element = document.getElementById(id);
    element.addEventListener("click", cb);
}

pdf.renderPDF();

async function updatePDF() {
    let data = { sid: sid };
    let queryString = new URLSearchParams(data).toString();
    let res = await fetch(`/api/projects/compile?${queryString}`, {
        method: "POST",
    });

    let resData = await res.json();
    compileErrors.onCompileResult(resData);

    if (res.status != 200) return;
    pdf.renderPDF();

    compileButton.classList.remove("red");
}

editor.onSave(async (src) => {
    compileButton.classList.add("red");
    let success = await fs.uploadCurrentFile(src);
    if (!success) return;

    if (!settings.getSetting("auto-compile")) return;

    let successAll = await fs.uploadAllFiles();
    if (!successAll) return;

    updatePDF();
});

button("compile-button", async (event) => {
    compileButton.classList.add("red");

    let success = await fs.uploadAllFiles();
    if (!success) return;

    updatePDF();
});

button("download-button", async (event) => {
    let anchorElement = document.createElement("a");
    anchorElement.href = `/api/projects/pdf/${projectPath}`;
    anchorElement.click();
});

let viewLinkElement = document.getElementById("view-pdf-link");
viewLinkElement.setAttribute("href", `/projects/view/${projectPath}`);

let socketProtocol = location.protocol == "https:" ? "wss://" : "ws://";
let socketUrl = socketProtocol + location.host;

let socket = io.connect(socketUrl);
socket.emit("start", { project: projectPath });
socket.on("sid", (data) => {
    sid = data.sid;
});

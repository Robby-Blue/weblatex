import * as pdf from "/projects/editor/pdf-viewer.js";
import * as editor from "/projects/editor/code-editor.js";
import * as fs from "/projects/editor/file-system.js";
import * as compileErrors from "/projects/editor/compile-error-handler.js";
import * as settings from "/jsapis/settings.js";

let pathName = decodeURIComponent(window.location.pathname);
let projectPath = pathName.substring("/projects/editor/".length);
let socket = undefined

let compileButton = document.getElementById("compile-button");

function button(id, cb) {
    let element = document.getElementById(id);
    element.addEventListener("click", cb);
}

pdf.renderPDF();

async function updatePDF() {
    if (socket == undefined) {
        // assume disconnected, docker was killed
        connectWebSocket(updatePDF)
        return
    }

    socket.emit("compile")
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

let parentPath = projectPath
if (parentPath.endsWith("/")) {
    parentPath = parentPath.substring(0, parentPath.length - 1)
}
parentPath = parentPath.substring(0, parentPath.lastIndexOf("/"))

let parentFolderLinkElement = document.getElementById("parent-folder-link");
parentFolderLinkElement.setAttribute("href", `/projects/explorer/${parentPath}`);

let gitLinkElement = document.getElementById("git-link");
gitLinkElement.setAttribute("href", `/projects/git/${parentPath}`);

let viewLinkElement = document.getElementById("view-pdf-link");
viewLinkElement.setAttribute("href", `/projects/view/${projectPath}`);

let socketProtocol = location.protocol == "https:" ? "wss://" : "ws://";
let socketUrl = socketProtocol + location.host;

function connectWebSocket(cb) {
    socket = io.connect(socketUrl, {
        reconnection: false
    });
    socket.emit("start", { project: projectPath });
    socket.on("started", (data) => {
        if (cb) {
            cb()
        }
    });
    socket.on("compiled", (data) => {
        if (data.error) {
            // assume disconnected, docker was killed
            connectWebSocket(updatePDF)
            return
        }

        compileErrors.onCompileResult(data);

        if (data.return_code != 0) return;
        pdf.renderPDF();

        compileButton.classList.remove("red");
    });
}

function toggleVisible(id) {
    let element = document.getElementById(id)
    // collapse to make it lose its size, so a bit output doesnt
    // make it scrollable
    // position absolute removes it from the dom or whatever
    // it gets rid of the extra gap
    if (element.style.visibility == "collapse") {
        element.style.visibility = "visible"
        element.style.position = "relative"
    } else {
        element.style.visibility = "collapse"
        element.style.position = "absolute"
    }
}

toggleVisible("file-picker")
document.getElementById("float-parent").addEventListener("click", (e) => {
    if (e.target != document.getElementById("float-parent"))
        return;

    let x = e.pageX
    let percent = x / window.innerWidth;
    if (percent < 0.25) {
        toggleVisible("file-picker")
    }
    if (percent > 0.75) {
        toggleVisible("output-container")
    }
});
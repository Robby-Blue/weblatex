import * as pdf from "/projects/editor/pdf-viewer.js";
import * as editor from "/projects/editor/code-editor.js";
import * as fs from "/projects/editor/file-system.js";
import * as compileErrors from "/projects/editor/compile-error-handler.js";
import * as settings from "/jsapis/settings.js";

import { BusyTexRunner, XeLatex } from '/dependencies/node_modules/texlyre-busytex/dist/index.js';

let pathName = decodeURIComponent(window.location.pathname);
let projectPath = pathName.substring("/projects/editor/".length);
let socket = undefined

let compileButton = document.getElementById("compile-button");
let compileStatusContainer = document.getElementById("compile-status-container");
let compileStatusProgress = document.getElementById("compile-status-progress");

let compilationIsLocal = null
let busytexRunner = null

async function init() {
    await settings.loadSettings()
    compilationIsLocal = settings.getSetting("compile-locally")
    if (compilationIsLocal) {
        busytexRunner = new BusyTexRunner({
            busytexBasePath: "/dependencies/busytex",
            preloadDataPackages: ["/dependencies/busytex/texlive-extra.js"],
        });
        await busytexRunner.initialize(true);
    } else {
        pdf.renderPDF(`/api/projects/pdf/${projectPath}`);
    }
}

function setCompileStatusProgress(percent, text) {
    compileStatusContainer.style.visibility = "visible"
    compileStatusProgress.style.width = `${percent * 100}%`
    if (text) {
        compileStatusProgress.innerText = text
    }
}

function button(id, cb) {
    let element = document.getElementById(id);
    element.addEventListener("click", cb);
}


async function updatePDF() {
    if (compilationIsLocal) {
        compileLocally()
        return
    }

    if (socket == undefined || !socket.connected) {
        // assume disconnected, docker was killed
        connectWebSocket(updatePDF)
        return
    }

    setCompileStatusProgress(1, "request")
    socket.emit("compile")
}

async function compileLocally() {
    const xelatex = new XeLatex(busytexRunner);
    const result = await xelatex.compile({
        input: await fs.getFileContent("main.tex"),
        additionalFiles: await fs.flattenFolder(".")
    });

    if (result.success && result.pdf) {
        const blob = new Blob([result.pdf], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        pdf.renderPDF(url);

        compileButton.classList.remove("red");
        compileStatusContainer.style.visibility = "collapse"
    }
}

editor.onSave(async () => {
    compileButton.classList.add("red");
    let success = await fs.uploadCurrentFile();
    if (!success) return;

    if (!settings.getSetting("auto-compile")) return;

    let successAll = await fs.uploadAllFiles();
    if (!successAll) return;

    updatePDF();
});

button("compile-button", async (event) => {
    compileButton.classList.add("red");

    setCompileStatusProgress(0, "save")
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

let waitIntervalId = -1
let startQueuePos = -1

let compileStartTime = -1

function updateQueuePos(data) {
    if (startQueuePos == -1) {
        startQueuePos = data.position
    }

    let absoluteDone = startQueuePos - data.position
    let decimalDone = (absoluteDone) / startQueuePos
    setCompileStatusProgress(decimalDone, `queue ${data.position}`)
}

function startCompiling(data) {
    compileStartTime = Date.now()

    let timeoutMs = getCompileTime()
    let startTime = Date.now()

    waitIntervalId = setInterval(() => {
        let elapsedMs = Date.now() - startTime
        let elapsedDecimal = elapsedMs / timeoutMs
        let progress = 1 - (1 - elapsedDecimal) ** 2

        setCompileStatusProgress(progress, "compiling")
    }, 1 / 50);
}

function connectWebSocket(cb) {
    if (socket && socket.connected) {
        socket.disconnect();
    }

    socket = io.connect(socketUrl, {
        reconnection: false
    });
    socket.on("started", (data) => {
        if (cb) {
            setCompileStatusProgress(1 / 2, "connected")
            cb()
        }
    });
    socket.on("update_queue", updateQueuePos)
    socket.on("start_compiling", startCompiling)

    socket.on("compiled", (data) => {
        window.clearInterval(waitIntervalId)
        startQueuePos = -1

        if (data.error) {
            // assume disconnected, docker was killed
            connectWebSocket(updatePDF)
            return
        }

        saveCompileTime(Date.now() - compileStartTime)

        compileStatusContainer.style.visibility = "collapse"
        compileErrors.onCompileResult(data);

        if (data.return_code != 0) return;
        pdf.renderPDF(`/api/projects/pdf/${projectPath}`);

        compileButton.classList.remove("red");

    });
    socket.emit("start", { project: projectPath });
}

function getCompileTime(time) {
    let timeoutSeconds = settings.getSetting("compile-timeout")
    let timeoutMs = timeoutSeconds * 1000

    const dataStr = localStorage.getItem("compileTimes");
    if (dataStr == null) {
        return timeoutMs
    }
    const times = JSON.parse(dataStr)
    return times[pathName] || timeoutMs
}

function saveCompileTime(time) {
    const dataStr = localStorage.getItem("compileTimes") || "{}";
    const times = JSON.parse(dataStr)
    times[pathName] = time
    localStorage.setItem("compileTimes", JSON.stringify(times))
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
await init()
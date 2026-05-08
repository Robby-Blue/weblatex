import * as fs from "/projects/editor/file-system.js";
import * as shortcuts from "/projects/editor/shortcuts.js";
import * as settings from "/jsapis/settings.js";

import {
    EditorView, EditorState, latex,
    lineNumbers,
    highlightActiveLineGutter,
    highlightSpecialChars,
    drawSelection,
    rectangularSelection,
    highlightActiveLine,
    history,
    historyKeymap,
    foldGutter,
    bracketMatching,
    foldKeymap,
    searchKeymap,
    highlightSelectionMatches,
    autocompletion,
    completionKeymap,
    closeBrackets,
    closeBracketsKeymap,
    lintKeymap,
    keymap,
    insertNewline,
    oneDark,
    Y, yCollab, WebsocketProvider
} from "/projects/editor/codemirror.bundle.js"

let pathName = decodeURIComponent(window.location.pathname);
let projectPath = pathName.substring("/projects/editor/".length);

let socketProtocol = location.protocol == "https:" ? "wss://" : "ws://";
let socketUrl = socketProtocol + location.host;

let provider = null
let ytext = null

let setup = [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    foldGutter(),
    drawSelection(),
    EditorState.allowMultipleSelections.of(true),
    bracketMatching(),
    closeBrackets(),
    autocompletion(),
    rectangularSelection(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    keymap.of([
        { key: "Mod-s", run: save },
        { key: "Mod-e", run: openShortcuts },
        { key: "Enter", run: insertNewline },
        ...closeBracketsKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...completionKeymap,
        ...lintKeymap
    ])
]


async function createExtensions(isCollab, roomKey) {
    if (provider) {
        provider.disconnect()
    }

    let extensions = [
        setup,
        latex({ enableTooltips: false }),
        oneDark,
        EditorView.updateListener.of(handleUpdate),
        EditorView.lineWrapping,
    ]

    if (isCollab) {
        let doc = new Y.Doc()
        provider = new WebsocketProvider(socketUrl, `y/rooms/${roomKey}`, doc)
        ytext = doc.getText("src")

        provider.awareness.setLocalStateField("user", {
            name: "Anonymous " + Math.floor(Math.random() * 100)
        })

        let y = yCollab(ytext, provider.awareness)
        extensions.push(y)
    }

    return extensions
}

let save_callback = null

let editorDiv = document.getElementById("editor");
let editorView = null

let uploadTimeoutId = null

let cursorPos = 0

function handleUpdate(update) {
    cursorPos = editorView.state.selection.main.head
    if (!update.docChanged) {
        return
    }

    let src = update.state.doc.toString();
    fs.updateCurrentFile(src)

    if (!settings.getSetting("auto-save")) return;

    if (uploadTimeoutId) {
        clearTimeout(uploadTimeoutId);
    }

    uploadTimeoutId = setTimeout(async () => {
        save_callback();
    }, 10000);
}

async function init() {
    editorView = new EditorView({
        parent: editorDiv
    })
}

export async function showFile(file_path, src) {
    let roomKey = `${projectPath}/${file_path}`

    let r = await fetch(`/y/status/${roomKey}`);
    let roomData = await r.json()

    let isCollab = roomData.is_collab

    editorView.setState(
        EditorState.create({
            extensions: await createExtensions(isCollab, roomKey)
        })
    )

    if (isCollab) {
        if (!roomData.exists) {
            ytext.insert(0, src)
        }
    } else {
        editorView.dispatch({
            changes: {
                from: 0,
                to: editorView.state.doc.length,
                insert: src
            }
        });
    }
}

function openShortcuts() {
    let openShortcutField = document.getElementById("open-shortcut-field");
    openShortcutField.focus();
}

function save() {
    save_callback()
    return true
}

export function onSave(cb) {
    save_callback = cb
}

init()

shortcuts.onShortcut((shortcut, kwargs) => {
    let changes = shortcut(editorView.state.doc.toString(), cursorPos, kwargs)
    console.log(changes)
    editorView.dispatch({
        changes: changes
    })
})
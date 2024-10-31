let shortcutsPopup = document.getElementById("shortcuts-popup")
let shortcutsContent = document.getElementById("shortcuts-content")
let openShortcutField = document.getElementById("open-shortcut-field");
let shortcutField = document.getElementById("shortcut-field");

let executeShortcut_cb;

export function onShortcut(cb) {
  executeShortcut_cb = cb
}

function table(src, pos) {
  let text = `
\\begin{center}
\\begin{tabular}{ |c|c| }
\\hline
 1 & 2 \\\\ 
\\hline
 3 & 4 \\\\  
\\hline
\\end{tabular}
\\end{center}`;

  return insertText(src, pos, text);
}

function toggledarkmode(src, pos) {
  if(!src.includes("\\usepackage{darkmode}")){
    let docPos = src.indexOf("documentclass")
    let startPos = src.indexOf("\n", docPos) + 1
    src = insertText(src, startPos, "\\usepackage{darkmode}\n")
  }
  if(!src.includes("\\enabledarkmode")){
    let docPos = src.indexOf("usepackage{darkmode}")
    let startPos = src.indexOf("\n", docPos) + 1
    src = insertText(src, startPos, "\\enabledarkmode\n")
    
    return src
  }

  let commandPos = src.indexOf("\\enabledarkmode")
  let newlinePos = src.lastIndexOf("\n", commandPos)
  let commentPos = src.lastIndexOf("%", commandPos)
  let commentInLine = commentPos > newlinePos
  if(commentInLine){
    src = removeText(src, commentPos, 1)
  } else {
    src = insertText(src, newlinePos+1, "%")
  }
  return src
}

function insertText(src, pos, text) {
  let srcStart = src.substring(0, pos);
  let srcEnd = src.substring(pos);
  return srcStart + text + srcEnd;
}

function removeText(src, pos, chars) {
  let srcStart = src.substring(0, pos);
  let srcEnd = src.substring(pos+chars);
  return srcStart + srcEnd;
}

let shortcuts = [
  {
    "name": "table",
    "description": "create a table",
    "func": table
  },
  {
    "name": "toggledarkmode",
    "description": "toggle darkmode",
    "func": toggledarkmode
  }
]

function searchShortcuts(query) {
  return shortcuts
    .map((shortcut) => {
      let points = 0
      for(let c of query) {
        if(shortcut.name.charAt(points) == c){
          points += 1
        }
      }
      shortcut.points = points
      return shortcut
    })
    .sort((a, b) => b.points - a.points)
    .slice(0, 10)
}

function showShortcuts(query) {
  shortcutsContent.innerHTML = ""

  let shownShortcuts = searchShortcuts(query)
  for(let shortcut of shownShortcuts) {
    let shortcutDiv = document.createElement("div")
    shortcutDiv.classList.add("shortcut")

    let shortcutName = document.createElement("p")
    shortcutName.innerText = shortcut.name
    shortcutDiv.appendChild(shortcutName)

    let shortcutDescription = document.createElement("p")
    shortcutDescription.innerText = shortcut.description
    shortcutDiv.appendChild(shortcutDescription)

    shortcutsContent.appendChild(shortcutDiv)
  }
}

openShortcutField.addEventListener("focusin", (event) => {
  shortcutField.value = "";
  shortcutsPopup.classList.add("visible")
  shortcutField.focus()
  showShortcuts("")
});

shortcutField.addEventListener("focusout", (event) => {
  shortcutField.value = "";
  shortcutsPopup.classList.remove("visible")
});

shortcutField.addEventListener("keyup", (event) => {
  if (event.key === "Escape") {
    shortcutsPopup.classList.remove("visible")
  }
  if (event.key === "Enter") {
    let results = searchShortcuts(shortcutField.value);
    if (!results) {
      return;
    }
    let shortcutFunc = results[0].func

    executeShortcut_cb(shortcutFunc)
    shortcutField.value = "";
    shortcutsPopup.classList.remove("visible")
  }

  showShortcuts(event.target.value)
});
let popupBackground = document.getElementById("popup-background")
let shortcutsPopup = document.getElementById("shortcuts-popup");
let shortcutsContent = document.getElementById("shortcuts-content");
let openShortcutField = document.getElementById("open-shortcut-field");
let shortcutField = document.getElementById("shortcut-field");

let executeShortcut_cb;

export function onShortcut(cb) {
  executeShortcut_cb = cb;
}

function table(src, pos, kwargs) {
  if (kwargs.width < 0 || kwargs.height < 0) {
    return false;
  }

  let headerCols = "c|".repeat(kwargs.width);
  let tableCols = "v & ".repeat(kwargs.width).slice(0, -2);
  let tableRow = ` ${tableCols}\\\\\n\\hline\n`;
  let tableRows = tableRow.repeat(kwargs.height);

  let text = `
\\begin{center}
\\begin{tabular}{ |${headerCols} }
\\hline
${tableRows}
\\end{tabular}
\\end{center}`;

  return insertText(src, pos, text);
}

function matrix(src, pos, kwargs) {
  // TODO: add kwargs to allow other
  // kinda of matrices like pmatrix too
  if (kwargs.width < 0 || kwargs.height < 0) {
    return false;
  }

  let tableCols = "v & ".repeat(kwargs.width).slice(0, -2);
  let tableRow = ` ${tableCols}\\\\\n`;
  let tableRows = tableRow.repeat(kwargs.height);

  let text = `
\\[
\\begin{bmatrix}
${tableRows}
\\end{bmatrix}
\\]`;

  src = insertText(src, pos, text);
  src = addPackage("amsmath", src);
  return src;
}

function vector(src, pos, kwargs) {
  if (kwargs.n < 0) {
    return false;
  }

  let innerCode = "v \\\\ ".repeat(kwargs.n).slice(0, -4);

  let text = `\\begin{pmatrix} ${innerCode} \\end{pmatrix}`

  src = insertText(src, pos, text);
  src = addPackage("amsmath", src);
  return src;
}

function toggledarkmode(src, _, _2) {
  src = addPackage("darkmode", src);
  if (!src.includes("\\enabledarkmode")) {
    let docPos = src.indexOf("usepackage{darkmode}");
    let startPos = src.indexOf("\n", docPos) + 1;
    src = insertText(src, startPos, "\\enabledarkmode\n");

    return src;
  }

  let commandPos = src.indexOf("\\enabledarkmode");
  let newlinePos = src.lastIndexOf("\n", commandPos);
  let commentPos = src.lastIndexOf("%", commandPos);
  let commentInLine = commentPos > newlinePos;
  if (commentInLine) {
    src = removeText(src, commentPos, 1);
  } else {
    src = insertText(src, newlinePos + 1, "%");
  }
  return src;
}

function usepackage(src, pos, kwargs) {
  src = addPackage(kwargs.name, src);
  return src;
}

function addPackage(packageName, src) {
  if (!src.includes(`\\usepackage{${packageName}}`)) {
    let docPos = src.indexOf("documentclass");
    let startPos = src.indexOf("\n", docPos) + 1;
    src = insertText(src, startPos, `\\usepackage{${packageName}}\n`);
  }
  return src;
}

function insertText(src, pos, text) {
  let srcStart = src.substring(0, pos);
  let srcEnd = src.substring(pos);
  return srcStart + text + srcEnd;
}

function removeText(src, pos, chars) {
  let srcStart = src.substring(0, pos);
  let srcEnd = src.substring(pos + chars);
  return srcStart + srcEnd;
}

let shortcuts = [
  {
    name: "table",
    description: "create a <width> by <height> table",
    arguments: [
      {
        name: "width",
        default: 2,
      },
      {
        name: "height",
        default: 2,
      },
    ],
    func: table,
  },
  {
    name: "matrix",
    description: "create a <width> by <height> matrix",
    arguments: [
      {
        name: "width",
        default: 2,
      },
      {
        name: "height",
        default: 2,
      },
    ],
    func: matrix,
  },
  {
    name: "vector",
    description: "create a vector with <n> values",
    arguments: [
      {
        name: "n",
        default: 3,
      }
    ],
    func: vector,
  },
  {
    name: "toggledarkmode",
    description: "toggle darkmode",
    arguments: [],
    func: toggledarkmode,
  },
  {
    name: "package",
    description: "adds a new usepackage declaration",
    arguments: [
      {
        name: "name",
        type: "str"
      }
    ],
    func: usepackage,
  },
];

function searchShortcuts(query) {
  return shortcuts
    .map((shortcut) => {
      let points = 0;
      for (let c of query) {
        if (shortcut.name.charAt(points) == c) {
          points += 1;
        }
      }
      shortcut.points = points;
      return shortcut;
    })
    .sort((a, b) => b.points - a.points)
    .slice(0, 10);
}

function showShortcuts(query) {
  shortcutsContent.innerHTML = "";

  let shownShortcuts = searchShortcuts(query);
  for (let shortcut of shownShortcuts) {
    let shortcutMatchesQuery = shortcut.name == query.split(" ")[0];
    let parsedArgs = {};
    if (shortcut.arguments) {
      if (shortcutMatchesQuery) {
        parsedArgs = parseArguments(query, shortcut.arguments).kwargs;
      } else {
        // just use defaults
        for (let arg of shortcut.arguments) {
          if (!arg.default) {
            continue;
          }
          parsedArgs[arg.name] = arg.default;
        }
      }
    }

    let displayName = shortcut.name;
    let description = shortcut.description;

    for (let arg of shortcut.arguments || []) {
      let isOptional = arg.hasOwnProperty("default");
      let optionalText = isOptional ? "?" : "";
      displayName += " <" + arg.name + optionalText + ">";

      if (parsedArgs[arg.name]) {
        description = description.replaceAll(
          "<" + arg.name + ">",
          parsedArgs[arg.name]
        );
      }
    }

    let shortcutDiv = document.createElement("div");
    shortcutDiv.classList.add("shortcut");

    let shortcutName = document.createElement("p");
    shortcutName.innerText = displayName;
    shortcutDiv.appendChild(shortcutName);

    let shortcutDescription = document.createElement("p");
    shortcutDescription.innerText = description;
    shortcutDiv.appendChild(shortcutDescription);

    shortcutsContent.appendChild(shortcutDiv);
  }
}

function parseArguments(query, args) {
  let parsedArgs = {};
  let anyMissing = false;

  let tokens = query.trim().split(" ").slice(1);
  let index = 0;

  for (let arg of args) {
    if (tokens.length <= index) {
      if (!arg.default) {
        anyMissing = true;
        continue;
      }
      parsedArgs[arg.name] = arg.default;
      continue;
    }

    let token = tokens[index];
    let value;
    if (!arg.hasOwnProperty("type") || arg.type == "int") {
      value = Number.parseInt(token);
      if (isNaN(value)) {
        if (!arg.default) {
          anyMissing = true;
        }
        index += 1;
        continue;
      }
    } else if (arg.type == "str") {
      value = token
    }
    parsedArgs[arg.name] = value;

    index += 1;
  }

  return {
    kwargs: parsedArgs,
    anyMissing,
  };
}

openShortcutField.addEventListener("focusin", (event) => {
  shortcutField.value = "";
  showPopup()
  showShortcuts("");
});

shortcutField.addEventListener("focusout", (event) => {
  hidePopup();
});

shortcutField.addEventListener("keyup", (event) => {
  if (event.key === "Escape") {
    hidePopup();
    return;
  }
  if (event.key === "Enter") {
    let results = searchShortcuts(shortcutField.value);
    if (!results) {
      return;
    }

    let shortcut = results[0];
    let parsedArgs = parseArguments(shortcutField.value, shortcut.arguments);
    if (parsedArgs.anyMissing) {
      return;
    }

    let shortcutFunc = shortcut.func;

    executeShortcut_cb(shortcutFunc, parsedArgs.kwargs);
    hidePopup();
    return
  }

  showShortcuts(event.target.value);
});

function hidePopup() {
  shortcutField.value = "";
  popupBackground.classList.remove("visible")
}

function showPopup() {
  popupBackground.classList.add("visible")
  shortcutField.focus();
}
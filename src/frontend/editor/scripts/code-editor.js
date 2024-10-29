import * as fs from "/editor/file-system.js";
import * as latex_tokenizer from "/editor/latex-tokenizer.js";
import * as shortcuts from "/editor/shortcuts.js";

let tokenizers = {
  ".tex": latex_tokenizer.tokenize,
};

let editorDiv = document.getElementById("editor");
let shortcutField = document.getElementById("shortcut-field");
let input_cb = null;
let lastKey = null;

let selectionAbsOffset;

function htmlEncode(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function updateSyntaxHighlight(src) {
  let tokenize = getTokenizer();
  let tokens = tokenize(src);
  showTokens(tokens);
}

function getTokenizer() {
  let fileName = fs.currentFilePath;
  let ending = fileName.substring(fileName.lastIndexOf("."));
  if (!(ending in tokenizers)) {
    return nontokenize;
  }
  return tokenizers[ending];
}

// when theres no tokenizer just return
// everything as one big default token
function nontokenize(src) {
  return [
    {
      type: {
        name: "default",
      },
      text: src,
    },
  ];
}

function getSrcText() {
  let src = "";

  for (let node of editorDiv.childNodes) {
    if (node.nodeType === Node.ELEMENT_NODE && node.tagName === "DIV") {
      if (node.innerHTML.includes("<br><br>")) {
        node.innerHTML = node.innerHTML.replaceAll("<br><br>", "\n");
      }
      src += node.innerText + "\n";
    } else if (node.nodeType === Node.TEXT_NODE) {
      src += node.textContent + "\n";
    }
  }
  while (src.endsWith("\n")) {
    src = src.substring(0, src.length - 1);
  }
  src += "\n";
  src = src.replaceAll("\n\n", "\n \n");

  return src;
}

function showTokens(tokens) {
  let lines = [];
  lines.push([]);
  for (let token of tokens) {
    let i = 0;
    for (let text of token.text.split("\n")) {
      lines.at(-1).push({ type: token.type, text: text });
      if (token.text.includes("\n") && i != token.text.split("\n").length - 1) {
        i += 1;
        lines.push([]);
      }
    }
  }

  let lastLineText = "";
  let i = 0;
  for (let line of lines) {
    let lineText = "";
    for (let token of line) {
      if (token.text.length == 0) continue;
      lineText += token.text;
    }
    if (lineText.length == 0 && i != 0) continue;
    lastLineText = lineText;

    let html = '<div class="line">';
    for (let token of line) {
      if (token.text.length == 0) continue;
      html += `<span class="syntax-${token.type.name}">${htmlEncode(
        token.text
      )}</span>`;
    }
    html += "</div>";

    for (let i = editorDiv.childNodes.length - 1; i >= 0; i--) {
      const child = editorDiv.childNodes[i];

      if (child.nodeType === Node.TEXT_NODE) {
        editorDiv.removeChild(child);
      }
    }

    let lineDiv = null;
    if (editorDiv.childNodes.length >= i + 1) {
      lineDiv = editorDiv.childNodes[i];
    } else {
      lineDiv = document.createElement("div");
      editorDiv.appendChild(lineDiv);
    }
    if (lineDiv.outerHTML != html) {
      lineDiv.outerHTML = html;
    }
    i += 1;
  }

  if (i > 0 && lastLineText.trim().length != 0) {
    let lineDiv = document.createElement("div");
    editorDiv.appendChild(lineDiv);
    lineDiv.outerHTML = '<div class="line"><span> </span></div>';
  }

  while (i + 1 < editorDiv.childNodes.length) {
    editorDiv.removeChild(editorDiv.childNodes[i]);
  }
}

function getAbsoluteCaretPosition(div) {
  let caretPos = 0;

  for (let lineDiv of div.childNodes) {
    let inLine = false;
    for (let c of lineDiv.childNodes) {
      let relPos = getCaretPosition(c);
      if (relPos > c.innerText.length) {
        relPos = c.innerText.length;
      }
      if (relPos > 0) {
        inLine = true;
      }
      caretPos += relPos;
    }
    if (inLine) {
      caretPos += 1;
    }
  }

  return caretPos - 1;
}

function getCaretPosition(selectedDiv) {
  let caretPos = 0;
  let selection = window.getSelection();
  if (selection.rangeCount > 0) {
    let range = selection.getRangeAt(0);
    let preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(selectedDiv);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    caretPos = preCaretRange.toString().length;
  }

  return caretPos;
}

function getCaretParentDiv() {
  const selection = window.getSelection();

  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    let caretNode = range.startContainer;
    while (caretNode && caretNode.nodeName !== "DIV") {
      caretNode = caretNode.parentNode;
    }
    return caretNode;
  }

  return null;
}

function setCaretPosition(position, selectedDiv) {
  selectedDiv.focus();
  const range = document.createRange();
  const selection = window.getSelection();

  let currentPos = 0;
  let found = false;

  function traverseNodes(node) {
    if (found) return;

    if (node.nodeType === Node.TEXT_NODE) {
      const textLength = node.textContent.length;

      if (currentPos + textLength >= position) {
        range.setStart(node, position - currentPos);
        range.collapse(true);
        found = true;
      } else {
        currentPos += textLength;
      }
    } else {
      node.childNodes.forEach(traverseNodes);
    }
  }

  traverseNodes(selectedDiv);

  selection.removeAllRanges();
  selection.addRange(range);
}

function highlightCurrentSyntax() {
  let selectedDiv = getCaretParentDiv();
  let offset = getCaretPosition(selectedDiv);
  if (lastKey == "Enter") {
    offset = 0;
  }

  let selectedDivIndex = [...editorDiv.childNodes].indexOf(selectedDiv);

  let src = getSrcText();
  updateSyntaxHighlight(src);

  selectedDiv = editorDiv.childNodes[selectedDivIndex];
  if (selectedDiv) {
    setCaretPosition(offset, selectedDiv);
  }

  return src;
}

export function onInput(cb) {
  input_cb = cb;
}

editorDiv.addEventListener("focusout", () => {
  selectionAbsOffset = getAbsoluteCaretPosition(editorDiv);
});

editorDiv.addEventListener("keydown", (event) => {
  lastKey = event.key;
  if (event.ctrlKey && event.code === "Space") {
    shortcutField.focus()
  }
});

editorDiv.addEventListener("input", () => {
  setTimeout(() => {
    let src = highlightCurrentSyntax();
    input_cb(src);
  }, 0);
});

editorDiv.addEventListener("paste", function (event) {
  event.preventDefault();
  const pastedData = event.clipboardData || window.clipboardData;
  const pastedText = pastedData.getData("text");

  let absOffset = getAbsoluteCaretPosition(editorDiv);
  let selectedDiv = getCaretParentDiv();
  let offset = getCaretPosition(selectedDiv);

  let selectedDivIndex = [...editorDiv.childNodes].indexOf(selectedDiv);

  let src = getSrcText();
  let srcStart = src.substring(0, absOffset);
  let srcEnd = src.substring(absOffset);
  let newSrc = srcStart + pastedText + srcEnd;
  updateSyntaxHighlight(newSrc);

  selectedDiv = editorDiv.childNodes[selectedDivIndex];
  if (selectedDiv) {
    setCaretPosition(offset + pastedText.length, selectedDiv);
  }

  return src;
});

shortcutField.addEventListener("focusout", (event) => {
  shortcutField.value = "";
});

shortcutField.addEventListener("keypress", (event) => {
  if (event.key === "Enter") {
    let src = getSrcText();

    let newSrc = shortcuts.executeShortcut(shortcutField.value, src, selectionAbsOffset);
    if (!newSrc) {
      return;
    }

    shortcutField.value = "";
    updateSyntaxHighlight(newSrc);
  }
});

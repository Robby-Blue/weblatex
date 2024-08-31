let { pdfjsLib } = globalThis;

pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs/";

async function renderPage(page, canvas, parentWidth) {
  let canvasContext = canvas.getContext("2d");

  let initialViewport = page.getViewport({ scale: 1 });
  let scale = parentWidth / initialViewport.width;

  let viewport = page.getViewport({ scale: scale });
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({
    canvasContext: canvasContext,
    viewport: viewport,
  });
}

function renderPDF() {
  pdfjsLib.getDocument("/pdf/").promise.then(async (pdf) => {
    let pages = pdf.numPages;
    let pagesContainer = document.getElementById("pages-container");

    let width = pagesContainer.offsetWidth;

    for (let i = 0; i < pages; i++) {
      let canvas = null;
      if (pagesContainer.children.length <= i) {
        canvas = document.createElement("canvas");
        pagesContainer.appendChild(canvas);
      } else {
        canvas = pagesContainer.children.item(i);
      }

      renderPage(await pdf.getPage(i + 1), canvas, width);
    }
  });
}

renderPDF();

let editorDiv = document.getElementById("editor");

function highlightSyntax() {
  let src = getSrcText();
  let tokens = tokenize(src);
  showTokens(tokens);
}

function getSrcText() {
  let src = "";

  for (let div of editorDiv.children) {
    div.innerHTML = div.innerHTML.replaceAll("<br><br>", "\n");
    src += div.innerText + "\n";
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

  let html = "";
  let lastLineText = "";
  for (let line of lines) {
    let lineText = "";
    for (let token of line) {
      lineText += token.text;
    }
    if (lineText.length == 0 && html.length != 0) continue;
    lastLineText = lineText;
    html += '<div class="line">';
    for (let token of line) {
      if (token.text.length == 0) continue;
      html += `<span class="syntax-${token.type.name}">${token.text}</span>`;
    }
    html += "</div>";
  }

  if (lastLineText.trim().length > 0) {
    html += `<div class="line"><span> </span></div>`;
  }

  editorDiv.innerHTML = html;
}

// good luck refactoring this
function tokenize(src) {
  let tokenTypes = [
    {
      name: "command",
      start: [{ type: "char", char: "\\" }],
      end: [{ type: "nonalphabetic" }],
    },
    {
      name: "brackets",
      start: [
        { type: "char", char: "{" },
        { type: "char", char: "[" },
      ],
      end: [
        { type: "char", char: "]", inclusive: true },
        { type: "char", char: "}", inclusive: true },
      ],
    },
    {
      name: "inlinemath",
      start: [
        { type: "char", char: "$" },
        { type: "char", char: "\\(" },
      ],
      end: [
        { type: "char", char: "$", inclusive: true },
        { type: "char", char: "\\)", inclusive: true },
      ],
    },
    {
      name: "math",
      start: [{ type: "char", char: "\\[" }],
      end: [{ type: "char", char: "\\]", inclusive: true }],
    },
    {
      name: "comment",
      start: [{ type: "char", char: "%" }],
      end: [{ type: "char", char: "\n" }],
    },
  ];

  let activeTokens = [];
  let tokens = [];
  tokens.push({ type: { name: "default" }, text: "" });
  let i = 0;

  while (i < src.length) {
    let bestMatch = null;
    let bestScore = 0;
    for (let tokenType of tokenTypes) {
      for (let startCondition of tokenType.start) {
        let thisMatch = meetsTokenCondition(startCondition, src, i);
        if (thisMatch > bestScore) {
          bestMatch = { type: "start", token: tokenType };
          bestScore = thisMatch;
        }
      }
    }
    if (activeTokens.length > 0) {
      for (let endCondition of activeTokens.at(-1).end) {
        let thisMatch = meetsTokenCondition(endCondition, src, i);
        if (thisMatch) {
          thisMatch += 1;
        }
        if (thisMatch > bestScore) {
          bestMatch = { type: "stop", condition: endCondition };
          bestScore = thisMatch;
        }
      }
    }
    if (bestMatch) {
      if (bestMatch.type == "start") {
        tokens.push({ type: bestMatch.token, text: "" });
        activeTokens.push(bestMatch.token);
        for (let k = 0; k < bestScore; k++) {
          tokens.at(-1).text += src[i++];
          if (i == src.length) break;
        }
      }

      if (activeTokens.length > 0 && bestMatch.type == "stop") {
        if (bestMatch.condition.inclusive) {
          for (let k = 0; k < bestScore; k++) {
            tokens.at(-1).text += src[i++];
            if (i == src.length) break;
          }
        }
        activeTokens.pop();
        let newTokenType = { name: "default" };
        if (activeTokens.length > 0) {
          newTokenType = activeTokens.at(-1);
        }
        tokens.push({ type: newTokenType, text: "" });
      }
    } else {
      tokens.at(-1).text += src[i++];
    }
  }
  return tokens;
}

function meetsTokenCondition(condition, src, index) {
  if (condition.type == "any") {
    return 1;
  } else if (condition.type == "char") {
    let len = condition.char.length;
    return src.slice(index, index + len) == condition.char ? len : 0;
  } else if (condition.type == "nonalphabetic") {
    return !src[index].match(/[a-z]/i) ? 1 : 0;
  }
}

function getCaretPosition() {
  let caretPos = 0;
  let selection = window.getSelection();
  if (selection.rangeCount > 0) {
    let range = selection.getRangeAt(0);
    let preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(editorDiv);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    caretPos = preCaretRange.toString().length;
  }
  return caretPos;
}

function setCaretPosition(position) {
  const editableDiv = editorDiv;
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

  traverseNodes(editableDiv);

  selection.removeAllRanges();
  selection.addRange(range);
}

function updateHightlighting() {
  let offset = getCaretPosition(editorDiv);
  highlightSyntax();
  setCaretPosition(offset);
}

editorDiv.addEventListener("input", updateHightlighting);
updateHightlighting();

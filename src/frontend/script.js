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

function highlightSyntax(src) {
  let tokens = tokenize(src);
  showTokens(tokens);
}

function getSrcText() {
  let src = "";

  for (let div of editorDiv.children) {
    if(div.innerHTML.includes("<br><br>")){
      div.innerHTML = div.innerHTML.replaceAll("<br><br>", "\n");
    }
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

  let lastLineText = "";
  let i = 0
  for (let line of lines) {
    let lineText = ""
    for (let token of line) {
      if (token.text.length == 0) continue;
      lineText += token.text;
    }
    if (lineText.length == 0 && i != 0) continue;
    lastLineText = lineText;

    let html = '<div class="line">';
    for (let token of line) {
      if (token.text.length == 0) continue;
      html += `<span class="syntax-${token.type.name}">${token.text}</span>`;
    }
    html += "</div>";
    
    let lineDiv = null
    if(editorDiv.children.length >= i+1){
       lineDiv = editorDiv.children[i]
    }else{
      lineDiv = document.createElement("div")
      editorDiv.appendChild(lineDiv)
    }
    if(lineDiv.outerHTML != html){
      lineDiv.outerHTML = html
    } 
    i+=1
  }

  if(i > 0 && lastLineText.trim().length != 0){
    let lineDiv = document.createElement("div")
    editorDiv.appendChild(lineDiv)
    lineDiv.outerHTML = '<div class="line"><span> </span></div>'
  }

  while(i+1 < editorDiv.children.length){
    editorDiv.removeChild(editorDiv.children[i])
  }
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
          for (let k = 0; k < bestScore - 1; k++) {
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

function setCaretPosition(position, selectedDiv) {
  selectedDiv.focus()
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

async function uploadFile(src) {
  let res = await fetch("/upload-file", {
    method: "POST",
    body: JSON.stringify({ text: src }),
    headers: {
      "Content-Type": "application/json",
    },
  });
  return res.status == 200;
}

async function updatePDF() {
  let res = await fetch("/compile-pdf", {
    method: "POST",
  });
  if(res.status != 200) return
  renderPDF()
}

let uploadTimeoutId = null;

function onInput() {
  let selectedDiv = getCaretParentDiv()
  let offset = getCaretPosition(selectedDiv);
  if(lastKey == "Enter"){
    offset = 0
  }

  let selectedDivIndex = [...editorDiv.children].indexOf(selectedDiv)

  let src = getSrcText();
  highlightSyntax(src);

  selectedDiv = editorDiv.children[selectedDivIndex]
  setCaretPosition(offset, selectedDiv);

  if (uploadTimeoutId) {
    clearTimeout(uploadTimeoutId);
  }
  uploadTimeoutId = setTimeout(async () => {
    let success = await uploadFile(src);
    if (!success) return;
    updatePDF();
  }, 1000);
}

let lastKey = null
function onKeydown(event) {
  lastKey = event.key
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

editorDiv.addEventListener("keydown", onKeydown);
editorDiv.addEventListener("input", onInput);
highlightSyntax("");

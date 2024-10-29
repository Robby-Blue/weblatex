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

let shortcuts = {
  table: table,
  toggledarkmode: toggledarkmode,
};

export function executeShortcut(shortcut, src, pos) {
  if (!shortcuts.hasOwnProperty(shortcut)) {
    return;
  }
  return shortcuts[shortcut](src, pos);
}

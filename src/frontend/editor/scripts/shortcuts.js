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

function insertText(src, pos, text) {
  let srcStart = src.substring(0, pos);
  let srcEnd = src.substring(pos);
  return srcStart + text + srcEnd;
}

let shortcuts = {
  table: table,
};

export function executeShortcut(shortcut, src, pos) {
  if (!shortcuts.hasOwnProperty(shortcut)) {
    return;
  }
  return shortcuts[shortcut](src, pos);
}

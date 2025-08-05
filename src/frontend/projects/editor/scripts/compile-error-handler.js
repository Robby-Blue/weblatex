let popupDiv = document.getElementById("compile-error-popup");
let popupPackground = document.getElementById("compile-popup-background");
let titleElement = document.getElementById("compile-error-title");
let goToLineButton = document.getElementById("compile-error-line");
let fullErrorElement = document.getElementById("compile-error-full-error");
let log = document.getElementById("compile-error-log");
let codeEditorDiv = document.getElementById("editor");

let lineNumber;

goToLineButton.addEventListener("click", () => {
  let scrollLine = lineNumber - 5;
  if (scrollLine < 0) {
    scrollLine = 0;
  }
  console.log(scrollLine);
  let codeLineElement = codeEditorDiv.childNodes[scrollLine];
  codeLineElement.scrollIntoView();
});

export function onCompileResult(data) {
  let wasSuccessful = data.return_code == 0;
  let wasTimeout = data.return_code == 124;

  if (wasSuccessful) {
    popupDiv.classList.remove("visible");
    popupPackground.classList.remove("visible")
    return;
  }
  popupDiv.classList.add("visible");
  popupPackground.classList.add("visible")
  log.innerText = data.log;

  if (wasTimeout) {
    titleElement.innerText = "timeout";
    return;
  }

  let parsed = parseError(data.log);

  titleElement.innerText = parsed.errorMessage;
  goToLineButton.innerText = "line " + parsed.lineNumber;
  fullErrorElement.innerText = parsed.fullMessage;

  let codeLineElement = codeEditorDiv.childNodes[parsed.lineNumber - 1];
  codeLineElement.classList.add("highlight-error");

  lineNumber = parsed.lineNumber;
}

function parseError(log) {
  let errorMessage;
  let fullMessage = "";
  let lineNumber;

  for (let line of log.split("\n")) {
    if (!errorMessage) {
      if (line.charAt(0) != "!") continue;
      errorMessage = line.slice(1).trim();
    } else if (errorMessage) {
      if (line.slice(0, 2) == "l." && !lineNumber) {
        // eg "l.1"
        let firstWord = line.split(" ")[0];
        lineNumber = firstWord.slice(2).trim();
      }
      if (line.charAt(0) == "!") break;
      fullMessage += line + "\n";
    }
  }

  return {
    errorMessage,
    lineNumber,
    fullMessage,
  };
}

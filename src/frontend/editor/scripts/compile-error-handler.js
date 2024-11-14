let popupDiv = document.getElementById("compile-error-popup");
let titleElement = document.getElementById("compile-error-title");
let log = document.getElementById("compile-error-log");

export function onCompileResult(data) {
  let wasSuccessful = data.return_code == 0;
  let wasTimeout = data.return_code == 124;

  if (wasSuccessful) {
    popupDiv.classList.remove("visible");
    return;
  }
  popupDiv.classList.add("visible");
  log.innerText = data.log;

  if (wasTimeout) {
    titleElement.innerText = "timeout";
    return;
  }

  titleElement.innerText = "error";
  // parse error type here, first line
  // starting with an exclamation mark
  // the next lines are extra info like
  // line number and other info
}

import * as editor from "/code-editor.js";

export let currentFolderPath = ".";
export let currentFilePath = "main.tex";

let folderCache = {};
let fileCache = {};

let filePickerElement = document.querySelector(".files-list");
let currentPathElement = document.querySelector(".current-path-text");

currentPathElement.addEventListener("click", (event) => {
  console.log("a");
  if (currentFolderPath == ".") {
    return;
  }
  let slashIndex = currentFolderPath.indexOf("/");
  let newPath = currentFolderPath.substring(0, slashIndex);
  console.log(newPath);
  openFolder(newPath);
});

async function getCached(cache, key, cb) {
  if (cache.hasOwnProperty(key)) {
    return cache[key];
  } else {
    let data = await cb(key);
    cache[key] = data;
    return data;
  }
}

async function openFolder(path) {
  currentFolderPath = path;
  let pathText = "~" + path.substr(1);
  currentPathElement.innerText = pathText;

  let data = await getCached(folderCache, path, async () => {
    let res = await fetch(`/files/${path}`);
    return await res.json();
  });

  filePickerElement.innerHTML = "";

  for (let file of data) {
    let fileElement = document.createElement("p");
    fileElement.innerText = file.name;

    let filePath = `${path}/${file.name}`;
    if (file.is_file) {
      fileElement.addEventListener("click", () => openFile(filePath));
    } else {
      fileElement.addEventListener("click", () => openFolder(filePath));
    }
    fileElement.onclick = filePickerElement.appendChild(fileElement);
  }
}

async function openFile(path) {
  currentFilePath = path;
  let text = await getCached(fileCache, path, async () => {
    let res = await fetch(`/files/${path}`);
    return await res.text();
  });
  editor.updateSyntaxHighlight(text);
}

export async function updateCurrentFile(src) {
  fileCache[currentFilePath] = src;
  return await uploadCurrentFile();
}

async function uploadCurrentFile() {
  let res = await fetch(`/files/${currentFilePath}`, {
    method: "POST",
    body: JSON.stringify({ text: fileCache[currentFilePath] }),
    headers: {
      "Content-Type": "application/json",
    },
  });
  return res.status == 200;
}

openFile(currentFilePath);
openFolder(currentFolderPath);

import * as editor from "/editor/code-editor.js";

export let currentFolderPath = ".";
export let currentFilePath = "main.tex";

let folderCache = {};
let fileCache = {};

let filePickerElement = document.querySelector(".files-list");
let currentPathElement = document.querySelector(".current-path-text");

let pathName = window.location.pathname;
let projectPath = pathName.substring("/editor/".length);

currentPathElement.addEventListener("click", (event) => {
  if (currentFolderPath == ".") {
    return;
  }
  let slashIndex = currentFolderPath.indexOf("/");
  let newPath = currentFolderPath.substring(0, slashIndex);
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
    let data = { path: path, project: projectPath };
    let queryString = new URLSearchParams(data).toString();
    let res = await fetch(`/api/projects/files?${queryString}`);
    return await res.json();
  });

  filePickerElement.innerHTML = "";

  for (let file of data) {
    let fileElement = document.createElement("p");
    fileElement.innerText = file.name + (file.is_file ? "" : "/");

    let filePath = `${path}/${file.name}`;
    if (file.is_file) {
      fileElement.addEventListener("click", () => openFile(filePath));
    } else {
      fileElement.classList.add("folder-label");
      fileElement.addEventListener("click", () => openFolder(filePath));
    }
    fileElement.onclick = filePickerElement.appendChild(fileElement);
  }
}

async function openFile(path) {
  currentFilePath = path;
  let text = await getCached(fileCache, path, async () => {
    let data = { path: path, project: projectPath };
    let queryString = new URLSearchParams(data).toString();
    let res = await fetch(`/api/projects/files?${queryString}`);
    return await res.text();
  });
  editor.updateSyntaxHighlight(text);
}

export async function updateCurrentFile(src) {
  fileCache[currentFilePath] = src;
  return await uploadCurrentFile();
}

async function uploadCurrentFile() {
  let res = await fetch(`/api/projects/files/`, {
    method: "POST",
    body: JSON.stringify({
      text: fileCache[currentFilePath],
      project: projectPath,
      path: currentFilePath,
    }),
    headers: {
      "Content-Type": "application/json",
    },
  });
  return res.status == 200;
}

function showCreationMenu(isFile) {
  let nameField = document.createElement("input");
  nameField.classList.add("name-field");

  filePickerElement.appendChild(nameField);
  nameField.focus();

  nameField.addEventListener("focusout", (event) => {
    filePickerElement.removeChild(nameField);
  });

  nameField.addEventListener("keyup", async (event) => {
    if (event.key === "Escape") {
      shortcutsPopup.classList.remove("visible");
    }
    if (event.key === "Enter") {
      delete folderCache[currentFolderPath];
      let success = await createFile(nameField.value, isFile);
      if (success) {
        openFolder(currentFolderPath);
      }
    }
  });
}

async function createFile(name, isFile) {
  let res = await fetch(`/api/projects/files/new`, {
    method: "POST",
    body: JSON.stringify({
      project: projectPath,
      parentPath: currentFolderPath,
      name: name,
      isFile: isFile,
    }),
    headers: {
      "Content-Type": "application/json",
    },
  });
  return res.status == 200;
}

document
  .getElementById("create-file-button")
  .addEventListener("click", (event) => {
    showCreationMenu(true);
  });

document
  .getElementById("create-folder-button")
  .addEventListener("click", (event) => {
    showCreationMenu(false);
  });

openFile(currentFilePath);
openFolder(currentFolderPath);

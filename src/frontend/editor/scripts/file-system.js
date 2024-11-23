import * as editor from "/editor/code-editor.js";

export let currentFolderPath = ".";
export let currentFilePath = "main.tex";

let folderCache = {};
let fileCache = {};

let filePickerElement = document.querySelector(".files-list");
let currentPathElement = document.querySelector(".current-path-text");

let pathName = decodeURIComponent(window.location.pathname);
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

  data.sort((a, b) => {
    if (a.is_file === b.is_file) return 0;
    return a.is_file ? 1 : -1;
  });

  data.sort((a, b) => {
    if (a.is_file != b.is_file) {
      return 0;
    }
    return a.name.localeCompare(b.name);
  });

  for (let file of data) {
    if (shouldSkipFile(file)) continue;

    let fileElement = document.createElement("p");
    fileElement.innerText = file.name + (file.is_file ? "" : "/");

    let filePath = `${path}/${file.name}`;
    if (file.is_file) {
      fileElement.addEventListener("click", () => openFile(filePath));
    } else {
      fileElement.classList.add("folder-label");
      fileElement.addEventListener("click", () => openFolder(filePath));
    }

    fileElement.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      currentContextFile = file;
      showFileContextMenu(event);
      return false;
    });

    filePickerElement.appendChild(fileElement);
  }
}

function shouldSkipFile(file) {
  let hiddenFileExtentions = ["aux", "log"];
  let hiddenFileNames = ["main.pdf"];
  let hiddenFolderNames = ["svg-inkscape", ".git"];
  if (file.is_file) {
    let extention = file.name.split(".").at(-1);
    return (
      hiddenFileExtentions.includes(extention) ||
      hiddenFileNames.includes(file.name)
    );
  } else {
    return hiddenFolderNames.includes(file.name);
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
  return await uploadFile(currentFilePath, fileCache[currentFilePath]);
}

async function uploadFile(path, content) {
  let res = await fetch(`/api/projects/files/`, {
    method: "POST",
    body: JSON.stringify({
      text: content,
      project: projectPath,
      path: path,
    }),
    headers: {
      "Content-Type": "application/json",
    },
  });
  return res.status == 200;
}

function showCreationMenu(isFile, cb) {
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
      cb(nameField.value, isFile);
    }
  });
}

let currentContextFile;
let fileContextPopup = document.getElementById("file-context-popup");

function showFileContextMenu(event) {
  fileContextPopup.classList.add("visible");
  fileContextPopup.style.left = event.clientX + "px";
  fileContextPopup.style.top = event.clientY + "px";
}

document.addEventListener("click", (event) => {
  if (fileContextPopup.contains(event.target)) {
    return;
  }
  fileContextPopup.classList.remove("visible");
});

document
  .getElementById("file-context-delete")
  .addEventListener("click", async (event) => {
    await fetch(`/api/projects/files/delete`, {
      method: "POST",
      body: JSON.stringify({
        project: projectPath,
        parentPath: currentFolderPath,
        name: currentContextFile.name,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });
    fileContextPopup.classList.remove("visible");
    delete folderCache[currentFolderPath];
    openFolder(currentFolderPath);
  });

document
  .getElementById("file-context-rename")
  .addEventListener("click", async (event) => {
    fileContextPopup.classList.remove("visible");
    showCreationMenu(false, async (newName, _) => {
      await fetch(`/api/projects/files/rename`, {
        method: "POST",
        body: JSON.stringify({
          project: projectPath,
          parentPath: currentFolderPath,
          oldName: currentContextFile.name,
          newName: newName,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });
      fileContextPopup.classList.remove("visible");
      delete folderCache[currentFolderPath];
      openFolder(currentFolderPath);
    });
  });

async function onChooseCreatedFileName(name, isFile) {
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

  if (res.status == 200) {
    openFolder(currentFolderPath);
  }
}

document
  .getElementById("create-file-button")
  .addEventListener("click", (event) => {
    showCreationMenu(true, onChooseCreatedFileName);
  });

document
  .getElementById("create-folder-button")
  .addEventListener("click", (event) => {
    showCreationMenu(false, onChooseCreatedFileName);
  });

document
  .getElementById("upload-file-button")
  .addEventListener("click", (event) => {
    let uploadFileInput = document.createElement("input");
    uploadFileInput.type = "file";
    uploadFileInput.click();

    uploadFileInput.addEventListener("change", uploadFileSelection);
  });

function uploadFileSelection(event) {
  let file = event.target.files[0];
  let path = currentFolderPath + "/" + file.name;
  path = path.replace("//", "/");

  let reader = new FileReader();

  reader.addEventListener("load", async (event) => {
    let content = event.target.result;

    let success = await uploadFile(path, content);
    delete folderCache[currentFolderPath];
    if (success) {
      openFolder(currentFolderPath);
    }
  });

  reader.readAsText(file);
}

openFile(currentFilePath);
openFolder(currentFolderPath);

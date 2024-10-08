import * as editor from "/code-editor.js";

let currentFolderPath = "."
let currentFilePath = "main.tex"

let folderCache = {}
let fileCache = {}

let filePickerElement = document.getElementById("file-picker")

async function getCached(cache, key, cb){
    if(cache.hasOwnProperty(key)) {
        return cache[key]
    }else {
        let data = await cb(key)
        cache[key] = data
        return data
    }
}

async function openFolder(path) {
    let data = await getCached(folderCache, path, async () => {
        let res = await fetch(`/files/${path}`);
        return await res.json()
    })

    filePickerElement.innerHTML = ""

    for(let file of data){
        let fileElement = document.createElement("p")
        fileElement.innerText = file.name

        let filePath = `${path}/${file.name}`
        if (file.is_file) {
            fileElement.addEventListener("click", () =>
                openFile(filePath))
        }else{
            fileElement.addEventListener("click", () =>
                openFolder(filePath))
        }
        fileElement.onclick = 
        filePickerElement.appendChild(fileElement)
    }
}

async function openFile(path) {
    let text = await getCached(fileCache, path, async () => {
        let res = await fetch(`/files/${path}`);
        return await res.text()
    })
    editor.updateSyntaxHighlight(text);
}

openFile(currentFilePath)
openFolder(currentFolderPath)
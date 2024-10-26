let path = window.location.pathname;
path = path.substring("/projects/".length)

let pathLabelElement = document.getElementById("folder-label");

pathLabelElement.innerText = "/"+path;

async function listFiles(path) {
  let res = await fetch(`/api/projects/${path}`);
  let data = await res.json();
}

listFiles(path)
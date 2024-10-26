let path = window.location.pathname;
path = path.substring("/projects/".length)

let pathLabelElement = document.getElementById("folder-label");

pathLabelElement.innerText = "/"+path;

async function listFiles(path) {
  let queryString = new URLSearchParams({path: path}).toString();
  let res = await fetch(`/api/projects?${queryString}`);
  let data = await res.json();

  let projectsListDiv = document.getElementById("project-list")
  for(let project of data) {
    let nameStartIndex = project.parent_path.length+1
    if(project.parent_path.length == 0){
        nameStartIndex = 0
    }
    let projectName = project.path.substring(nameStartIndex)

    if(project.is_folder) {
        projectName += "/"
    }

    let href = undefined
    if(project.is_folder){
        href = "/projects/"+project.path
    }else {
        href = "/editor/"+project.path
    }

    let projectLinkElement = document.createElement("a")
    let projectLabelElement = document.createElement("p")
    projectLabelElement.innerText = projectName
    projectLinkElement.setAttribute("href", href)
    projectLinkElement.appendChild(projectLabelElement)

    projectsListDiv.appendChild(projectLinkElement)
  }
}

listFiles(path)
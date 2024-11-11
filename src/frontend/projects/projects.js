let popupElement = document.getElementById("name-popup");
let nameFieldElement = document.getElementById("name-field");
let nameLabel = document.getElementById("name-label");
let typeField = document.getElementById("type-field");
let parentField = document.getElementById("parent-field");

nameFieldElement.addEventListener("focusout", () => {
  popupElement.classList.remove("visible");
});

function onCreateClicked(isFolder) {
  nameLabel.innerText = "new " + (isFolder ? "folder" : "project");
  typeField.value = isFolder ? "folder" : "project";
  parentField.value = path;

  popupElement.classList.add("visible");
  nameFieldElement.focus();
}

let pathLabelElement = document.getElementById("folder-label");

let path = decodeURIComponent(window.location.pathname);
path = path.substring("/projects/".length);
pathLabelElement.innerText = "/" + path;

async function listFiles(path) {
  let queryString = new URLSearchParams({ path: path }).toString();
  let res = await fetch(`/api/projects?${queryString}`);
  let data = await res.json();

  let projectsListDiv = document.getElementById("project-list");
  for (let project of data) {
    let nameStartIndex = project.parent_path.length + 1;
    if (project.parent_path.length == 0) {
      nameStartIndex = 0;
    }
    let projectName = project.path.substring(nameStartIndex);

    if (project.is_folder) {
      projectName += "/";
    }

    let projectHref = undefined;
    if (project.is_folder) {
      projectHref = "/projects/" + project.path;
    } else {
      projectHref = "/editor/" + project.path;
    }
    gitHref = "/git/" + project.path;

    let projectLinkElement = document.createElement("a");
    let projectLabelElement = document.createElement("p");
    projectLabelElement.innerText = projectName;
    projectLinkElement.setAttribute("href", projectHref);
    projectLinkElement.appendChild(projectLabelElement);

    let gitLinkElement = document.createElement("a");
    let gitLabelElement = document.createElement("p");
    gitLabelElement.innerText = "git";
    gitLinkElement.setAttribute("href", gitHref);
    gitLinkElement.appendChild(gitLabelElement);

    let projectContainer = document.createElement("div");
    projectContainer.classList.add("project-container");

    projectContainer.appendChild(projectLinkElement);
    projectContainer.appendChild(gitLinkElement);

    projectsListDiv.append(projectContainer);
  }
}

listFiles(path);

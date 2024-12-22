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

let currentContextProject;
let pathLabelElement = document.getElementById("folder-label");

let path = decodeURIComponent(window.location.pathname);
path = path.substring("/projects/explorer/".length);
pathLabelElement.innerText = "/" + path;

async function listProjects(path) {
    let queryString = new URLSearchParams({ path: path }).toString();
    let res = await fetch(`/api/projects?${queryString}`);
    let data = await res.json();

    let projectsListDiv = document.getElementById("project-list");
    projectsListDiv.innerHTML = "";
    for (let project of data) {
        let projectName = getProjectName(project);

        let projectHref = undefined;
        if (project.is_folder) {
            projectHref = "/projects/explorer/" + project.path;
        } else {
            projectHref = "/projects/editor/" + project.path;
        }
        gitHref = "/projects/git/" + project.path;

        let projectLinkElement = document.createElement("a");
        let projectLabelElement = document.createElement("p");
        projectLabelElement.innerText = projectName;
        projectLinkElement.setAttribute("href", projectHref);
        projectLinkElement.appendChild(projectLabelElement);

        projectLinkElement.addEventListener("contextmenu", (event) => {
            event.preventDefault();
            currentContextProject = project;
            showProjectContextMenu(event);
            return false;
        });
        projectsListDiv.append(projectLinkElement);
    }
}

function showProjectContextMenu() {
    let popup = document.getElementById("context-popup");
    popup.classList.add("visible");

    let nameLabel = document.getElementById("project-context-label");
    nameLabel.innerText = getProjectName(currentContextProject);
}

function getProjectName(project) {
    let nameStartIndex = project.parent_path.length + 1;
    if (project.parent_path.length == 0) {
        nameStartIndex = 0;
    }
    let projectName = project.path.substring(nameStartIndex);

    if (project.is_folder) {
        projectName += "/";
    }
    return projectName;
}

let deleteProjectButton = document.getElementById("project-delete-button");
deleteProjectButton.addEventListener("click", async (event) => {
    await fetch(`/api/project/delete`, {
        method: "POST",
        body: JSON.stringify({
            path: currentContextProject.path,
        }),
        headers: {
            "Content-Type": "application/json",
        },
    });

    listProjects(path);
    let popup = document.getElementById("context-popup");
    popup.classList.remove("visible");
});
let contextCloseButton = document.getElementById("context-close-button");
contextCloseButton.addEventListener("click", (event) => {
    let popup = document.getElementById("context-popup");
    popup.classList.remove("visible");
});

listProjects(path);

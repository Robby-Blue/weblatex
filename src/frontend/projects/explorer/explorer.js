let currentContextProject;
let pathLabelElement = document.getElementById("folder-label");

let path = decodeURIComponent(window.location.pathname);
path = path.substring("/projects/explorer/".length);
pathLabelElement.innerText = "/" + path;

let popupElement = document.getElementById("popup");

let newBlankDiv = document.getElementById("new-file-div");
let nameLabel = document.getElementById("name-label");
let nameFieldBlank = document.getElementById("name-field-blank");

let fromGitDiv = document.getElementById("from-git-div");
let localNameField = document.getElementById("local-name-field");
let repoUrlField = document.getElementById("gh-link-field");
let ghEmailField = document.getElementById("gh-email-field");
let ghPATField = document.getElementById("gh-pat-field");
let cloneButton = document.getElementById("gh-clone-button");

let contextDiv = document.getElementById("context-div");

let createType;

function onCreateClicked(type) {
    nameLabel.innerText = `new ${type}`;
    createType = type;

    popupElement.classList.add("visible");
    contextDiv.classList.add("invisible");

    if (type == "git") {
        newBlankDiv.classList.add("invisible");
        fromGitDiv.classList.remove("invisible");
    } else {
        newBlankDiv.classList.remove("invisible");
        fromGitDiv.classList.add("invisible");
    }

    nameFieldBlank.focus();
}

nameFieldBlank.addEventListener("keypress", async function (event) {
    if (event.key != "Enter") return;
    event.preventDefault();

    await fetch("/api/project/new", {
        method: "POST",
        body: JSON.stringify({
            type: createType,
            name: nameFieldBlank.value,
            parent: path,
        }),
        headers: {
            "Content-Type": "application/json",
        },
    });

    popupElement.classList.remove("visible");
    listProjects(path);
});

cloneButton.addEventListener("click", async function (event) {
    event.preventDefault();

    await fetch("/api/project/new/git", {
        method: "POST",
        body: JSON.stringify({
            name: localNameField.value,
            repoUrl: repoUrlField.value,
            email: ghEmailField.value,
            pat: ghPATField.value,
            parent: path,
        }),
        headers: {
            "Content-Type": "application/json",
        },
    });

    popupElement.classList.remove("visible");
    listProjects(path);
});

function showProjectContextMenu() {
    popupElement.classList.add("visible");
    newBlankDiv.classList.add("invisible");
    fromGitDiv.classList.add("invisible");
    contextDiv.classList.remove("invisible");

    let nameLabel = document.getElementById("project-context-label");
    nameLabel.innerText = getProjectName(currentContextProject);
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
    popupElement.classList.remove("visible");
});

document.addEventListener("mousedown", (event) => {
    if (popup.contains(event.target)) return;
    popupElement.classList.remove("visible");
});

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

listProjects(path);

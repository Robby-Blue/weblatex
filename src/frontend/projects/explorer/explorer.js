let currentContextProject;

let path = decodeURIComponent(window.location.pathname);
path = path.substring("/projects/explorer/".length);

let popupElement = document.getElementById("popup");

let nameLabel = document.getElementById("name-label");
let nameFieldBlank = document.getElementById("name-field-blank");

let localNameField = document.getElementById("local-name-field");
let repoUrlField = document.getElementById("gh-link-field");
let ghEmailField = document.getElementById("gh-email-field");
let ghPATField = document.getElementById("gh-pat-field");
let cloneButton = document.getElementById("gh-clone-button");

let newPathBlank = document.getElementById("new-path-field");

let createType;

function onCreateClicked(type) {
    nameLabel.innerText = `new ${type}`;
    createType = type;

    if (type == "git") {
        showPopup("from-git");
    } else {
        showPopup("new-file");
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

    hidePopup();
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

    hidePopup();
    listProjects(path);
});

function showProjectContextMenu() {
    showPopup("context");

    let nameLabel = document.getElementById("project-context-label");
    nameLabel.innerText = getProjectName(currentContextProject);
}

async function onDeleteClicked(event) {
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
    hidePopup();
}

async function onMoveClicked(event) {
    showPopup("move-file");
    newPathBlank.value = currentContextProject.path;
    newPathBlank.focus();
}

newPathBlank.addEventListener("keypress", async function (event) {
    if (event.key != "Enter") return;
    event.preventDefault();

    await fetch("/api/project/move", {
        method: "POST",
        body: JSON.stringify({
            path: currentContextProject.path,
            new_path: newPathBlank.value,
        }),
        headers: {
            "Content-Type": "application/json",
        },
    });

    hidePopup();
    listProjects(path);
});

document.addEventListener("mousedown", (event) => {
    if (popup.contains(event.target)) return;
    hidePopup();
});

async function listProjects(path) {
    let queryString = new URLSearchParams({ path: path }).toString();
    let res = await fetch(`/api/projects?${queryString}`);
    let data = await res.json();

    if (data.hasOwnProperty("error")) {
        if (data.error == "exists_as_project") {
            window.location = `/projects/editor/${path}`;
        }
    }

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

function showPopup(visiblePartName) {
    popupElement.classList.add("visible");
    for (let child of popupElement.children) {
        child.classList.add("invisible");
    }
    let visiblePart = document.getElementById(visiblePartName + "-div");
    visiblePart.classList.remove("invisible");
}

function hidePopup() {
    popupElement.classList.remove("visible");
}

function fillParentIsland(path) {
    if (path.endsWith("/")) {
        path = path.substring(0, path.length - 1)
    }
    let parts = path.split("/")

    let parentIsland = document.getElementById("parent-island")

    for (let i = 0; i < parts.length; i++) {
        let slashJoined = parts.slice(0, i).join("/")
        let slashLink = `/projects/explorer/${slashJoined}`

        if (i == 0) {
            slashLink = "/projects/explorer/"
        }

        let nameJoined = parts.slice(0, i + 1).join("/")
        let nameLink = `/projects/explorer/${nameJoined}`

        let slashElement = document.createElement("a")
        slashElement.innerText = "/"
        slashElement.href = slashLink
        parentIsland.appendChild(slashElement)
        let nameElement = document.createElement("a")
        nameElement.innerText = parts[i]
        nameElement.href = nameLink
        parentIsland.appendChild(nameElement)
    }
}

document.getElementById("git-link").href = `/projects/git/${path}`
fillParentIsland(path);
listProjects(path);

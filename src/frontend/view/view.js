let pathName = decodeURIComponent(window.location.pathname);
let projectPath = pathName.substring("/view/".length);
if (projectPath.charAt(projectPath.length - 1) == "/") {
    projectPath = projectPath.substring(0, projectPath.length - 1);
}

let embedElement = document.getElementById("embed");
embedElement.setAttribute("src", `/api/projects/pdf/${projectPath}`);

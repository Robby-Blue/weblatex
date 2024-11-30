let pathName = decodeURIComponent(window.location.pathname);
let projectPath = pathName.substring("/git/".length);
if (projectPath.charAt(projectPath.length - 1) == "/") {
    projectPath = projectPath.substring(0, projectPath.length - 1);
}

function parseDiff(text) {
    let diffs = [];
    let currentDiff = {};
    let inDiff = false;
    for (let line of text.split("\n")) {
        let words = line.split(" ");
        if (words[0] == "diff") {
            if (currentDiff.lines && currentDiff.lines.length > 0) {
                diffs.push(currentDiff);
            }
            currentDiff = {
                file: words[3].substring(2),
                lines: [],
            };
            inDiff = false;
        }
        let firstChar = line.charAt(0);
        if (firstChar == "@") {
            inDiff = true;
        }
        if (!inDiff) continue;
        if ([" ", "+", "-"].includes(firstChar)) {
            currentDiff.lines.push({
                text: line.substring(1),
                type: firstChar,
            });
        }
    }
    if (currentDiff.lines.length > 0) {
        diffs.push(currentDiff);
    }
    return diffs;
}

async function showDiff() {
    let formatClasses = {
        " ": "unedited",
        "+": "added",
        "-": "removed",
    };

    let r = await fetch("/api/projects/git/diff/" + projectPath);
    let diffs = parseDiff(await r.text());

    let diffArea = document.getElementById("diff-area");

    for (let diff of diffs) {
        let fileLabel = document.createElement("h3");
        fileLabel.classList.add("file-label");
        fileLabel.innerText = diff.file;
        diffArea.appendChild(fileLabel);

        let codeArea = document.createElement("div");
        codeArea.classList.add("code-area");
        for (let line of diff.lines) {
            let codeLabel = document.createElement("p");
            codeLabel.innerText = line.text;
            codeLabel.classList.add("code");
            codeLabel.classList.add(formatClasses[line.type]);
            codeArea.appendChild(codeLabel);
        }
        diffArea.appendChild(codeArea);
    }
}

async function loadPage() {
    let r = await fetch("/api/projects/git/status/" + projectPath);

    if (r.status == 404) {
        let errorArea = document.getElementById("error-area");
        errorArea.classList.remove("hidden");
    }

    let data = await r.json();

    if (data.isGit) {
        let commitForm = document.getElementById("commit-git-form");
        commitForm.classList.remove("hidden");

        document.getElementById("commit-project").value = projectPath;

        let pullForm = document.getElementById("pull-git-form");
        pullForm.classList.remove("hidden");

        document.getElementById("pull-project").value = projectPath;

        await showDiff();
    } else {
        let form = document.getElementById("init-git-form");
        form.classList.remove("hidden");

        document.getElementById("init-project").value = projectPath;
    }
}

loadPage();

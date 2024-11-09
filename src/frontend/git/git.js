let pathName = window.location.pathname;
let projectPath = pathName.substring("/git/".length);

async function loadPage() {
  let r = await fetch("/api/projects/git/status/" + projectPath);
  let data = await r.json();

  if (data.isGit) {
    let form = document.getElementById("commit-git-form");
    form.classList.remove("hidden");

    document.getElementById("commit-project").value = projectPath;
  } else {
    let form = document.getElementById("init-git-form");
    form.classList.remove("hidden");

    document.getElementById("init-project").value = projectPath;
  }
}

loadPage();

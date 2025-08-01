from backend import db
import os
import time
import subprocess

def add_project(creator, parent_path, name, is_folder):
    parent_path = normalize_path(parent_path)

    is_root_folder = name == ""
    if is_root_folder:
        if parent_path is not None:
            return False, "invalid name"

    path = ("" if not parent_path else parent_path) + "/" + name
    path = normalize_path(path)

    is_valid_name = all(c.isalnum() or c in "_-" for c in name)
    if not is_valid_name:
        return False, "invalid name"

    if get_project(creator, path):
        return False, "project already exists"
    if not is_root_folder:
        if not get_project(creator, parent_path, is_folder=True):
            return False, "parent doesnt exist"
        if os.path.exists(get_fs_path(creator, parent_path, name)):
            return False, "file already exists"

    db.execute(
"INSERT INTO Projects (creator, path, parent_path, is_folder) VALUES (%s, %s, %s, %s)",
(creator, path, parent_path, is_folder))
    os.mkdir(get_fs_path(creator, path, ""))
    if not is_folder:
        add_template(creator, path, "empty_document")
    return True, None

def add_template(creator, project, template_name):
    project = normalize_path(project)

    if not get_project(creator, project):
        return
    template_folder = os.path.join("templates", template_name)
    if not os.path.exists(template_folder):
        return
    for file_name in os.listdir(template_folder):
        file_path = os.path.join(template_folder, file_name)
        with open(file_path, "r") as f:
            content = f.read()
        fs_path = get_fs_path(creator, project, file_name)
        with open(fs_path, "w") as f:
            f.write(content)

def delete_project(creator, path):
    path = normalize_path(path)

    fs_path = get_fs_path(creator, path, "")

    if get_project(creator, path):
        recursive_delete_db(creator, path)

    if os.path.exists(fs_path):
        recursive_delete(fs_path)

def move_project(creator, path, new_path):
    path = normalize_path(path)
    new_path = normalize_path(new_path)

    if not get_project(creator, path):
        return False, "path not found"
    if get_project(creator, new_path):
        return False, "new path already exists"
    
    if "/" in new_path:
        new_parent = normalize_path(new_path[:new_path.rindex("/")])
        if not get_project(creator, new_parent):
            return False, "new parent doesnt exist"
    else:
        new_parent = ""

    if "/" in path:
        parent = normalize_path(path[:path.rindex("/")])
    else:
        parent = ""

    fs_path = get_fs_path(creator, path, "")
    new_fs_path = get_fs_path(creator, new_path, "")

    os.rename(fs_path, new_fs_path)

    # update parents
    db.execute("""UPDATE Projects
SET parent_path = CONCAT(%s, SUBSTRING(parent_path, LENGTH(%s) + 1))
WHERE path = %s AND creator = %s;""",
(new_parent, parent, path, creator))

    if new_parent != "" and parent == "":
        new_parent += "/"

    db.execute("""UPDATE Projects
SET parent_path = CONCAT(%s, SUBSTRING(parent_path, LENGTH(%s) + 1))
WHERE path LIKE %s AND creator = %s;""",
(new_parent, parent, path+"/%", creator))

    # update sub folders
    db.execute("""UPDATE Projects
SET parent_path = CONCAT(%s, SUBSTRING(parent_path, LENGTH(%s) + 1))
WHERE (parent_path = %s OR parent_path LIKE %s) AND
creator = %s;""",
(new_path, path, path, path+"/%", creator))

    # update paths
    db.execute("""UPDATE Projects
SET path = CONCAT(%s, SUBSTRING(path, LENGTH(%s) + 1))
WHERE (path = %s OR path LIKE %s) AND
creator = %s;""",
(new_path, path, path, path+"/%", creator))

def recursive_delete_db(creator, path):
    path = normalize_path(path)

    projects = db.query("SELECT path FROM Projects WHERE creator=%s AND parent_path=%s",
(creator, path))
    for project in projects:
        recursive_delete_db(creator, project["path"])
    db.execute("DELETE FROM Projects WHERE creator=%s AND path=%s",
(creator, path))

def get_projects(creator, parent_path):
    parent_path = normalize_path(parent_path)
    return db.query(
"SELECT * FROM Projects WHERE creator=%s AND parent_path=%s",
(creator, parent_path))

def get_project(creator, path, is_folder=None):
    path = normalize_path(path)
    if is_folder is None:
        res = db.query(
"SELECT * FROM Projects WHERE creator=%s AND path=%s",
(creator, path))
    else:
        res = db.query(
"SELECT * FROM Projects WHERE creator=%s AND path=%s AND is_folder=%s",
(creator, path, is_folder))
    if len(res) == 0:
        return None
    return res[0]

def get_files(creator, project_path, path):
    project =  get_project(creator, project_path)
    if not project:
        return False, "project not found"
    if project["is_folder"]:
        return False, {"error": "exists_as_folder"}

    fs_path = get_fs_path(creator, project_path, path)

    if not fs_path:
        return False, "bad path"
    if not os.path.exists(fs_path):
        return False, "file not found"
    
    if os.path.isfile(fs_path):
        with open(fs_path, "r") as f:
            text = f.read()
        return text, None
    else:
        files = []
        for file_name in os.listdir(fs_path):
            file_path = os.path.join(fs_path, file_name)

            files.append({
                "name": file_name,
                "is_file": os.path.isfile(file_path)
            })
        return files, None

def upload_file(creator, project, path, content):
    if not get_project(creator, project, is_folder=False):
        return False, "project not found"

    fs_path = get_fs_path(creator, project, path)

    if not fs_path:
        return False, "bad path"
    if not os.path.exists(os.path.dirname(fs_path)):
        return False, "bad parent"
    if os.path.isdir(fs_path):
        return False, "is folder"

    with open(fs_path, "w") as f:
        f.write(content)
    return True, None

def create_file(creator, project, parent_path, name, is_file):
    if not get_project(creator, project, is_folder=False):
        return False, "project not found"

    parent_fs_path = get_fs_path(creator, project, parent_path)
    fs_path = os.path.join(parent_fs_path, name)

    if not fs_path:
        return False, "bad path"
    if not os.path.isdir(parent_fs_path):
        return False, "bad parent"
    if os.path.exists(fs_path):
        return False, "already exists"

    if is_file:
        with open(fs_path, "w") as f:
            pass
    else:
        os.mkdir(fs_path)
    return True, None

def delete_file(creator, project, parent_path, name):
    if not get_project(creator, project, is_folder=False):
        return False, "project not found"

    parent_fs_path = get_fs_path(creator, project, parent_path)
    fs_path = os.path.join(parent_fs_path, name)

    if not fs_path:
        return False, "bad path"
    if not os.path.isdir(parent_fs_path):
        return False, "bad parent"
    if not os.path.exists(fs_path):
        return False, "does not exists"

    recursive_delete(fs_path)
    return True, None

def recursive_delete(path):
    if os.path.isdir(path):
        for file_name in os.listdir(path):
            recursive_delete(os.path.join(path, file_name))
        os.rmdir(path)
    else:
        os.remove(path)

def rename_file(creator, project, parent_path, old_name, new_name):
    if not get_project(creator, project, is_folder=False):
        return False, "project not found"

    parent_fs_path = get_fs_path(creator, project, parent_path)
    old_path = os.path.join(parent_fs_path, old_name)
    new_path = os.path.join(parent_fs_path, new_name)

    if not old_path or not new_path:
        return False, "bad path"
    if not os.path.isdir(os.path.dirname(old_path)):
        return False, "bad parent"
    if not os.path.isdir(os.path.dirname(new_path)):
        return False, "bad parent"
    if not os.path.exists(old_path):
        return False, "does not exists"
    if os.path.exists(new_path):
        return False, "does not exists"

    os.rename(old_path, new_path)
    return True, None

def get_projects_with_parents(creator, project):
    project = normalize_path(project)

    return db.query("""
WITH RECURSIVE project_hierarchy AS (
    SELECT * 
    FROM Projects 
    WHERE creator = %s
    AND path = %s
    
    UNION ALL
    
    SELECT p.*
    FROM Projects p
    JOIN project_hierarchy ph ON p.path = ph.parent_path
    AND p.creator = ph.creator
)
SELECT * FROM project_hierarchy;
""", (creator, project))

def get_project_or_parents_git(creator, project_path):
    project_path = normalize_path(project_path)

    projects = get_projects_with_parents(creator, project_path)
    if len(projects) == 0:
        return {"is_git": False}, False
    for project in projects:
        if project["is_git"]:
            return {
                "is_git": True,
                "path": project["path"]
            }, True
    return {"is_git": False}, True

def git_init(creator, project, git_name, git_email, git_token, repo_name):
    project = normalize_path(project)
    
    if not get_project(creator, project):
        return False, "project not found"
    if "." in repo_name:
        return False, "bad repo name"
    if get_project_or_parents_git(creator, project)[0]["is_git"]:
        return False, "already in git"
    
    fs_path = get_fs_path(creator, project, "")
    repo_url = f"https://{git_name}:{git_token}@github.com/{git_name}/{repo_name}.git"

    p = subprocess.Popen(["git", "init"],
        cwd=fs_path)
    if p.wait():
        return False, p.returncode
    p = subprocess.Popen(["git", "config", "--local", "user.name", git_name],
        cwd=fs_path)
    if p.wait():
        return False, p.returncode
    p = subprocess.Popen(["git", "config", "--local", "user.email", git_email],
        cwd=fs_path)
    if p.wait():
        return False, p.returncode
    p = subprocess.Popen(["git", "remote", "add", "origin", repo_url], cwd=fs_path)
    if p.wait():
        return False, p.returncode

    db.execute("""
UPDATE Projects
SET is_git=true
WHERE creator=%s AND path=%s
""", (creator, project))

    add_template(creator, project, "gitignore")
    return True, None

def git_commit(creator, project_path, commit_message):
    project_path = normalize_path(project_path)

    project = get_project(creator, project_path)
    if not project:
        return False, "project not found"
    if not project["is_git"]:
        return False, "project not git"

    fs_path = get_fs_path(creator, project_path, "")
    p = subprocess.Popen(["git", "add", "."],
        cwd=fs_path)
    if p.wait():
        return False, f"git add {p.returncode}"
    time.sleep(0.1)
    p = subprocess.Popen(["git", "commit", "-am", commit_message],
        cwd=fs_path)
    if p.wait():
        return False, f"git commit {p.returncode}"
    time.sleep(0.1)
    p = subprocess.Popen(["git", "push", "-u", "origin", "main"], cwd=fs_path)
    if p.wait():
        return False, f"git push {p.returncode}"
    time.sleep(0.1)
    
    return True, None

def git_pull(creator, project_path):
    project_path = normalize_path(project_path)

    project = get_project(creator, project_path)
    if not project:
        return False, "project not found"
    if not project["is_git"]:
        return False, "project not git"

    fs_path = get_fs_path(creator, project_path, "")
    p = subprocess.Popen(["git", "reset", "--hard"],
        cwd=fs_path)
    if p.wait():
        return False, p.returncode
    p = subprocess.Popen(["git", "clean", "-fd"],
        cwd=fs_path)
    if p.wait():
        return False, p.returncode
    subprocess.Popen(["git", "pull", "origin", "main"], cwd=fs_path)
    if p.wait():
        return False, p.returncode
    
    return True, None

def git_diff(creator, project_path):
    project_path = normalize_path(project_path)
    
    project = get_project(creator, project_path)
    if not project:
        return None, "project not found"
    if not project["is_git"]:
        return None, "project not git"
    
    fs_path = get_fs_path(creator, project_path, "")
    p = subprocess.Popen(["git", "diff", "HEAD"],
        cwd=fs_path, stdout=subprocess.PIPE)
    if p.wait():
        return None, p.returncode
    out = p.stdout.read()
    return out, None

def git_clone(creator, parent_path, project_name, repo_url, pat, email):
    parent_path = normalize_path(parent_path)
    
    # basics
    project = get_project(creator, parent_path)
    if not project:
        return False, "parent not found"
    
    path = ("" if not parent_path else parent_path) + "/" + project_name
    path = normalize_path(path)

    is_valid_name = all(c.isalnum() or c in "_-" for c in project_name)
    if not is_valid_name:
        return False, "invalid name"
    if get_project(creator, path):
        return False, "project already exists"
    if get_project_or_parents_git(creator, parent_path)[0]["is_git"]:
        return False, "already in git"

    # parse url
    if "github.com" not in repo_url:
        return False, "only github for now"

    repo_url = repo_url[repo_url.index("github.com"):]
    repo_url = repo_url.removesuffix("/")
    parts = repo_url.split("/")
    if len(parts) != 3:
        return False, "bad url"
    
    _, git_name, gh_repo_name = parts

    # clone from new url
    clone_url = f"https://{git_name}:{pat}@github.com/{git_name}/{gh_repo_name}.git"

    fs_path = get_fs_path(creator, path, "")
    os.mkdir(fs_path)
    p = subprocess.Popen(["git", "clone", clone_url, "."],
        cwd=fs_path)
    if p.wait():
        return False, p.returncode
    
    # set config
    p = subprocess.Popen(["git", "config", "--local", "user.name", git_name],
        cwd=fs_path)
    if p.wait():
        return False, p.returncode
    p = subprocess.Popen(["git", "config", "--local", "user.email", email],
        cwd=fs_path)
    if p.wait():
        return False, p.returncode
    
    # find and add sub projects
    new_projects = discover_cloned_projects(creator, path)

    for new_project in new_projects:
        new_path, is_project, new_parent = new_project
        new_path = normalize_path(new_path)
        new_parent = normalize_path(new_parent)

        db.execute(
"INSERT INTO Projects (creator, path, parent_path, is_folder) VALUES (%s, %s, %s, %s)",
(creator, new_path, new_parent, not is_project))

    db.execute("""
UPDATE Projects
SET is_git=true
WHERE creator=%s AND path=%s
""", (creator, path))

    return True, None

def discover_cloned_projects(creator, path):
    discovered_projects = []

    parent_path = path[:0 if "/" not in path else path.rindex("/")]
    fs_path = get_fs_path(creator, path, "")

    maintex_path = os.path.join(fs_path, "main.tex")
    is_project = os.path.exists(maintex_path)

    if is_project:
        discovered_projects.append((path, is_project, parent_path))
    
    sub_projects = []
    for file in os.listdir(fs_path):
        sub_path = os.path.join(fs_path, file)
        if not os.path.isdir(sub_path):
            continue
        sub_projects += discover_cloned_projects(creator, path+"/"+file)

    if sub_projects and not is_project:
        discovered_projects.append((path, is_project, parent_path))
    discovered_projects += sub_projects

    return discovered_projects    

def normalize_path(path):
    if not path:
        return path
    return path.removesuffix("/").removeprefix("/")

def get_fs_path(creator, project, file_path):
    user_path = get_rel_path("compiler_workspace", creator)
    if not user_path:
        return None
    project_path = get_rel_path(user_path, project)
    if not project_path:
        return None
    return get_rel_path(project_path, file_path)

def get_rel_path(folder, path):
    folder = os.path.abspath(folder)
    fs_path = os.path.abspath(os.path.join(folder, path))

    if not fs_path.startswith(folder):
        return None
    return fs_path
from backend import db
import os

def add_project(creator, parent_path, name, is_folder):
    if name == "":
        if parent_path is not None:
            return False, "invalid name"

    if parent_path is None:
        parent_path = ""
    path = os.path.join(parent_path, name)

    is_valid_name = all(x for x in name if x.isalnum() or x in "_-")
    if not is_valid_name:
        return False, "invalid name"
    
    if not get_project(creator, parent_path, is_folder=True):
        return False, "parent doesnt exist"
    if get_project(creator, path):
        return False, "project already exists"
    if os.path.exists(get_fs_path(creator, parent_path, name)):
        return False, "file already exists"

    db.execute(
"INSERT INTO Projects (creator, path, parent_path, is_folder) VALUES (%s, %s, %s, %s)",
(creator, path, parent_path, is_folder))
    os.mkdir(get_fs_path(creator, path, ""))
    add_template(creator, path, "empty_document")
    return True, None

def add_template(creator, project, template_name):
    if not get_project(creator, project, is_folder=False):
        return
    template_folder = os.path.join("templates", template_name)
    if not os.path.exists(template_folder):
        return
    for file_name in os.listdir(template_folder):
        file_path = os.path.join(template_folder, file_name)
        with open(file_path, "r") as f:
            content = f.read()
        upload_file(creator, project, file_name, content)

def get_projects(creator, parent_path):
    return db.query(
"SELECT * FROM Projects WHERE creator=%s AND parent_path=%s",
(creator, parent_path))

def get_project(creator, path, is_folder=None):
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

def get_files(creator, project, path):
    if not get_project(creator, project, is_folder=False):
        return False, "project not found"

    fs_path = get_fs_path(creator, project, path)

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
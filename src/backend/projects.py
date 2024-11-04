from backend import db
import os

def add_project(creator, parent_path, name, is_folder):
    if name == "":
        if parent_path is not None:
            return False

    if parent_path is None:
        parent_path = ""
    path = os.path.join(parent_path, name)

    is_valid_name = all(x for x in name if x.isalnum() or x in "_-")
    if not is_valid_name:
        return False
    
    if not get_project(creator, parent_path, is_folder=True):
        return False # parent doesnt exist
    if get_project(creator, path):
        return False # project already exists
    if os.path.exists(get_fs_path(creator, parent_path, name)):
        return False # file already exists

    db.execute(
"INSERT INTO Projects (creator, path, parent_path, is_folder) VALUES (%s, %s, %s, %s)",
(creator, path, parent_path, is_folder))
    return True
    
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

def get_fs_path(username, project, file_path):
    user_path = get_rel_path("compiler_workspace", username)
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
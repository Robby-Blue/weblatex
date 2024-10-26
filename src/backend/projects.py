from backend import db

def add_project(creator, path, is_folder):
    db.execute(
"INSERT INTO Projects (creator, path, is_folder) VALUES (%s, %s, %s)",
(creator, path, is_folder))
    
def get_projects(creator, parent_path):
    return db.query(
"SELECT * FROM Projects WHERE creator=%s AND parent_path=%s",
(creator, parent_path))

def get_project(creator, path):
    res = db.query(
"SELECT * FROM Projects WHERE creator=%s AND path=%s",
(creator, path))
    if len(res) == 0:
        return None
    return res[0]
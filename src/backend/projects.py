from backend import db

def add_project(creator, path, is_folder):
    db.execute(
"INSERT INTO Projects (creator, path, is_folder) VALUES (%s, %s, %s)",
(creator, path, is_folder))
import bcrypt
import secrets
import string
from backend import db
from backend import projects

def add_user(username, password, is_admin=False):
    hashed = bcrypt.hashpw(password.encode("UTF-8"), bcrypt.gensalt())

    db.execute(
"INSERT INTO Users (username, password_hash, is_admin) VALUES (%s, %s, %s)",
(username, hashed, is_admin))
    projects.add_project(username, "", True)

def can_login(username, password):
    r = db.query("SELECT * FROM Users WHERE username=%s", (username,))
    if len(r) == 0:
        return False
    hashed = r[0]["password_hash"]
    return bcrypt.checkpw(password.encode("UTF-8"), bytes(hashed))

def change_password(username, password):
    hashed = bcrypt.hashpw(password.encode("UTF-8"), bcrypt.gensalt())

    db.execute(
"UPDATE Users SET password_hash=%s WHERE username=%s",
(hashed, username))
    
def get_user(username):
    r = db.query("SELECT * FROM Users WHERE username=%s", (username,))
    if len(r) == 0:
        return False
    return r[0]

def add_token(username):
    token = generate_token()
        
    db.execute(
"INSERT INTO Tokens (token, username) VALUES (%s, %s)",
(token, username))
    
    return token

def get_token(token):
    if not token:
        return False
    r = db.query("SELECT * FROM Tokens WHERE token=%s", (token,))
    if len(r) == 0:
        return False
    return r[0]

def generate_token():
    characters = string.ascii_letters + string.digits
    token = ''.join(secrets.choice(characters) for _ in range(50))
    return token
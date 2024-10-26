import bcrypt
import secrets
import string
from backend import db
from backend import projects

def add_user(username, password):
    hashed = bcrypt.hashpw(password.encode("UTF-8"), bcrypt.gensalt())

    db.execute(
"INSERT INTO Users (username, password_hash) VALUES (%s, %s)",
(username, hashed))
    projects.add_project(username, "", True)

def can_login(username, password):
    r = db.query("SELECT * FROM Users WHERE username=%s", (username,))
    if len(r) == 0:
        return False
    hashed = r[0]["password_hash"]
    a = bcrypt.checkpw(password.encode("UTF-8"), bytes(hashed))
    return a

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
from flask import Flask, Response, send_from_directory, request, jsonify, redirect
from flask_socketio import SocketIO, emit
import os
import signal
import mimetypes

from backend import docker
from backend import users
from backend import projects

docker.init()

app = Flask(__name__)
socketio = SocketIO(app, async_mode='eventlet')

static_folders = [
    {
        "url_path": "/",
        "files_path": ""
    },
    {
        "url_path": "/login",
        "files_path": "login"
    },
    {
        "url_path": "/projects/*",
        "files_path": "projects"
    },
    {
        "url_path": "/editor/*",
        "files_path": "editor"
    },
    {
        "url_path": "/editor",
        "files_path": "editor/scripts"
    },
    {
        "url_path": "/editor",
        "files_path": "editor/scripts/tokenizers"
    },
    {
        "url_path": "/change-password",
        "files_path": "change-password"
    },
    {
        "url_path": "/create-account",
        "files_path": "create-account"
    },
    {
        "url_path": "/invalidate-tokens",
        "files_path": "invalidate-tokens"
    }
]

static_files = []

for folder in static_folders:
    folder_path = os.path.join("frontend", folder["files_path"])

    for file_name in os.listdir(folder_path):
        url_path = folder["url_path"]
        if not file_name.endswith(".html"):
            url_path = url_path.removesuffix("/*")
            url_path = os.path.join(url_path, file_name)
        file_path = os.path.join(folder_path, file_name)

        if not os.path.isfile(file_path):
            continue

        mimetype, _ = mimetypes.guess_type(file_name)

        with open(file_path, "r") as f:
            static_files.append({
                "url_path": url_path,
                "mimetype": mimetype,
                "content": f.read()
            })

@app.route("/")
def index():
    token = request.cookies.get("token")

    if token and users.get_token(token):
        return redirect("/projects")
    else:
        return redirect("/login")

@app.route("/<path:path>")
def static_file(path):
    if path.endswith("/"):
        path = path[:-1]
    path = f"/{path}"

    best_match = 0
    found = None
    for file in static_files:
        matches_exact = path == file["url_path"]
        allow_indirect = file["url_path"].endswith("/*")
        matches_indirect = path.startswith(file["url_path"][:-2]) and allow_indirect

        match = 0
        if matches_indirect:
            match = 1
        if matches_exact:
            match = 2
        if match > best_match:
            best_match = match
            found = file

    if not found:
        return Response("not found", status=404)

    return Response(response=found["content"],
        mimetype=found["mimetype"])

@app.route("/api/projects/")
def projects_list_api():
    if "path" not in request.args:
        return Response(status=400)
    path = request.args["path"]
    token = request.cookies.get("token", None)
    user = users.get_token(token)
    if not user:
        return Response(status=401)
    project = projects.get_project(user["username"], path, is_folder=True)
    if not project:
        return Response(status=400)
    return projects.get_projects(user["username"], path)

@app.route("/login/", methods=["POST"])
def login():
    if "username" not in request.form:
        return Response(status=400)
    if "password" not in request.form:
        return Response(status=400)
    if users.can_login(request.form["username"],
            request.form["password"]):
        token = users.add_token(request.form["username"])

        r = redirect("/projects")
        r.set_cookie("token", token, httponly=True, samesite="Strict", max_age=315360000)
        return r
    else:
        return redirect("/")
    
@app.route("/change-password/", methods=["POST"])
def change_password():
    if "password" not in request.form:
        return Response(status=400)
    token = request.cookies.get("token", None)
    user = users.get_token(token)
    if not user:
        return Response(status=401)
    users.change_password(user["username"], request.form["password"])
    return redirect("/")

@app.route("/invalidate-tokens/", methods=["POST"])
def invalidate_tokens():
    token = request.cookies.get("token", None)
    user = users.get_token(token)
    if not user:
        return Response(status=401)
    users.invalidate_tokens(user["username"])
    new_token = users.add_token(user["username"])

    r = redirect("/projects")
    r.set_cookie("token", new_token, httponly=True, samesite="Strict", max_age=315360000)
    return r

@app.route("/create-account/", methods=["POST"])
def create_account():
    if "username" not in request.form:
        return Response(status=400)
    if "password" not in request.form:
        return Response(status=400)
    token = request.cookies.get("token", None)
    user = users.get_user_from_token(token)
    if not user or not user["is_admin"]:
        return Response(status=401)
    if users.get_user(request.form["username"]):
        return Response("user already exists")
    users.add_user(request.form["username"], request.form["password"])
    return redirect("/")

@app.route("/project/new/", methods=["POST"])
def new_project():
    token = request.cookies.get("token", None)
    user = users.get_token(token)
    if not user:
        return Response(status=401)
    username = user["username"]

    if "name" not in request.form:
        return Response(status=400)
    if "parent" not in request.form:
        return Response(status=400)
    if "type" not in request.form:
        return Response(status=400)
    if request.form["type"] != "project" and request.form["type"] != "folder":
        return Response(status=400)

    name = request.form["name"]
    parent = request.form["parent"]

    is_folder = request.form["type"] == "folder"

    success, error = projects.add_project(username, parent, name, is_folder)
    if not success:
        return Response(error, status=400)

    full_path = os.path.join(parent, name) 
    first_path = "/projects" if is_folder else "/editor"
    return redirect(os.path.join(first_path, full_path))

@app.route("/api/projects/files/")
def get_files():
    if "project" not in request.args:
        return Response(status=400)
    if "path" not in request.args:
        return Response(status=400)
    project = request.args["project"]
    path = request.args["path"]

    token = request.cookies.get("token", None)
    user = users.get_token(token)
    if not user:
        return Response(status=401)
    
    value, error = projects.get_files(user["username"], project, path)
    if error:
        return Response(error, status=400)
    return value

@app.route("/api/projects/files/", methods=["POST"])
def upload_file():
    if "text" not in request.json:
        return Response(status=400)
    if "project" not in request.json:
        return Response(status=400)
    if "path" not in request.json:
        return Response(status=400)
    project = request.json["project"]
    path = request.json["path"]

    token = request.cookies.get("token", None)
    user = users.get_token(token)
    if not user:
        return Response(status=401)
    
    success, error = projects.upload_file(user["username"], project, path, request.json["text"])
    if not success:
        return Response(error, status=400)
    return Response(status=200)

@app.route("/api/projects/files/new", methods=["POST"])
def create_file():
    if "project" not in request.json:
        return Response(status=400)
    if "parentPath" not in request.json:
        return Response(status=400)
    if "isFile" not in request.json:
        return Response(status=400)
    if "name" not in request.json:
        return Response(status=400)
    project = request.json["project"]
    parent_path = request.json["parentPath"]
    name = request.json["name"]
    is_file = request.json["isFile"]

    token = request.cookies.get("token", None)
    user = users.get_token(token)
    if not user:
        return Response(status=401)
    
    success, error = projects.create_file(user["username"], project, parent_path, name, is_file)
    if not success:
        return Response(error, status=400)
    return Response(status=200)

@app.route("/api/projects/files/delete", methods=["POST"])
def delete_file():
    if "project" not in request.json:
        return Response(status=400)
    if "parentPath" not in request.json:
        return Response(status=400)
    if "name" not in request.json:
        return Response(status=400)
    project = request.json["project"]
    parent_path = request.json["parentPath"]
    name = request.json["name"]

    token = request.cookies.get("token", None)
    user = users.get_token(token)
    if not user:
        return Response(status=401)
    
    success, error = projects.delete_file(user["username"], project, parent_path, name)
    if not success:
        return Response(error, status=400)
    return Response(status=200)

@app.route("/api/projects/files/rename", methods=["POST"])
def rename_file():
    if "project" not in request.json:
        return Response(status=400)
    if "parentPath" not in request.json:
        return Response(status=400)
    if "oldName" not in request.json:
        return Response(status=400)
    if "newName" not in request.json:
        return Response(status=400)
    project = request.json["project"]
    parent_path = request.json["parentPath"]
    old_name = request.json["oldName"]
    new_name = request.json["newName"]

    token = request.cookies.get("token", None)
    user = users.get_token(token)
    if not user:
        return Response(status=401)
    
    success, error = projects.rename_file(user["username"], project, parent_path, old_name, new_name)
    if not success:
        return Response(error, status=400)
    return Response(status=200)

@app.route("/api/projects/compile", methods=["POST"])
def compile_pdf():
    data = request.args
    if "sid" not in data:
        return Response(status=400)
    sid = data["sid"]

    return_code, log = docker.compile_latex(sid)

    return jsonify({
        "return_code": return_code,
        "log": log
    }), 200 if return_code == 0 else 400

@app.route("/api/projects/pdf/<path:project>")
def get_project_pdf(project):
    token = request.cookies.get("token", None)
    user = users.get_token(token)
    if not user:
        return Response(status=401)
    if not projects.get_project(user["username"], project, is_folder=False):
        return Response(status=401)
    fs_path = projects.get_fs_path(user["username"], project, "")
    return send_from_directory(fs_path, "main.pdf")

@socketio.on('connect')
def handle_connect():
    pass

@socketio.on('disconnect')
def handle_disconnect():
    if not docker.has_container(request.sid):
        return
    
    docker.kill_container(request.sid)

@socketio.on('start')
def handle_message(message):
    token = request.cookies.get("token", None)
    user = users.get_token(token)
    if not user:
        return
    username = user["username"]
    if not projects.get_project(username,
            message["project"], is_folder=False):
        return

    data_folder = "/var/lib/weblatex"
    project = message["project"] 

    project_path = os.path.join(data_folder, username, project)

    success = docker.start_container(request.sid, project_path)
    if not success:
        return

    emit("sid", {"sid": request.sid})

def handle_sigterm(*args):
    socketio.stop()

signal.signal(signal.SIGTERM, handle_sigterm)

socketio.run(app, host="0.0.0.0", port=3000, log_output=True)
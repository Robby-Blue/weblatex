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
    if not projects.get_project(user["username"], project):
        return Response(status=401)

    fs_path = get_fs_path(user, project, path)

    if not fs_path:
        return "bad path", 400
    if not os.path.exists(fs_path):
        return "file not found", 404
    
    if os.path.isfile(fs_path):
        with open(fs_path, "r") as f:
            text = f.read()
        return text
    else:
        files = []
        for file_name in os.listdir(fs_path):
            file_path = os.path.join(fs_path, file_name)

            files.append({
                "name": file_name,
                "is_file": os.path.isfile(file_path)
            })
        return files 

@app.route("/api/projects/files/", methods=["POST"])
def upload_files():
    data = request.json
    if "text" not in data:
        return Response(status=400)
    if "project" not in data:
        return Response(status=400)
    if "path" not in data:
        return Response(status=400)
    project = data["project"]
    path = data["path"]

    token = request.cookies.get("token", None)
    user = users.get_token(token)
    if not user:
        return Response(status=401)
    if not projects.get_project(user["username"], project):
        return Response(status=401)

    fs_path = get_fs_path(user, project, path)

    if not fs_path:
        return "bad path", 400
    if not os.path.exists(os.path.dirname(fs_path)):
        return "bad parent", 400
    if os.path.isdir(fs_path):
        return "is folder", 400

    text = data["text"]
    with open(fs_path, "w") as f:
        f.write(text)
    return Response(status=200)

def get_fs_path(user, project, file_path):
    user_path = get_rel_path("compiler_workspace", user["username"])
    if not user_path:
        return None
    project_path = get_rel_path(user_path, project)
    if not project_path:
        return None
    return get_rel_path(project_path, file_path)

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
    if not projects.get_project(user["username"], project):
        return Response(status=401)
    fs_path = get_fs_path(user, project, "")
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
            message["project"]):
        return

    data_folder = "/var/lib/weblatex"
    project = message["project"] 

    project_path = os.path.join(data_folder, username, project)

    success = docker.start_container(request.sid, project_path)
    if not success:
        return

    emit("sid", {"sid": request.sid})

def get_rel_path(folder, path):
    folder = os.path.abspath(folder)
    fs_path = os.path.abspath(os.path.join(folder, path))

    if not fs_path.startswith(folder):
        return None
    return fs_path

def handle_sigterm(*args):
    socketio.stop()

signal.signal(signal.SIGTERM, handle_sigterm)

socketio.run(app, host="0.0.0.0", port=3000, log_output=True)
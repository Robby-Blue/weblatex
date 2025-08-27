import eventlet
eventlet.monkey_patch()
import eventlet.queue
from flask import Flask, Response, send_from_directory, request, jsonify, redirect
from flask_socketio import SocketIO, emit
import os
import signal
import mimetypes

from backend import docker
from backend import users
from backend import projects
from backend import settings

docker.init()

app = Flask(__name__)
socketio = SocketIO(app, async_mode='eventlet')

job_queue = eventlet.queue.Queue()

static_folders = [
    {
        "url_path": "/",
        "files_path": ""
    },
    {
        "url_path": "/jsapis",
        "files_path": "jsapis"
    },
    {
        "url_path": "/login",
        "files_path": "login"
    },
    {
        "url_path": "/dashboard",
        "files_path": "dashboard"
    },
    {
        "url_path": "/projects/explorer/*",
        "files_path": "projects/explorer"
    },
    {
        "url_path": "/projects/editor/*",
        "files_path": "projects/editor"
    },
    {
        "url_path": "/projects/editor",
        "files_path": "projects/editor/scripts"
    },
    {
        "url_path": "/projects/editor",
        "files_path": "projects/editor/scripts/tokenizers"
    },
    {
        "url_path": "/projects/view/*",
        "files_path": "projects/view"
    },
    {
        "url_path": "/projects/git/*",
        "files_path": "projects/git"
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
    },
    {
        "url_path": "/settings",
        "files_path": "settings"
    }
]

static_files = []

for folder in static_folders:
    folder_path = os.path.join("frontend", folder["files_path"])

    for file_name in os.listdir(folder_path):
        url_path = folder["url_path"]

        is_indirect = url_path.endswith("/*")
        if is_indirect:
            url_path = url_path.removesuffix("/*")

        # eg. foo/bar/bar.js
        is_doubled = file_name.split(".")[0] == url_path.split("/")[-1]
        if is_doubled:
            url_path = url_path[:url_path.rindex("/")]
        url_path = f"{url_path}/{file_name}"

        remove_type = file_name.endswith(".html")
        if remove_type:
            url_path = url_path[:url_path.rindex(".")]
            if is_indirect:
                url_path = url_path + "/*"
        url_path = url_path.replace("//", "/")

        file_path = os.path.join(folder_path, file_name)

        if not os.path.isfile(file_path):
            continue

        mimetype, _ = mimetypes.guess_type(file_name)

        with open(file_path, "rb") as f:
            static_files.append({
                "url_path": url_path,
                "mimetype": mimetype,
                "content": f.read()
            })

def worker():
    while True:
        sid = job_queue.get()
        
        try:
            http_error, compile_res = docker.compile_latex(sid)

            if http_error:
                socketio.emit("compiled", {"error": http_error}, to=sid)
                continue

            return_code, log = compile_res
            
            socketio.emit("compiled", {
                "error": None,
                "return_code": return_code,
                "log": log
            }, to=sid)
        except:
            pass
        job_queue.task_done()
        
socketio.start_background_task(worker) 
        
@app.route("/")
def index():
    token = request.cookies.get("token")

    if token and users.get_token(token):
        return redirect("/dashboard")
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
    project = projects.get_project(user["username"], path)
    if not project:
        return Response(status=400)
    if not project["is_folder"]:
        return {"error": "exists_as_project"}, 400
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

        r = redirect("/projects/explorer")
        r.set_cookie("token", token, httponly=True, samesite="Strict", max_age=315360000)
        return r
    else:
        return redirect("/")
    
@app.route("/logout/")
def logout():
    token = request.cookies.get("token", None)
    user = users.get_token(token)
    if not user:
        return Response(status=401)
    users.invalidate_token(user["username"], token)

    r = redirect("/login")
    r.set_cookie("token", "deleted", httponly=True, samesite="Strict")

    return r

@app.route("/api/account/")
def get_account():
    token = request.cookies.get("token", None)
    user = users.get_user_from_token(token)
    return jsonify({
        "username": user["username"],
        "is_admin": bool(user["is_admin"])
    })
    
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

    r = redirect("/projects/explorer")
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

@app.route("/api/project/new/", methods=["POST"])
def new_project():
    token = request.cookies.get("token", None)
    user = users.get_token(token)
    if not user:
        return Response(status=401)
    username = user["username"]

    if "name" not in request.json:
        return Response(status=400)
    if "parent" not in request.json:
        return Response(status=400)
    if "type" not in request.json:
        return Response(status=400)
    if request.json["type"] != "project" and request.json["type"] != "folder":
        return Response(status=400)

    name = request.json["name"]
    parent = request.json["parent"]

    is_folder = request.json["type"] == "folder"

    success, error = projects.add_project(username, parent, name, is_folder)
    if not success:
        return Response(error, status=400)

    full_path = os.path.join(parent, name) 
    first_path = "/projects/explorer" if is_folder else "/projects/editor"
    return redirect(os.path.join(first_path, full_path))

@app.route("/api/project/new/git", methods=["POST"])
def new_project_from_git():
    token = request.cookies.get("token", None)
    user = users.get_token(token)
    if not user:
        return Response(status=401)
    username = user["username"]

    if "name" not in request.json:
        return Response(status=400)
    if "parent" not in request.json:
        return Response(status=400)
    if "repoUrl" not in request.json:
        return Response(status=400)
    if "pat" not in request.json:
        return Response(status=400)
    if "email" not in request.json:
        return Response(status=400)

    project_name = request.json["name"]
    parent = request.json["parent"]
    repo_url = request.json["repoUrl"]
    pat = request.json["pat"]
    email = request.json["email"]

    success, error = projects.git_clone(username, parent, project_name,
            repo_url, pat, email)
    
    if not success:
        return Response(error, status=400)
    return Response(status=200)

@app.route("/api/project/delete", methods=["POST"])
def delete_project():
    token = request.cookies.get("token", None)
    user = users.get_token(token)
    if not user:
        return Response(status=401)
    username = user["username"]
    if "path" not in request.json:
        return Response(status=400)
    path = request.json["path"]
    projects.delete_project(username, path)
    return Response(status=200)

@app.route("/api/project/move", methods=["POST"])
def move_project():
    token = request.cookies.get("token", None)
    user = users.get_token(token)
    if not user:
        return Response(status=401)
    username = user["username"]
    if "path" not in request.json:
        return Response(status=400)
    if "new_path" not in request.json:
        return Response(status=400)
    path = request.json["path"]
    new_path = request.json["new_path"]
    projects.move_project(username, path, new_path)
    return Response(status=200)

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
        return error, 400
    return value, 200

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

@app.route("/api/projects/pdf/<path:project>")
def get_project_pdf(project):
    token = request.cookies.get("token", None)
    user = users.get_token(token)
    if not user:
        return Response(status=401)
    if not projects.get_project(user["username"], project, is_folder=False):
        return Response(status=401)
    fs_path = projects.get_fs_path(user["username"], project, "")

    project_name = project.split("/")[-1]
    response = send_from_directory(fs_path, "main.pdf",
        download_name=f"{project_name}.pdf")
    return response

@app.route("/api/projects/git/status/<path:project>")
def git_status(project):
    token = request.cookies.get("token", None)
    user = users.get_token(token)
    if not user:
        return Response(status=401)

    username = user["username"]

    git_status, exists = projects.get_project_or_parents_git(username, project)

    if exists:
        return jsonify(git_status)
    else:
        return Response(status=404)

@app.route("/api/projects/git/init/", methods=["POST"])
def git_init():
    token = request.cookies.get("token", None)
    user = users.get_token(token)
    if not user:
        return Response(status=401)
    
    for key in ["project", "username", "email", "token", "repo"]:
        if key not in request.form:
            return Response(status=400)

    project = request.form["project"]
    git_name = request.form["username"]
    git_email = request.form["email"]
    git_token = request.form["token"]
    repo_name = request.form["repo"]

    success, error = projects.git_init(user["username"], project, git_name, git_email,
        git_token, repo_name)

    if not success:
        return Response(error, status=400)

    return redirect("/projects/git/"+project)

@app.route("/api/projects/git/commit/", methods=["POST"])
def git_commit():
    token = request.cookies.get("token", None)
    user = users.get_token(token)
    if not user:
        return Response(status=401)
    
    for key in ["project", "message"]:
        if key not in request.form:
            return Response(status=400)

    project = request.form["project"]
    message = request.form["message"]

    success, error = projects.git_commit(user["username"], project, message)
    
    if not success:
        return Response(error, status=400)

    return redirect("/projects/git/"+project)

@app.route("/api/projects/git/pull/", methods=["POST"])
def git_pull():
    token = request.cookies.get("token", None)
    user = users.get_token(token)
    if not user:
        return Response(status=401)
    
    if "project" not in request.form:
        return Response(status=400)

    project = request.form["project"]

    success, error = projects.git_pull(user["username"], project)
    
    if not success:
        return Response(error, status=400)

    return redirect("/projects/git/"+project)

@app.route("/api/projects/git/diff/<path:project>")
def git_diff(project):
    token = request.cookies.get("token", None)
    user = users.get_token(token)
    if not user:
        return Response(status=401)

    username = user["username"]
    output, error = projects.git_diff(username, project)
    
    if error:
        return Response(response=error, status=400)
    return Response(output, mimetype="text/plain")

@app.route("/api/settings")
def get_settings():
    token = request.cookies.get("token", None)
    user = users.get_user_from_token(token)
    if not user:
        return Response(status=401)

    username = user["username"]
    is_admin = user["is_admin"]
    user_settings = settings.get_user_settings(username, is_admin)
    
    return jsonify(user_settings)

@app.route("/api/settings", methods=["POST"])
def set_settings():
    if "key" not in request.json:
        return Response(status=400)
    key = request.json["key"]
    if "value" not in request.json:
        return Response(status=400)
    value = request.json["value"]
    
    token = request.cookies.get("token", None)
    user = users.get_user_from_token(token)
    if not user:
        return Response(status=401)

    username = user["username"]
    is_admin = user["is_admin"]
    success, error = settings.change_user_setting_value(username, key, value, is_admin)
    
    if not success:
        return Response(error, status=400)

    return Response(status=200)

@app.route("/dependencies/<path:dependency>")
def dependencies(dependency):
    return send_from_directory('dependencies', dependency)

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

    data_folder = os.getenv("WORKSPACE_PATH")
    project = message["project"] 

    project_path = os.path.join(data_folder, username, project)

    success = docker.start_container(request.sid, username, project_path)
    if not success:
        return

    emit("started")
    
@socketio.on('compile')
def handle_compile():
    sid = request.sid
    job_queue.put(sid)

def handle_sigterm(*args):
    socketio.stop()

signal.signal(signal.SIGTERM, handle_sigterm)
socketio.run(app, host="0.0.0.0", port=3000, log_output=True)
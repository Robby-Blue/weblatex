from flask import Flask, send_from_directory, Response, request, jsonify
from flask_socketio import SocketIO
import os
import signal

import backend.docker_helper as docker
docker.init()

sockets = {}

app = Flask(__name__)
socketio = SocketIO(app, async_mode='eventlet')

static_files = {
    "": ("", "index.html"),
    "styles.css": ("", "styles.css"),
    "login.css": ("", "login.css"),
    "editor": ("editor", "editor.html"),
    "editor/script.js": ("editor/scripts", "script.js"),
    "editor/pdf-viewer.js": ("editor/scripts", "pdf-viewer.js"),
    "editor/code-editor.js": ("editor/scripts", "code-editor.js"),
    "editor/file-system.js": ("editor/scripts", "file-system.js"),
    "editor/latex-tokenizer.js": ("editor/scripts/tokenizers", "latex-tokenizer.js"),
    "editor/editor.css": ("editor", "editor.css")
}

@app.route("/", defaults={'path': ''}, methods=["GET"])
@app.route("/<path:path>")
def static_file(path):
    if path.endswith("/"):
        path = path[:-1]

    if path not in static_files:
        return Response(status=404)

    file_path, name = static_files[path]
    file_path = os.path.join("frontend", file_path)
    return send_from_directory(file_path, name)

@app.route("/files/", defaults={'path': ''}, methods=["GET"])
@app.route("/files/<path:path>", methods=["GET"])
def get_files(path):
    fs_path = get_rel_path("compiler_workspace", path)

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

@app.route("/files/<path:path>", methods=["POST"])
def upload_files(path):
    data = request.json
    if "text" not in data:
        return Response(status=400)
    
    fs_path = get_rel_path("compiler_workspace", path)

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

@app.route("/pdf/compile", methods=["POST"])
def compile_pdf():
    sid = sockets["main"]

    return_code, log = docker.compile_latex(sid)

    return jsonify({
        "return_code": return_code,
        "log": log
    }), 200 if return_code == 0 else 403

@socketio.on('connect')
def handle_connect():
    if "main" in sockets:
        return

    docker.start_container(request.sid)
    sockets["main"] = request.sid

@socketio.on('disconnect')
def handle_disconnect():
    if not docker.has_container(request.sid):
        return
    
    docker.kill_container(request.sid)
    sockets.pop("main") 

@socketio.on('message')
def handle_message(data):
    pass

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
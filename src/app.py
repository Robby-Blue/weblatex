from flask import Flask, send_from_directory, Response, request, jsonify
from flask_socketio import SocketIO

import backend.docker_helper as docker
docker.init()

sockets = {}

app = Flask(__name__)
socketio = SocketIO(app, async_mode='eventlet')

static_files = {
    "pdf": ("compiler_workspace", "main.pdf"),
    "script.js": ("frontend", "script.js"),
    "pdf-viewer.js": ("frontend", "pdf-viewer.js"),
    "code-editor.js": ("frontend", "code-editor.js"),
    "latex-tokenizer.js": ("frontend", "latex-tokenizer.js"),
    "styles.css": ("frontend", "styles.css")
}

@app.route("/")
def index():
    return send_from_directory("frontend", "index.html")

@app.route("/files", methods=["GET"])
def get_files():
    with open("compiler_workspace/main.tex", "r") as f:
        text = f.read()
    return text

@app.route("/files", methods=["POST"])
def upload_files():
    data = request.json
    if "text" not in data:
        return Response(status=400)
    text = data["text"]
    with open("compiler_workspace/main.tex", "w") as f:
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

@app.route("/<path:path>")
def static_file(path):
    if path.endswith("/"):
        path = path[:-1]

    if path not in static_files:
        return Response(status=404)

    file_path, name = static_files[path]
    return send_from_directory(file_path, name)

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

socketio.run(app, host="0.0.0.0", port=3000)
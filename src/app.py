import os
from flask import Flask, send_from_directory, Response, request, jsonify
import docker

path = os.path.realpath("compiler_workspace/latex")

docker_client = docker.from_env()

container = docker_client.containers.run("latex", detach=True, tty=True,
    volumes={
        path: {'bind': '/compile', 'mode': 'rw'}
    }
)

app = Flask(__name__)

static_files = {
    "pdf": ("compiler_workspace/latex", "main.pdf"),
    "script.js": ("frontend", "script.js"),
    "styles.css": ("frontend", "styles.css"),
    "pdf.mjs": ("frontend/pdfjs", "pdf.mjs"),
    "pdf.worker.mjs": ("frontend/pdfjs", "pdf.worker.mjs"),
}

@app.route("/")
def index():
    return send_from_directory("frontend", "index.html")

@app.route("/files", methods=["GET"])
def get_files():
    with open("compiler_workspace/latex/main.tex", "r") as f:
        text = f.read()
    return text

@app.route("/files", methods=["POST"])
def upload_files():
    data = request.json
    if "text" not in data:
        return Response(status=400)
    text = data["text"]
    with open("compiler_workspace/latex/main.tex", "w") as f:
        f.write(text)
    return Response(status=200)

@app.route("/pdf/compile", methods=["POST"])
def compile_pdf():
    res = container.exec_run(["pdflatex", "--shell-escape", "-interaction=nonstopmode",
        "-halt-on-error", "-output-directory=.", "main.tex"],
        workdir="/compile")

    code = res.exit_code
    output = res.output.decode("UTF-8")

    return jsonify({
        "code": code,
        "output": output
    }), 200 if code == 0 else 403

@app.route("/<path:path>")
def static_file(path):
    if path.endswith("/"):
        path = path[:-1]

    if path not in static_files:
        return Response(status=404)

    file_path, name = static_files[path]
    return send_from_directory(file_path, name)

app.run(host="0.0.0.0", port=3000)
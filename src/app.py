from flask import Flask, send_from_directory, Response, request, jsonify
import subprocess

app = Flask(__name__)

static_files = {
    "pdf": ("compiler_workspace/output", "main.pdf"),
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
    p = subprocess.Popen(["pdflatex", "--shell-escape", "-interaction=nonstopmode",
        "-halt-on-error", "-output-directory=../output", "main.tex"],
        cwd="compiler_workspace/latex",
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT)
    p.wait()
    return jsonify({
        "code": p.returncode
    }), 200 if p.returncode == 0 else 403

@app.route("/<path:path>")
def static_file(path):
    if path.endswith("/"):
        path = path[:-1]

    if path not in static_files:
        return Response(status=404)

    file_path, name = static_files[path]
    return send_from_directory(file_path, name)

app.run(host="0.0.0.0", port=3000)
from flask import Flask, send_from_directory, Response

# pdflatex -interaction=nonstopmode -halt-on-error -output-directory=latex main.tex

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

@app.route("/<path:path>")
def static_file(path):
    if path.endswith("/"):
        path = path[:-1]

    if path not in static_files:
        return Response(status=404)

    file_path, name = static_files[path]
    return send_from_directory(file_path, name)

app.run(host="0.0.0.0", port=3000)
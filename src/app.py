from flask import Flask, send_from_directory

# pdflatex -interaction=nonstopmode -halt-on-error -output-directory=latex main.tex

app = Flask(__name__)

@app.route("/")
def hello():
    return send_from_directory("frontend", "index.html")

@app.route("/pdf/")
def pdf():
    return send_from_directory("compiler_workspace/output", "main.pdf", as_attachment=False)

@app.route("/script.js/")
def js():
    return send_from_directory("frontend/", "script.js")

@app.route("/styles.css/")
def css():
    return send_from_directory("frontend/", "styles.css")

@app.route("/pdf.mjs/")
def pdfjs():
    return send_from_directory("frontend/pdfjs", "pdf.mjs")

@app.route("/pdf.worker.mjs/")
def pdfworkerjs():
    return send_from_directory("frontend/pdfjs", "pdf.worker.mjs")

app.run(host="0.0.0.0", port=3000)
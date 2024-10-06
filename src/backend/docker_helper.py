import docker
import os

image_name = "weblatex-compilation"

docker_client = docker.from_env()
containers = {}

def start_container(sid):
    path = os.path.realpath("compiler_workspace/latex")

    container = docker_client.containers.run(image_name, detach=True, tty=True,
        volumes={
            path: {'bind': '/compile', 'mode': 'rw'}
        },
        user="1000:1000", # idk what 1000:1000 means exactly
        # but it makes it not run as root
        network_disabled=True
    )
    containers[sid] = container

def has_container(sid):
    return sid in containers

def kill_container(sid):
    container = containers[sid]
    container.kill()

def compile_latex(sid):
    container = containers[sid]
    res = container.exec_run(["pdflatex", "--shell-escape", "-interaction=nonstopmode",
        "-halt-on-error", "-output-directory=.", "main.tex"],
        workdir="/compile")

    code = res.exit_code
    output = res.output.decode("UTF-8")

    return code, output
import docker
import os

from backend import settings

image_name = "weblatex-compilation"

docker_client = docker.from_env()
containers = {}

def init():
    if not has_image():
        print(image_name, "not found")
        print("creating new image")
        print("this will take a long time")

        build_image()

        print("built image")

def has_image():
    images = docker_client.images.list()
    for image in images:
        for tag in image.tags:
            if tag != f"{image_name}:latest":
                continue
            return True
    return False

def build_image():
    docker_client.images.build(
        path="compilation_docker",
        tag=image_name,
        rm=True
    )

def start_container(sid, username, project_path):
    if sid in containers:
        return False

    setting, _ = settings.get_user_setting(username, "compile-timeout")
    compile_timeout = setting["value"]

    path = os.path.realpath(project_path)
    mnt = docker.types.Mount(type="bind", source=path, target="/compile")

    container = docker_client.containers.run(image_name, detach=True, tty=True,
        mounts=[mnt],
        network_disabled=True,
        cpu_period=100000,
        cpu_quota=50000,
        cpuset_cpus="0"
    )
    # this runs it as root
    # because it needs root to write the output pdf
    # but it doesnt have internet and access
    # to nothing but the project itself
    # this hopefully makes it secure enough

    containers[sid] = {
        "container": container,
        "compile_timeout": compile_timeout
    }
    return True

def has_container(sid):
    return sid in containers

def kill_container(sid):
    container = containers[sid]
    container["container"].kill()

def compile_latex(sid):
    if sid not in containers:
        return (404, "container sid not found"), None
    
    container = containers[sid]
    
    # required to get latest state
    container["container"].reload()
    state = container["container"].attrs["State"]
    if state["Running"] == False:
        return (404, "container not running"), None
    
    compile_timeout = container["compile_timeout"]
    res = container["container"].exec_run(["timeout", str(compile_timeout), "pdflatex", "--shell-escape", "-interaction=nonstopmode",
        "-halt-on-error", "-output-directory=.", "main.tex"],
        workdir="/compile")

    code = res.exit_code
    output = res.output.decode("UTF-8")

    return None, (code, output)
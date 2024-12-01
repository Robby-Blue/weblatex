from backend.database_helper import DatabaseHelper

db = DatabaseHelper()
db.connect()
db.setup()

import backend.docker_helper as docker

import backend.users as users
import backend.projects as projects
import backend.settings as settings
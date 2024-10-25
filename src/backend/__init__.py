from backend.database_helper import DatabaseHelper
import backend.docker_helper as docker

db = DatabaseHelper()
db.connect()
db.setup()

import backend.users as users
import os
import mysql.connector.pooling

class DatabaseHelper:

    connections = {}

    def connect(self):
        self.pool = mysql.connector.pooling.MySQLConnectionPool(
            host=os.getenv("DB_HOST"),
            user=os.getenv("DB_USERNAME"),
            password=os.getenv("DB_PASSWORD"),
            database=os.getenv("DB_DATABASE"),
            pool_size=5
        )

    def get_connection(self):
        connection = self.pool.get_connection()
        cursor = connection.cursor(dictionary=True)
        return connection, cursor

    def query(self, statement, values=()):
        connection, cursor = self.get_connection()
        cursor.execute(statement, values)
        result = cursor.fetchall()
        connection.close()
        return result

    def execute(self, statement, values=()):
        connection, cursor = self.get_connection()
        cursor.execute(statement, values)
        connection.commit()
        connection.close()

    def execute_many(self, statement, values=[()]):
        connection, cursor = self.get_connection()
        cursor.executemany(statement, values)
        connection.commit()
        connection.close()

    def setup(self):
        self.execute("""
CREATE TABLE IF NOT EXISTS Users(
    username VARCHAR(20) NOT NULL UNIQUE,
    password_hash BINARY(60) NOT NULL,
    PRIMARY KEY (username)
)
""")

        self.execute("""
CREATE TABLE IF NOT EXISTS Tokens(
    token VARCHAR(50) NOT NULL,
    username VARCHAR(20) NOT NULL,
    FOREIGN KEY (username) REFERENCES Users(username)
)
""")
        
        self.execute("""
CREATE TABLE IF NOT EXISTS Projects(
    path VARCHAR(50) NOT NULL,
    is_folder BOOL NOT NULL,
    parent_path VARCHAR(50),
    creator VARCHAR(20) NOT NULL,
    PRIMARY KEY (path),
    FOREIGN KEY (parent_path) REFERENCES Projects(path),
    FOREIGN KEY (creator) REFERENCES Users(username)
)
""")
        
        if len(self.query(
"SELECT * FROM Users LIMIT 1")) == 0:
            from backend import users
            users.add_user("admin", "admin")

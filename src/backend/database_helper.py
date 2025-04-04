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
    is_admin BOOL NOT NULL,
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
    path VARCHAR(128) NOT NULL,
    is_folder BOOL NOT NULL,
    parent_path VARCHAR(128),
    creator VARCHAR(20) NOT NULL,
    is_git BOOL DEFAULT FALSE NOT NULL,
    FOREIGN KEY (creator) REFERENCES Users(username)
)
""")
        
        # setting_key because just 'key' is reserved
        self.execute("""
CREATE TABLE IF NOT EXISTS Settings(
    username VARCHAR(20) NOT NULL,
    setting_key VARCHAR(20) NOT NULL,
    value INT NOT NULL,
    editable BOOL NOT NULL,
    FOREIGN KEY (username) REFERENCES Users(username)
)
""")
        
        if len(self.query(
"SELECT * FROM Users LIMIT 1")) == 0:
            from backend import users
            users.add_user("admin", "admin", is_admin=True)

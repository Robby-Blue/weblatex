from backend import db

default_settings = {
    "auto-compile": {
        "name": "compile on save",
        "type": "bool",
        "value": False,
        "editable": True,
    },
    "auto-save": {
        "name": "auto save",
        "type": "bool",
        "value": False,
        "editable": False,
    },
    "compile-timeout": {
        "name": "compile timeout",
        "type": "int",
        "value": 5,
        "editable": False,
    },
}

def get_user_settings(username, is_admin=False):
    settings = []
    db_settings = db.query("SELECT * FROM Settings WHERE username=%s", (username,))
    for key in default_settings.keys():
        setting = get_setting(key, db_settings)
        if is_admin:
            setting["editable"] = True
        settings.append(setting)
    return settings

def get_user_setting(username, key, db_settings=None):
    if not db_settings:
        db_settings = db.query("SELECT * FROM Settings WHERE username=%s", (username,))
    setting = get_setting(key, db_settings)
    return setting, db_settings

def get_setting(key, db_settings):
    setting_default = default_settings[key]
    name = setting_default["name"]

    found_db_setting = None
    for db_setting in db_settings:
        if db_setting["setting_key"] == key:
            found_db_setting = db_setting
            break

    if found_db_setting:
        value = found_db_setting["value"]
        editable = found_db_setting["editable"]
    else:
        value = setting_default["value"]
        editable = setting_default["editable"]

    return {
        "key": key,
        "name": name,
        "value": value,
        "editable": editable,
        "type": setting_default["type"],
        "in_db": bool(found_db_setting)
    }

def change_user_setting_value(username, key, value, is_admin=False):
    setting, _ = get_user_setting(username, key)
    if not (is_admin or setting["editable"]):
        return False, "not allowed to edit"
    
    if setting["in_db"]:
        db.execute("""
            UPDATE Settings SET value=%s 
            WHERE username=%s AND setting_key=%s""",
            (value, username, key))
    else:
        db.execute("""
            INSERT INTO Settings (username, setting_key, value, editable)
            VALUES (%s, %s, %s, %s)""",
            (username, key, value, setting["editable"]))
        
    return True, None

def change_user_setting_editable(username, key, new_editable):
    setting, _ = get_user_setting(username, key)

    if setting["in_db"]:
        db.execute("""
            UPDATE Settings SET editable=%s 
            WHERE username=%s AND setting_key=%s""",
            (new_editable, username, key))
    else:
        db.execute("""
            INSERT INTO Settings (username, setting_key, value, editable)
            VALUES (%s, %s, %s, %s)""",
            (username, key, setting["value"], new_editable))

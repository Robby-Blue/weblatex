let settings = {};

export function getSetting(key) {
    return settings.find((setting) => setting.key == key).value;
}

async function loadSettings() {
    let r = await fetch("/api/settings");
    settings = await r.json();
}

loadSettings();

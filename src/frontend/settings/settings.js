let settingsDiv = document.getElementById("settings-area");

let inputElementTypes = {
    bool: "checkbox",
    int: "number",
};

let inputElementKeys = {
    checkbox: "checked",
    number: "value",
};

async function uploadSetting(key, input) {
    let inputType = input.type;
    let inputElementKey = inputElementKeys[inputType];
    let value = input[inputElementKey];

    await fetch("/api/settings", {
        method: "POST",
        body: JSON.stringify({
            key: key,
            value: value,
        }),
        headers: {
            "Content-Type": "application/json",
        },
    });
}

async function loadPage() {
    let r = await fetch("/api/settings");
    let settings = await r.json();

    for (let setting of settings) {
        if (!setting.editable) continue;

        let updateSettingTimeoutId = null;

        let settingDiv = document.createElement("div");
        settingDiv.classList.add("setting-div");

        let nameLabel = document.createElement("p");
        nameLabel.innerText = setting.name;
        settingDiv.appendChild(nameLabel);

        let input = document.createElement("input");
        input.type = inputElementTypes[setting.type];

        if (setting.type == "bool") {
            input.checked = setting.value;
        } else if (setting.type == "int") {
            input.value = setting.value;
        }

        input.addEventListener("change", async (event) => {
            if (updateSettingTimeoutId) {
                clearTimeout(updateSettingTimeoutId);
            }
            updateSettingTimeoutId = setTimeout(async () => {
                await uploadSetting(setting.key, input);
            }, 500);
        });

        settingDiv.appendChild(input);
        settingsDiv.appendChild(settingDiv);
    }
}

loadPage();

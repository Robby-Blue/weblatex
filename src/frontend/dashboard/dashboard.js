async function loadDashboard() {
    let r = await fetch("/api/account/");
    let data = await r.json()
    console.log(data)

    let titleElement = document.getElementById("title")
    titleElement.innerText = `hey, ${data.username}`

    if(data.is_admin){
        let adminDiv = document.getElementById("admin_links")
        adminDiv.classList.remove("hidden")
    }
}

loadDashboard()
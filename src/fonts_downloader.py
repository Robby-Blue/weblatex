"""
Download Roboto and Roboto Mono 
"""

import requests

url = "https://fonts.googleapis.com/css2?family=Roboto&family=Roboto+Mono&display=swap"

req = requests.get(url,
    headers={
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0"
    })
data = req.text

start_str = "src: url("

i = 0
while start_str in data[i:]:
    url_start = data.find(start_str, i) + len(start_str)
    url_end = data.find(")", url_start)
    name_start = data.rindex("/", url_start, url_end) + 1
    
    name = data[name_start:url_end]
        
    font_req = requests.get(data[url_start:url_end])
    font_data = font_req.content
    with open(f"dependencies/fonts/{name}", "wb") as f:
        f.write(font_data)
    
    data = data[:url_start] + "/dependencies/fonts/" + name + data[url_end:]
    i = url_end

with open("dependencies/fonts/fonts.css", "w") as f:
    f.write(data)


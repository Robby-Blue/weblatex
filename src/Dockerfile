# --- build stage
FROM alpine:latest AS builder

RUN apk add --no-cache \
    python3 \
    py3-pip \
    build-base \
    gcc \
    python3-dev \
    wget \
    tar \
    npm

WORKDIR /app

RUN npm install codemirror codemirror-lang-latex @codemirror/theme-one-dark && \
    npm install yjs y-codemirror.next y-websocket && \
    npm install -D rollup @rollup/plugin-node-resolve && \
    npm install texlyre-busytex && \
    npx texlyre-busytex download-assets ./dependencies && \
    cp -r node_modules dependencies/

COPY frontend/projects/editor/scripts/codemirror.js .
RUN npx rollup codemirror.js -f es -o codemirror.bundle.js -p @rollup/plugin-node-resolve

# -- install python libs
RUN python3 -m venv /venv
ENV PATH="/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# -- dl js deps
RUN wget https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-5.0.375.tgz -O pdfjs-dist.tgz && \
    mkdir -p dependencies/pdfjs && \
    tar -xzf pdfjs-dist.tgz --strip-components=2 -C dependencies/pdfjs package/build/ && \
    rm pdfjs-dist.tgz

RUN wget https://registry.npmjs.org/socket.io/-/socket.io-4.0.0.tgz -O socket.io.tgz && \
    mkdir -p dependencies/socketio && \
    tar -xzf socket.io.tgz --strip-components=2 -C dependencies/socketio package/client-dist/ && \
    rm socket.io.tgz

# -- dl fonts
COPY fonts_downloader.py .
RUN mkdir -p dependencies/fonts && \
    python fonts_downloader.py

# --- runtime stage
FROM alpine:latest

RUN apk add --no-cache \
    python3 \
    git

WORKDIR /app/weblatex
COPY --from=builder /venv /venv
COPY --from=builder /app/dependencies dependencies
COPY --from=builder /app/codemirror.bundle.js frontend/projects/editor/scripts/codemirror.bundle.js
ENV PATH="/venv/bin:$PATH"

RUN git config --global init.defaultBranch main

COPY . .

CMD [ "python", "app.py" ]

FROM python:3.9

WORKDIR /app/weblatex

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN git config --global init.defaultBranch main

RUN wget https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-5.0.375.tgz -O pdfjs-dist.tgz && \
    mkdir -p dependencies/pdfjs && \
    tar -xzf pdfjs-dist.tgz --strip-components=2 -C dependencies/pdfjs package/build/ && \
    rm pdfjs-dist.tgz

RUN wget https://registry.npmjs.org/socket.io/-/socket.io-4.0.0.tgz -O socket.io.tgz && \
    mkdir -p dependencies/socketio && \
    tar -xzf socket.io.tgz --strip-components=2 -C dependencies/socketio package/client-dist/ && \
    rm socket.io.tgz

COPY . .

CMD [ "python", "app.py" ]

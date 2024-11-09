FROM python:3.9

WORKDIR /app/weblatex

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN git config --global init.defaultBranch main

COPY . .

CMD [ "python", "-u", "app.py" ]

from flask import Flask

app = Flask(__name__)

@app.route("/")
def home():
    with open("message.txt", "r") as f:
        message = f.read()
    return f"<h1>{message}</h1>"

app.run(host="0.0.0.0", port=5000)
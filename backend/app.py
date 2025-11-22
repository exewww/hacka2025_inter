from flask import Flask
from flask_cors import CORS
from src.routes.generate import generate_bp

def create_app():
    app = Flask(__name__)
    CORS(app, resources={r"/*": {"origins": "*"}})  # erlaubt alle Domains
    app.register_blueprint(generate_bp)
    return app

if __name__ == "__main__":
    app = create_app()
    app.run(debug=True)

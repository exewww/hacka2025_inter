from flask import Blueprint, request, jsonify
from src.services.llm_service import generate_text

generate_bp = Blueprint("generate", __name__)

@generate_bp.route("/generate", methods=["POST"])
def generate():
    data = request.get_json()
    features = data.get("features", {})
    updated_features = generate_text(features)
    return jsonify({"features": updated_features})

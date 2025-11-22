from flask import Blueprint, request, jsonify
from src.services.llm_service import generate_text

generate_bp = Blueprint("generate", __name__)

@generate_bp.route("/generate", methods=["POST"])
def generate():
    data = request.get_json()
    text = data.get("input", "")
    result = generate_text(text)
    return jsonify({"output": result})

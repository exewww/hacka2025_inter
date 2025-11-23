from flask import Blueprint, request, jsonify
from src.services.functions import *
from src.services.user_profile import personal_info, dream_property_features, current_fixed_expenses

generate_bp = Blueprint("generate", __name__)
@generate_bp.route("/initial_features", methods=["GET"])
def initial_features():
    context = "Initialisierung der Sliderwerte"  # optional text if you want
    features = generate_initial_plot_features(
        personal_info,
        dream_property_features,
        current_fixed_expenses,
        context = " "
    )
    return jsonify({"features": features})

@generate_bp.route("/generate", methods=["POST"])
def generate():
    data = request.get_json()
    features = data.get("features", {})
    updated_features = recalculate_plot_features_llm(features)
    return jsonify({"features": updated_features})

@generate_bp.route("/generate_suggestion", methods=["POST"])
def generate_suggestion():
    data = request.get_json()
    clicked_feature = data.get("clickedFeature")
    features = data.get("features", {})
    milestones = data.get("milestones", [])
    letter = data.get("letter", "")

    suggestion_text = generate_purchase_suggestions(personal_info, current_fixed_expenses, features, clicked_feature,letter,milestones)

    return jsonify({"suggestion": suggestion_text})
    
# ✅ NEW ROUTE FOR MILESTONES
@generate_bp.route("/generate_milestones", methods=["POST"])
def generate_milestones():
    data = request.get_json()
    
    # The user's input text
    letter = data.get("letter", "")
    
    # Current slider values (needed for YearsToPurchase)
    features = data.get("features", {})
    
    # Call your provided function
    milestones = generate_milestone_plan(
        personal_info, 
        current_fixed_expenses, 
        features, 
        letter
    )
    
    return jsonify({"milestones": milestones})
# ✅ NEW ROUTE FOR CAPITAL SERIES
@generate_bp.route("/generate_capital_series", methods=["POST"])
def generate_capital_series():
    data = request.get_json()
    
    # Extract data coming from the frontend
    plot_features = data.get("features", {})
    milestones = data.get("milestones", [])
    letter = data.get("letter", "")


    # Call the detailed capital series function
    # personal_info and current_fixed_expenses come from src.services.user_profile
    series_data = generate_detailed_capital_series(
        personal_info,
        current_fixed_expenses,
        plot_features,
        milestones,
        letter
    )
    
    return jsonify({"capital_series": series_data})
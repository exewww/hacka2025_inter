import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from src.routes.generate import generate_bp

# --- GLOBAL STORAGE (The "Mailbox") ---
bot_update_storage = {
    "latest": None
}

def create_app():
    app = Flask(__name__)
    CORS(app, resources={r"/*": {"origins": "*"}})
    
    # Register your existing blueprints
    app.register_blueprint(generate_bp)

    # ==========================================
    # 1. Endpoint for BOT to push data
    # ==========================================
    @app.route('/receive_bot_update', methods=['POST'])
    def receive_bot_update():
        """
        The Telegram Bot calls this when it has calculated a new plan.
        """
        try:
            data = request.json
            bot_update_storage["latest"] = data
            print(f"📩 Backend received {len(data.get('milestones', []))} new milestones from Bot.")
            return jsonify({"status": "received"}), 200
        except Exception as e:
            print(f"Error receiving bot update: {e}")
            return jsonify({"error": str(e)}), 500

    # ==========================================
    # 2. Endpoint for FRONTEND to poll
    # ==========================================
    @app.route('/check_for_updates', methods=['GET'])
    def check_for_updates():
        """
        React calls this every few seconds to see if the bot sent anything.
        """
        if bot_update_storage["latest"]:
            data = bot_update_storage["latest"]
            # Clear storage so we don't update React infinitely
            bot_update_storage["latest"] = None 
            return jsonify({"update": data})
        else:
            return jsonify({"update": None})

    return app

if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, port=5000)
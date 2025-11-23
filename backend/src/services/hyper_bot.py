import os
import asyncio
import logging
from faster_whisper import WhisperModel
import edge_tts
import requests # <--- NEEDED FOR FLASK COMMUNICATION
import google.generativeai as genai
from dotenv import load_dotenv

from telegram import Update
from telegram.constants import ChatAction
from telegram.ext import Application, MessageHandler, filters, ContextTypes, CommandHandler

# --- CONFIGURATION ---
load_dotenv()
TELEGRAM_TOKEN = os.getenv("Telegram_Bot_Token")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
FLASK_BACKEND_URL = "http://127.0.0.1:5000" # Ensure this matches your Flask port

try:
    TARGET_CHAT_ID = int(os.getenv("Target_Chat_ID", "0")) 
except ValueError:
    TARGET_CHAT_ID = 0

genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel("gemini-2.0-flash")

# Import Helpers
try:
    from user_profile import personal_info, current_fixed_expenses, plot_features
    from functions import generate_milestone_plan, update_milestones_logic
except ImportError:
    personal_info = {}; current_fixed_expenses = {}; plot_features = {}
    def generate_milestone_plan(*args): return []
    def update_milestones_logic(*args): return {}

# --- INITIALIZATION ---
print("--- Loading Whisper... ---")
stt_model = WhisperModel("base")

print("--- Calculating Initial Plan... ---")
users_intro_letter = "I want to buy a flat in Berlin." 
initial_milestones = generate_milestone_plan(personal_info, current_fixed_expenses, plot_features, users_intro_letter)

CURRENT_STATE = {
    "p_info": personal_info,
    "expenses": current_fixed_expenses,
    "plot_features": plot_features,
    "milestones": initial_milestones, 
    "new_milestones": [] 
}

# --- LOGIC HELPER ---
def generate_checkin_script(milestones):
    if not milestones: return "Hey! No milestones set."
    next_mile = milestones[0]
    try:
        prompt = f"User's next milestone: '{next_mile['milestone']}'. Write a 1-sentence check-in."
        return model.generate_content(prompt).text
    except:
        return f"Did you reach {next_mile['milestone']}?"

async def execute_checkin_logic(bot, chat_id):
    script = generate_checkin_script(CURRENT_STATE['milestones'])
    await bot.send_message(chat_id=chat_id, text=f"📞 *CHECK-IN*:\n\n{script}", parse_mode="Markdown")
    
    audio_file = f"checkin_{chat_id}.mp3"
    await edge_tts.Communicate(script, "en-US-AriaNeural").save(audio_file)
    try:
        with open(audio_file, "rb") as f: await bot.send_voice(chat_id=chat_id, voice=f)
    except: pass
    if os.path.exists(audio_file): os.remove(audio_file)

# --- HANDLERS ---
async def trigger_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await execute_checkin_logic(context.bot, update.effective_chat.id)

async def auto_trigger_task(app):
    await asyncio.sleep(10)
    if TARGET_CHAT_ID != 0:
        await execute_checkin_logic(app.bot, TARGET_CHAT_ID)

async def post_init(application: Application):
    asyncio.create_task(auto_trigger_task(application))

async def handle_response(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global CURRENT_STATE
    user_id = update.effective_chat.id
    
    # 1. Process Input (Voice or Text)
    user_text = ""
    if update.message.voice:
        await context.bot.send_chat_action(chat_id=user_id, action=ChatAction.RECORD_VOICE)
        f_path = f"user_{user_id}.ogg"
        f = await update.message.voice.get_file()
        await f.download_to_drive(f_path)
        user_text = stt_model.transcribe(f_path)["text"]
        if os.path.exists(f_path): os.remove(f_path)
    else:
        await context.bot.send_chat_action(chat_id=user_id, action=ChatAction.TYPING)
        user_text = update.message.text

    print(f"--- User Input: {user_text}")

    # 2. Calculate New Plan
    result = update_milestones_logic(
        CURRENT_STATE['p_info'], 
        CURRENT_STATE['expenses'], 
        CURRENT_STATE['milestones'], 
        user_text
    )

    if result:
        new_plan = result.get('new_milestones', [])
        CURRENT_STATE['new_milestones'] = new_plan
        
        # 3. 🔥 SEND UPDATE TO FLASK FRONTEND 🔥
        try:
            print("📤 Sending new plan to Frontend...")
            requests.post(f"{FLASK_BACKEND_URL}/receive_bot_update", json={
                "milestones": new_plan,
                "user_text": user_text
            })
        except Exception as e:
            print(f"❌ Failed to reach Flask: {e}")

        # 4. Reply to Telegram User
        reply = result.get('reply_text', "Updated.")
        await update.message.reply_text(f"🤖 {reply}")
        
        roadmap = "\n".join([f"🔹 *{m['time']}*: {m['milestone']}" for m in new_plan])
        if roadmap: await update.message.reply_text(f"📅 *New Plan:*\n{roadmap}", parse_mode="Markdown")

        a_file = f"reply_{user_id}.mp3"
        await edge_tts.Communicate(reply, "en-US-AriaNeural").save(a_file)
        try: 
            with open(a_file, "rb") as f: await update.message.reply_voice(voice=f)
        except: pass
        if os.path.exists(a_file): os.remove(a_file)

if __name__ == "__main__":
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.basicConfig(format='%(asctime)s - %(message)s', level=logging.INFO)
    app = Application.builder().token(TELEGRAM_TOKEN).post_init(post_init).build()
    app.add_handler(CommandHandler("trigger", trigger_command))
    app.add_handler(MessageHandler(filters.VOICE | (filters.TEXT & ~filters.COMMAND), handle_response))
    app.run_polling()
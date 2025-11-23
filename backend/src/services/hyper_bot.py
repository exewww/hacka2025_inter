# new data in: CURRENT_STATE['new_milestones'] 
# suchen nach HERE CHANGE und ändern

import os
import json
import asyncio
import logging
import whisper
import edge_tts
import google.generativeai as genai
from dotenv import load_dotenv

from telegram import Update
from telegram.constants import ChatAction
from telegram.ext import Application, MessageHandler, filters, ContextTypes, CommandHandler
from telegram.error import NetworkError

# --- CONFIGURATION ---
load_dotenv()
TELEGRAM_TOKEN = os.getenv("Telegram_Bot_Token")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# WICHTIG: Die Chat ID muss ein Integer sein. 
# Wenn du sie noch nicht hast, starte den Bot, sende /start und kopiere die ID hier rein.
try:
    TARGET_CHAT_ID = int(os.getenv("Target_Chat_ID", "0")) 
except ValueError:
    TARGET_CHAT_ID = 0

if not TELEGRAM_TOKEN or not GEMINI_API_KEY:
    raise ValueError("Missing API Keys!")

genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel("gemini-2.0-flash")

# Import Helpers
try:
    from user_profile import personal_info, dream_property_features, current_fixed_expenses, plot_features
    from functions import generate_milestone_plan, update_milestones_logic
except ImportError:
    print("⚠️  Make sure user_profile.py and functions.py are in the folder!")
    personal_info = {}; current_fixed_expenses = {}; plot_features = {}
    def generate_milestone_plan(*args): return []
    def update_milestones_logic(*args): return {}

# --- INITIALIZATION ---
print("--- Loading Whisper... ---")
stt_model = whisper.load_model("base")

print("--- Calculating Plan... ---")
users_intro_letter = "I want to buy a flat in Berlin. I am saving aggressively." 

# DAS SIND DIE "ALTEN" MILESTONES (INITIAL) HERE CHANGE
initial_milestones = generate_milestone_plan(personal_info, current_fixed_expenses, plot_features, users_intro_letter)

CURRENT_STATE = {
    "p_info": personal_info,
    "expenses": current_fixed_expenses,
    "plot_features": plot_features,
    # Hier liegen die aktuellen (alten) Milestones
    "milestones": initial_milestones, 
    # Hierhin kommen später die neuen (separat)
    "new_milestones": [] 
}

# --- LOGIC HELPER ---
def generate_checkin_script(milestones):
    if not milestones: return "Hey! No milestones set. How are you?"
    next_mile = milestones[0]
    prompt = f"""
    User's next milestone: "{next_mile['milestone']}" (Due: {next_mile['time']}).
    Task: Write a short, casual message (max 2 sentences) asking if they achieved this.
    """
    try:
        return model.generate_content(prompt).text
    except:
        return f"Checking in: Did you reach {next_mile['milestone']}?"

# --- SHARED CHECK-IN FUNCTION ---
async def execute_checkin_logic(bot, chat_id):
    print(f"--- Triggering Check-in for {chat_id} ---")
    
    # Wir nutzen hier die ALTEN Milestones für den Check-in
    script = generate_checkin_script(CURRENT_STATE['milestones'])
    
    await bot.send_message(chat_id=chat_id, text=f"📞 *CHECK-IN*:\n\n{script}", parse_mode="Markdown")
    
    audio_file = f"checkin_{chat_id}.mp3"
    communicate = edge_tts.Communicate(script, "en-US-AriaNeural")
    await communicate.save(audio_file)
    
    try:
        with open(audio_file, "rb") as f:
            await bot.send_voice(chat_id=chat_id, voice=f)
    except Exception as e:
        print(f"Audio send failed: {e}")
        
    if os.path.exists(audio_file): os.remove(audio_file)

# --- TELEGRAM HANDLERS ---

# 1. Command Wrapper
async def trigger_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await execute_checkin_logic(context.bot, update.effective_chat.id)

# 2. THE AUTO-TIMER TASK (10 Seconds Delay)
async def auto_trigger_task(app):
    print("⏳ Waiting 10 seconds to trigger call...")
    await asyncio.sleep(10) # <--- HIER IST DER DELAY
    
    if TARGET_CHAT_ID == 0:
        print("❌ ERROR: Target_Chat_ID is 0. Send /start to bot to get your ID, then put it in .env")
        return
        
    print("🚀 Time's up! Calling user now...")
    await execute_checkin_logic(app.bot, TARGET_CHAT_ID)

async def post_init(application: Application):
    # Startet den Timer, sobald der Bot bereit ist
    asyncio.create_task(auto_trigger_task(application))

# 3. Response Handler (HIER IST DIE ÄNDERUNG)
async def handle_response(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global CURRENT_STATE
    user_id = update.effective_chat.id
    
    # Audio/Text Input verarbeiten
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

    print(f"--- User Update: {user_text}")

    # Berechnung starten
    result = update_milestones_logic(
        CURRENT_STATE['p_info'], 
        CURRENT_STATE['expenses'], 
        CURRENT_STATE['milestones'], # Input sind die alten
        user_text
    )

    if result:
        # Update Profile & Expenses (das macht Sinn, direkt zu updaten)
        CURRENT_STATE['p_info'] = result.get('updated_p_info', CURRENT_STATE['p_info'])
        CURRENT_STATE['expenses'] = result.get('updated_expenses', CURRENT_STATE['expenses'])
        
        # --- HIER IST DIE ÄNDERUNG ---
        # Die neuen Milestones kommen in eine eigene Variable ('new_milestones')
        # Die alten ('milestones') werden NICHT überschrieben.
        
        new_plan = result.get('new_milestones', [])
        CURRENT_STATE['new_milestones'] = new_plan
        
        # Debug Print
        print(f"Alte Milestones: {len(CURRENT_STATE['milestones'])}")
        print(f"Neue Milestones gespeichert in 'new_milestones': {len(CURRENT_STATE['new_milestones'])}")
        
        reply = result.get('reply_text', "Updated.")
        
        # Text Reply
        await update.message.reply_text(f"🤖 {reply}")
        
        # Roadmap Anzeige (Wir zeigen dem User den NEUEN Plan, auch wenn wir ihn separat speichern)
        roadmap = "\n".join([f"🔹 *{m['time']}*: {m['milestone']}" for m in new_plan])
        
        if roadmap: 
            await update.message.reply_text(f"📅 *Calculated NEW Plan:*\n{roadmap}", parse_mode="Markdown")
        else: 
            await update.message.reply_text("🎉 All milestones done!")

        # Audio Reply
        a_file = f"reply_{user_id}.mp3"
        await edge_tts.Communicate(reply, "en-US-AriaNeural").save(a_file)
        try:
            with open(a_file, "rb") as f: await update.message.reply_voice(voice=f)
        except: pass
        if os.path.exists(a_file): os.remove(a_file)

# --- MAIN ---
if __name__ == "__main__":
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.basicConfig(format='%(asctime)s - %(message)s', level=logging.INFO)
    
    print("Starting Bot...")
    
    # post_init hook registrieren
    app = Application.builder().token(TELEGRAM_TOKEN).post_init(post_init).build()

    app.add_handler(CommandHandler("start", lambda u,c: u.message.reply_text(f"ID: {u.effective_chat.id}")))
    app.add_handler(CommandHandler("trigger", trigger_command))
    app.add_handler(MessageHandler(filters.VOICE | (filters.TEXT & ~filters.COMMAND), handle_response))

    app.run_polling()
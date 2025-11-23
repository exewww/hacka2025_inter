

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
# Ensure ID is an integer
TARGET_CHAT_ID = int(os.getenv("Target_Chat_ID")) if os.getenv("Target_Chat_ID") else None

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
initial_milestones = generate_milestone_plan(personal_info, current_fixed_expenses, plot_features, users_intro_letter)

CURRENT_STATE = {
    "p_info": personal_info,
    "expenses": current_fixed_expenses,
    "plot_features": plot_features,
    "milestones": initial_milestones
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
# Updated to accept custom text and custom voice
async def execute_checkin_logic(bot, chat_id, custom_text=None, voice="en-US-AriaNeural"):
    print(f"--- Triggering Check-in for {chat_id} ---")
    
    # 1. Determine Script (Custom vs Generated)
    if custom_text:
        script = custom_text
    else:
        script = generate_checkin_script(CURRENT_STATE['milestones'])
    
    # 2. Send Text
    await bot.send_message(chat_id=chat_id, text=f"📞 *CHECK-IN*:\n\n{script}", parse_mode="Markdown")
    
    # 3. Send Voice
    # en-US-GuyNeural is a standard, energetic Male voice
    # en-US-ChristopherNeural is a deeper Male voice
    audio_file = f"checkin_{chat_id}.mp3"
    
    try:
        communicate = edge_tts.Communicate(script, voice)
        await communicate.save(audio_file)
        
        with open(audio_file, "rb") as f:
            await bot.send_voice(chat_id=chat_id, voice=f)
    except Exception as e:
        print(f"Audio send failed: {e}")
    finally:
        if os.path.exists(audio_file): os.remove(audio_file)

# --- TELEGRAM HANDLERS ---

# 1. The Command Wrapper (Manual Trigger)
async def trigger_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Uses default female voice and AI generated script
    await execute_checkin_logic(context.bot, update.effective_chat.id)

# 2. The Auto-Timer Wrapper (The First 10s Call)
async def auto_trigger_task(app):
    print("⏳ Waiting 10 seconds to trigger call...")
    await asyncio.sleep(10)
    
    if not TARGET_CHAT_ID:
        print("❌ ERROR: Please update TARGET_CHAT_ID in .env to receive the auto-call!")
        return

    # --- CUSTOM INTRO SCRIPT ---
    intro_script = "Hi! I'm from Interhyp! Wanted to ask how the plans are going! Still on track? Have you finished your university as planned?"
    
    # Use Male Voice (Guy) for energy
    await execute_checkin_logic(
        app.bot, 
        TARGET_CHAT_ID, 
        custom_text=intro_script, 
        voice="en-US-GuyNeural" 
    )

async def post_init(application: Application):
    asyncio.create_task(auto_trigger_task(application))

# 3. Response Handler (With Async Fix)
async def handle_response(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global CURRENT_STATE
    user_id = update.effective_chat.id
    loop = asyncio.get_running_loop() # Get event loop for background task
    
    user_text = ""
    if update.message.voice:
        await context.bot.send_chat_action(chat_id=user_id, action=ChatAction.TYPING)
        f_path = f"user_{user_id}.ogg"
        
        try:
            f = await update.message.voice.get_file()
            await f.download_to_drive(f_path)
            
            # FIX: Run Whisper in background thread to prevent blocking
            print("🎙️ Processing audio...")
            transcription = await loop.run_in_executor(None, lambda: stt_model.transcribe(f_path))
            user_text = transcription["text"]
            
        except Exception as e:
            print(f"Audio Error: {e}")
            await update.message.reply_text("Sorry, audio error.")
            return
        finally:
            if os.path.exists(f_path): os.remove(f_path)
            
    else:
        await context.bot.send_chat_action(chat_id=user_id, action=ChatAction.TYPING)
        user_text = update.message.text

    print(f"--- User Update: {user_text}")

    if not user_text: return

    result = update_milestones_logic(CURRENT_STATE['p_info'], CURRENT_STATE['expenses'], CURRENT_STATE['milestones'], user_text)

    if result:
        CURRENT_STATE['p_info'] = result.get('updated_p_info', CURRENT_STATE['p_info'])
        CURRENT_STATE['expenses'] = result.get('updated_expenses', CURRENT_STATE['expenses'])
        CURRENT_STATE['milestones'] = result.get('new_milestones', CURRENT_STATE['milestones'])
        
        reply = result.get('reply_text', "Updated.")
        
        # Text Reply
        await update.message.reply_text(f"🤖 {reply}")
        
        # Roadmap
        roadmap = "\n".join([f"🔹 *{m['time']}*: {m['milestone']}" for m in CURRENT_STATE['milestones']])
        if roadmap: await update.message.reply_text(f"📅 *Updated Plan:*\n{roadmap}", parse_mode="Markdown")
        else: await update.message.reply_text("🎉 All milestones done!")

        # Audio Reply (Keeping default female for replies, or change to Guy here too)
        a_file = f"reply_{user_id}.mp3"
        # Using Guy here too for consistency? Or change back to "en-US-AriaNeural"
        await edge_tts.Communicate(reply, "en-US-GuyNeural").save(a_file)
        try:
            with open(a_file, "rb") as f: await update.message.reply_voice(voice=f)
        except: pass
        if os.path.exists(a_file): os.remove(a_file)

# --- MAIN ---
if __name__ == "__main__":
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.basicConfig(format='%(asctime)s - %(message)s', level=logging.INFO)
    
    print("Starting Bot...")
    
    app = Application.builder().token(TELEGRAM_TOKEN).post_init(post_init).build()

    app.add_handler(CommandHandler("start", lambda u,c: u.message.reply_text(f"ID: {u.effective_chat.id}")))
    app.add_handler(CommandHandler("trigger", trigger_command))
    app.add_handler(MessageHandler(filters.VOICE | (filters.TEXT & ~filters.COMMAND), handle_response))

    app.run_polling()
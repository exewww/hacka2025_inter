import openai
import os
from dotenv import load_dotenv

load_dotenv()
openai.api_key = os.getenv("OPENAI_API_KEY")
"""
def generate_text(prompt: str):
    response = openai.ChatCompletion.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}]
    )
    return response.choices[0].message.content
"""
def generate_text(prompt: str):
    # Mocked behavior for testing without API calls
    prompt = prompt.strip()
    if prompt.endswith("."):
        # Insert before the last period
        return f"{prompt[:-1]} (requested and changed)."
    else:
        # Append at the end
        return f"{prompt} (requested and changed)"
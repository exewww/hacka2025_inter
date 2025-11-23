import json
import os
import copy
import re
import google.generativeai as genai
from datetime import datetime, timedelta

from dotenv import load_dotenv
load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise ValueError("API Key fehlt! Überprüfe deine .env Datei.")
genai.configure(api_key=api_key)

# --- HELFER FUNKTIONEN ---
SCALING_CONFIG = {
    "Risk Tolerance": {
        "min": 0, "max": 1, "unit": "", 
        "desc_0": "very risk-averse", "desc_1": "very risk-seeking"
    },
    "Expected Annual Return": {
        "min": 0, "max": 20, "unit": "%", 
        "desc_0": "0% return", "desc_1": "20% return"
    },
    "Min. Apartment Size": { # WICHTIG: Mit Punkt!
        "min": 20, "max": 200, "unit": "m²", 
        "desc_0": "very small", "desc_1": "very large"
    },
    "Centrality": {
        "min": 0, "max": 1, "unit": "", 
        "desc_0": "far from center", "desc_1": "prime location"
    },
    "Years to Purchase": {
        "min": 0, "max": 10, "unit": "years", 
        "desc_0": "immediate purchase", "desc_1": "wait 10 years"
    },
    "Initial capital": {
        "min": 0, "max": 500000, "unit": "€", 
        "desc_0": "very low capital", "desc_1": "very high capital"
    },
    "Monthly Savings": {
        "min": 0, "max": 5000, "unit": "€", 
        "desc_0": "low savings", "desc_1": "high savings"
    },
    "Mortgage Interest Rate": {
        "min": 0, "max": 10, "unit": "%", 
        "desc_0": "low interest", "desc_1": "high interest"
    },
    "Mortgage Duration": {
        "min": 1, "max": 30, "unit": "years", 
        "desc_0": "short mortgage", "desc_1": "long mortgage"
    }
}

def get_scaling_text_for_llm():
    """Erzeugt deinen Text-String automatisch aus der Config."""
    text = "SCALING METRICS:\n"
    for key, conf in SCALING_CONFIG.items():
        unit = conf['unit']
        text += (f"{key}: 0 means {conf['desc_0']} ({conf['min']}{unit}), "
                 f"1 means {conf['desc_1']} ({conf['max']}{unit}).\n")
    return text

def normalize_value(key, real_value):
    """Rechnet z.B. 85 m² in 0.36 um."""
    if key not in SCALING_CONFIG or real_value is None: return 0.5
    conf = SCALING_CONFIG[key]
    try:
        val = float(real_value)
        norm = (val - conf["min"]) / (conf["max"] - conf["min"])
        return max(0.0, min(1.0, norm)) # Clamping
    except: return 0.5

def denormalize_value(key, norm_value):
    """Rechnet z.B. 0.5 in 2500 € um."""
    if key not in SCALING_CONFIG: return "N/A"
    conf = SCALING_CONFIG[key]
    real = conf["min"] + (float(norm_value) * (conf["max"] - conf["min"]))
    
    # Formatierung
    if conf["unit"] in ["€", "m²", "years"]:
        return f"{int(real)} {conf['unit']}"
    return f"{real:.1f} {conf['unit']}"

def call_gemini_flash(system_prompt, user_input):
 
    # Konfiguration für JSON-Modus (verhindert Laberei des Modells)
    generation_config = {
        "temperature": 0.2,
        "top_p": 0.95,
        "top_k": 64,
        "max_output_tokens": 8192,
        "response_mime_type": "application/json", # WICHTIG: Erzwingt JSON!
    }

    # Modell initialisieren
    # System Instruction wird hier direkt übergeben
    model = genai.GenerativeModel(
        model_name="gemini-2.0-flash",
        generation_config=generation_config,
        system_instruction=system_prompt
    )

    try:
        # Den Chat starten oder einfach content generieren
        response = model.generate_content(user_input)
        return response.text
    except Exception as e:
        raise Exception(f"Gemini API Error: {str(e)}")
def generate_initial_plot_features(p_info, prop_features, expenses, context):
    
    # 1. String automatisch generieren
    scaling_metrics_text = get_scaling_text_for_llm()
    
    system_prompt = (
        "Du bist ein Finanz-Algorithmus. Analysiere das Profil und schätze die Features (0.0 bis 1.0) ein."
        "Antworte NUR mit einem flachen JSON Objekt: { 'Key': 0.5, ... }."
    )
    
    keys_list = ", ".join(SCALING_CONFIG.keys())
    
    data_input = f"""
    DATEN:
    Personal: {json.dumps(p_info)}
    Property Wish: {json.dumps(prop_features)}
    Expenses: {json.dumps(expenses)}
    Context: {context}
    
    REGELN:
    {scaling_metrics_text}
    
    Aufgabe: Fülle ALLE diese Keys mit Float-Werten (0.0 - 1.0): {keys_list}
    """

    # --- Defaults setzen (Falls API fehlschlägt oder Keys vergisst) ---
    features = {}
    for k in SCALING_CONFIG.keys(): 
        features[k] = 0.5

    # --- CALL LLM (Aktiviert) ---
    try:
        json_response_string = call_gemini_flash(system_prompt, data_input)
        
        # Cleaning (auch wenn JSON Mode an ist, sicher ist sicher)
        cleaned_string = re.sub(r"```json|```", "", json_response_string).strip()
        llm_data = json.loads(cleaned_string)
        
        # Falls das LLM eine Liste zurückgibt (passiert selten, aber möglich)
        if isinstance(llm_data, list) and len(llm_data) > 0:
            llm_data = llm_data[0]
            
        # Werte in das Feature-Dict mergen
        features.update(llm_data)
        
    except Exception as e:
        print(f"LLM Error in Initial Features (nutze Defaults): {e}")

    # --- HYBRID LOGIK (Mathe überschreibt LLM) ---
    
    # Exakte Größe berechnen
    if "Size" in prop_features:
        # normalize_value nutzt jetzt korrekt deine SCALING_CONFIG
        features["MinApartmentSize"] = normalize_value("MinApartmentSize", prop_features["Size"])
        
    # Exakte Laufzeit basierend auf Alter
    if "Age" in p_info:
        years_left = 67 - p_info["Age"]
        # Achte auf das Leerzeichen im Key!
        features["Mortgage Duration"] = normalize_value("Mortgage Duration", years_left)

    # --- FORMATTING für UI ---
    final_output = {}
    for k, v in features.items():
        # Sicherstellen, dass Werte valide Floats sind
        try:
            safe_val = float(v)
        except:
            safe_val = 0.5
            
        # Clamping 0.0 - 1.0 (Zur Sicherheit)
        safe_val = max(0.0, min(1.0, safe_val))

        final_output[k] = {
            "value": safe_val,
            "enabled": True, 
            "previous_value": safe_val
        }
    return final_output

def generate_purchase_suggestions(p_info, expenses, plot_features, info_var):
    
    # --- 1. FINANZ-CHECK (Hard Data) ---
    net_income = p_info.get("Net Monthly Income", 0)
    equity = p_info.get("Total Savings / Equity", 0)
    total_expenses = sum(v for v in expenses.values() if isinstance(v, (int, float)))
    disposable_income = net_income - total_expenses

    # --- 2. VARIABLE STATUS (Denormalisierung) ---
    # Wir holen den echten Wert der Variable, die wir ändern wollen
    current_norm = plot_features.get(info_var, {}).get("value", 0.5)
    current_real = denormalize_value(info_var, current_norm)

    # --- 3. ZIELE IDENTIFIZIEREN (Nur enabled Features) ---
    enabled_targets = []
    locked_vars = []

    for key, data in plot_features.items():
        if key == info_var: continue # Sich selbst überspringen
        
        real_val = denormalize_value(key, data.get('value', 0.5))
        
        if data.get("enabled", True):
            # Das sind die Variablen, die das LLM beeinflussen soll
            enabled_targets.append(f"{key} (Currently: {real_val})")
        else:
            # Diese sind fix, das LLM darf sie nicht als Impact nennen
            locked_vars.append(f"{key} ({real_val})")

    # Fallback, falls alles gelocked ist
    if not enabled_targets:
        enabled_targets = ["Overall Affordability"]

    # --- 4. PROMPT ENGINEERING ---
    system_prompt = (
        "You are a strict financial logic engine. "
        "Task: Analyze the 'Input Variable' and suggest ONE optimization based on the 'Financial Limit'. "
        "Then, predict the outcome on 2-3 of the 'Enabled Targets'. "
        "Constraint: Keep impact bullets extremely short (max 6 words)."
        "Output: Valid JSON only."
    )

    data_input = f"""
    --- FINANCIAL LIMITS ---
    Disposable Monthly Surplus: {disposable_income} € (Max capacity for savings/loans)
    Available Equity: {equity} €
    
    --- SCENARIO ---
    INPUT VARIABLE: "{info_var}"
    CURRENT VALUE: {current_real} (Slider: {current_norm})
    
    --- CONTEXT ---
    SCALING RULES: 
    {get_scaling_text_for_llm()}
    
    ENABLED TARGETS (Choose 2-3 to influence):
    {json.dumps(enabled_targets)}
    
    LOCKED VARIABLES (Do not mention):
    {json.dumps(locked_vars)}
    
    --- OUTPUT FORMAT ---
    {{
        "action_headline": "Concrete suggestion (e.g. Increase Savings to 800€)",
        "impact_bullets": [
            "Short mathematical impact on Target A via Formula (max 1 sentence)",
            "Short mathematical impact on Target B via Formula (max 1 sentence)"
        ]
    }}
    """

    print(f"--- Generating Suggestion for {info_var} ({current_real}) ---")
    
    try:
        # API CALL (Ersetze dies durch deinen echten Call)
        response_text = call_gemini_flash(system_prompt, data_input)
        
        # CLEANING 1: Remove Markdown
        cleaned = re.sub(r"```json|```", "", response_text).strip()
        
        # CLEANING 2: Fix invalid backslashes (The critical fix)
        # This doubles any backslash that isn't part of a valid JSON escape sequence
        cleaned = re.sub(r'\\(?![/u"\\bfnrt])', r'\\\\', cleaned)

        # Parse and return the data object
        data = json.loads(cleaned)
        headline = data.get("action_headline", "")
        bullets = data.get("impact_bullets", [])

        # Create a nice string with newlines and bullet points
        text_body = f"{headline}\n" + "\n".join([f"- {b}" for b in bullets])
        bullets_text = ".  -> ".join(bullets)
        final_string = f"{headline}\n{bullets_text}"
        return final_string

    except Exception as e:
        print(f"Error parsing Gemini response: {e}")
        # Return your fallback list here if needed
        return []

def generate_milestone_plan(p_info, expenses, plot_features, users_intro_letter):
    """
    Erstellt eine Timeline. Nutzt EXAKT die Keys aus plot_features.
    """
    
    # --- 1. HARD FACTS & SETUP ---
    start_date = datetime(2025, 11, 1)
    start_str = start_date.strftime("%m/%Y")
    
    net_income = p_info.get("Net Monthly Income", 0)
    annual_bonus = p_info.get("Bonus/Variable Income (Annual)", 0)

    # --- ÄNDERUNG: Zugriff auf Key MIT LEERZEICHEN ---
    # Wir holen den Wert aus plot_features["Initial capital"]
    init_cap_norm = plot_features.get("Initial capital", {}).get("value", 0.0)
    # Denormalisieren mit demselben Key
    init_cap_str = denormalize_value("Initial capital", init_cap_norm)
    
    try:
        # String "75000 €" -> Float 75000.0
        clean_cap_str = re.sub(r"[^0-9.]", "", str(init_cap_str))
        current_equity = float(clean_cap_str)
        print(current_equity)
    except:
        print('alter')
        current_equity = 0.0
    
    # Sparrate berechnen
    total_expenses = sum(v for v in expenses.values() if isinstance(v, (int, float)))
    monthly_surplus = net_income - total_expenses
    total_monthly_saving_power = monthly_surplus + (annual_bonus / 12.0)

    # --- 2. ENDDATUM BERECHNEN ---
    
    # --- ÄNDERUNG: Zugriff auf Key MIT LEERZEICHEN ---
    ytp_norm = plot_features.get("Years to Purchase", {}).get("value", 0.5)
    ytp_real_str = denormalize_value("Years to Purchase", ytp_norm)
    
    try:
        years_float = float(ytp_real_str.split()[0])
    except:
        years_float = 5.0 # Fallback

    # Enddatum
    end_date = start_date + timedelta(days=int(years_float * 365))
    end_str = end_date.strftime("%m/%Y")

    if years_float < 0.5:
        return [
            {"time": start_str, "milestone": "Planung gestartet", "difficulty": 0.1, "reason": "Tool Start", "capital": int(current_equity)},
            {"time": end_str, "milestone": "Sofortkauf", "difficulty": 0.9, "reason": "Sofortige Umsetzung", "capital": int(current_equity)}
        ]

    # --- 3. LLM PROMPT (Unverändert) ---
    
    system_prompt = (
        "You are a Real Estate Career Planner. "
        "Task: Generate 3-4 INTERMEDIATE milestones between a Start Date and End Date. "
        "Do NOT include the Start or End event itself. "
        "Output: Valid JSON Array only."
    )

    data_input = f"""
    TIMELINE FRAME:
    Start: {start_str} (Do not generate this event)
    End: {end_str} (Do not generate this event)
    
    USER PROFILE:
    {json.dumps(p_info)}
    User Note: "{users_intro_letter}"
    
    INSTRUCTIONS:
    1. Generate 3-4 milestones that happen BETWEEN {start_str} and {end_str}.
    2. Logical progression (e.g. Career step -> Equity saved -> Search started).
    
    JSON FORMAT:
    [
        {{ "time": "MM/YY", "milestone": "Event Name", "difficulty": 0.5, "reason": "Short text" }}
    ]
    """

    print(f"--- Generating Middle Milestones ({start_str} -> {end_str}) ---")

    middle_milestones = []
    try:
        response = call_gemini_flash(system_prompt, data_input)
        cleaned = re.sub(r"```json|```", "", response).strip()
        middle_milestones = json.loads(cleaned)
        if isinstance(middle_milestones, dict): middle_milestones = [middle_milestones]
    except Exception as e:
        print(f"LLM Error: {e}")
        mid_date = start_date + timedelta(days=int(years_float * 365 / 2))
        middle_milestones = [{
            "time": mid_date.strftime("%m/%Y"),
            "milestone": "Finanzcheck",
            "difficulty": 0.3,
            "reason": "Fallback"
        }]

    # --- 4. ZUSAMMENBAU ---
    
    final_plan = [{
        "time": start_str,
        "milestone": "Planung gestartet",
        "difficulty": 0.0,
        "reason": "Start",
        "capital": int(current_equity) # Hier ist jetzt der richtige Wert
    }]
    
    for item in middle_milestones:
        try:
            m_date = datetime.strptime(item["time"], "%m/%Y")
            if start_date < m_date < end_date:
                months_passed = (m_date.year - start_date.year) * 12 + (m_date.month - start_date.month)
                capital = current_equity + (months_passed * total_monthly_saving_power)
                item["capital"] = int(capital)
                final_plan.append(item)
        except:
            continue
            
    total_months = (end_date.year - start_date.year) * 12 + (end_date.month - start_date.month)
    final_capital = current_equity + (total_months * total_monthly_saving_power)
    
    final_plan.append({
        "time": end_str,
        "milestone": "Immobilienkauf & Einzug",
        "difficulty": 0.9,
        "reason": "Ziel erreicht",
        "capital": int(final_capital)
    })

    return final_plan


def recalculate_plot_features_llm(plot_features):
    """
    Nutzt das LLM, um 'reaktive' Features anzupassen.
    Jetzt mit Kontext-Wissen über echte Geldwerte durch SCALING_CONFIG.
    """
    
    # Deep Copy, um Original nicht zu beschädigen
    updated_features = copy.deepcopy(plot_features)
    
    # 1. Kategorisierung & Denormalisierung
    # Wir erstellen Strings für das LLM, die den echten Wert UND den Slider-Wert zeigen.
    drivers_info = {}   
    reactives_info = {} 
    fixed_info = {}     
    
    for key, data in plot_features.items():
        try:
            val = float(data.get('value', 0.5))
            prev = float(data.get('previous_value', val))
            enabled = data.get('enabled', True)
            
            # Echten Wert holen (z.B. "2500 €")
            real_val_str = denormalize_value(key, val)
            # Info-String für das LLM: "2500 € (Scale: 0.5)"
            info_str = f"{real_val_str} (Scale: {val:.2f})"
            
            if not enabled:
                fixed_info[key] = info_str
            elif val != prev:
                drivers_info[key] = info_str
            else:
                # Wir geben dem LLM den aktuellen Stand, damit es weiß, wo wir starten
                reactives_info[key] = info_str
                
        except Exception:
            continue

    # Abbruch, wenn User nichts geändert hat
    if not drivers_info:
        return plot_features

    # 2. Scaling Regeln holen (Single Source of Truth)
    scaling_metrics_text = get_scaling_text_for_llm()

    # 3. System Prompt
    system_prompt = (
        "You are a Real Estate Balancing Engine. "
        "User changed some 'Driver' inputs. Adjust the 'Reactive' inputs to maintain economic reality. "
        "Output ONLY a JSON object with new normalized values (0.0-1.0) for Reactives."
    )

    # 4. Data Input
    data_input = f"""
    CONTEXT:
    Real estate scenario. We need to balance Affordability vs. Wishes.
    
    SCALING RULES (How 0.0-1.0 maps to real world):
    {scaling_metrics_text}
    
    CURRENT STATE:
    1. DRIVERS (User JUST changed these - CAUSE): 
    {json.dumps(drivers_info, indent=2)}
    
    2. FIXED (Locked - Do NOT change): 
    {json.dumps(fixed_info, indent=2)}
    
    3. REACTIVES (Your Target - Adjust these - EFFECT): 
    {json.dumps(reactives_info, indent=2)}
    
    LOGIC GUIDE:
    - Buying Power = (Initialcapital + (MonthlySavings * YearsToPurchase)) vs Mortgage.
    - If User INCREASES Money (Savings/capital/Duration) -> Can INCREASE Expenses (Size/Centrality) OR DECREASE Risk.
    - If User DECREASES Money -> MUST DECREASE Expenses (Size/Centrality) OR INCREASE Risk/Return Targets.
    - Be proportional. Small driver change = Small reactive change.
    
    TASK:
    Calculate NEW normalized float values (0.0 to 1.0) for the keys in 'REACTIVES'.
    Example Output: {{ "MinApartmentSize": 0.55, "RiskTolerance": 0.4 }}
    """

    print(f"--- Recalculating Reactives: {list(reactives_info.keys())} based on Drivers: {list(drivers_info.keys())} ---")

    try:
        # API Call
        json_response_string = call_gemini_flash(system_prompt, data_input)
        
        # Parsing
        cleaned_string = re.sub(r"```json|```", "", json_response_string).strip()
        new_values = json.loads(cleaned_string)
        
        # 5. Update der Features
        for key, new_val in new_values.items():
            # Wir dürfen nur Keys updaten, die auch Reactives waren (Sicherheitscheck)
            if key in reactives_info and key in updated_features:
                
                try:
                    float_val = float(new_val)
                    # Clamping (Wichtig!)
                    clean_val = max(0.0, min(1.0, float_val))
                    
                    # Update Logic:
                    # value -> neu
                    # previous_value -> bleibt auf dem Wert VOR der LLM Änderung? 
                    # Oder soll es gleichziehen?
                    # Deine Anforderung war: value != prev definiert Drivers.
                    # Damit das LLM Ergebnis im nächsten Tick NICHT als Driver erkannt wird,
                    # müsste man eigentlich previous_value = value setzen.
                    # ABER: Wenn du im UI Ghosting ("vorher war es hier") anzeigen willst,
                    # musst du es so lassen wie in deinem Code.
                    
                    # Ich behalte deine Logik bei (Previous merkt sich den Stand VOR der Neuberechnung)
                    updated_features[key]['previous_value'] = updated_features[key]['value'] 
                    updated_features[key]['value'] = clean_val
                    
                except ValueError:
                    continue
                
        return updated_features

    except Exception as e:
        print(f"Error during recalculation: {e}")
        # Im Fehlerfall das Original zurückgeben, kein Crash
        return plot_features
def update_milestones_logic(p_info, expenses, old_miles, user_msg):
    """
    Aktualisiert den Plan basierend auf User-Input (Chat).
    Nimmt das Startkapital aus dem existierenden Plan (old_miles), 
    da p_info['Total Savings'] nicht mehr existiert.
    """
    
    # --- 1. SETUP: ALTE GRENZEN SICHERN ---
    try:
        start_milestone = old_miles[0]
        end_milestone = old_miles[-1]
        
        start_str = start_milestone.get("time", "11/2025")
        end_str = end_milestone.get("time", "11/2030")
        
        # WICHTIG: Wir holen das Startkapital aus dem alten Plan (Slider-Wert)
        # da es in p_info nicht mehr existiert!
        initial_equity = start_milestone.get("Capital", 0)
        
        start_date = datetime.strptime(start_str, "%m/%Y")
        end_date = datetime.strptime(end_str, "%m/%Y")
        
    except (IndexError, ValueError, KeyError):
        return {
            "reply_text": "Error reading old plan. Resetting.",
            "updated_p_info": p_info,
            "updated_expenses": expenses,
            "new_milestones": old_miles
        }

    # --- 2. LLM: INTELLIGENTE ANALYSE ---
    
    system_prompt = (
        "You are a Financial Planner updating a plan based on user feedback. "
        "TASK: 1. Update p_info/expenses if user mentions numbers (e.g. 'Salary increased by 500'). "
        "2. Generate 3-4 NEW intermediate milestones that fit the new context between Start and End. "
        "Output: JSON Only."
    )

    data_input = f"""
    OLD PLAN FRAME:
    Start: {start_str}
    End: {end_str}
    
    CURRENT DATA:
    Profile: {json.dumps(p_info)}
    Expenses: {json.dumps(expenses)}
    
    USER UPDATE MESSAGE: "{user_msg}"
    
    INSTRUCTIONS:
    1. Check if User Message changes Income or Expenses. Update the dicts accordingly.
    2. Create new intermediate milestones between {start_str} and {end_str}.
    3. Do NOT include Start or End events in 'new_intermediate_milestones'.
    4. 'reply_text': Short confirmation.
    
    OUTPUT JSON FORMAT:
    {{
        "reply_text": "...",
        "updated_p_info": {{ ... }},
        "updated_expenses": {{ ... }},
        "new_intermediate_milestones": [
            {{ "time": "MM/YY", "milestone": "...", "difficulty": 0.5, "reason": "..." }}
        ]
    }}
    """

    try:
        response_text = call_gemini_flash(system_prompt, data_input)
        cleaned = re.sub(r"```json|```", "", response_text).strip()
        llm_data = json.loads(cleaned)
        
        # Mergen statt Überschreiben (Sicher ist sicher)
        new_p_info = p_info.copy()
        if "updated_p_info" in llm_data:
            new_p_info.update(llm_data["updated_p_info"])
            
        new_expenses = expenses.copy()
        if "updated_expenses" in llm_data:
            new_expenses.update(llm_data["updated_expenses"])
            
        new_intermediates = llm_data.get("new_intermediate_milestones", [])
        reply_text = llm_data.get("reply_text", "Plan updated.")

    except Exception as e:
        print(f"Update Error: {e}")
        return None

    # --- 3. PYTHON: NEUBERECHNUNG ---
    
    # Neue Sparrate berechnen
    net_inc = new_p_info.get("Net Monthly Income", 0)
    bonus = new_p_info.get("Bonus/Variable Income (Annual)", 0)
    total_exp = sum(v for v in new_expenses.values() if isinstance(v, (int, float)))
    
    monthly_saving_power = (net_inc - total_exp) + (bonus / 12.0)

    # --- 4. ZUSAMMENBAU ---
    
    final_plan = []
    
    # A) Start (Bleibt fix auf dem Wert, der vom Slider kam)
    final_plan.append({
        "time": start_str,
        "milestone": start_milestone.get("milestone"),
        "difficulty": start_milestone.get("difficulty"),
        "reason": start_milestone.get("reason"),
        "Capital": int(initial_equity) # Hier nehmen wir den gesicherten Wert
    })

    # B) Mitte
    for item in new_intermediates:
        try:
            m_date = datetime.strptime(item["time"], "%m/%Y")
            if start_date < m_date < end_date:
                months_passed = (m_date.year - start_date.year) * 12 + (m_date.month - start_date.month)
                cap = initial_equity + (months_passed * monthly_saving_power)
                item["Capital"] = int(cap)
                final_plan.append(item)
        except:
            continue

    # C) Ende
    total_months = (end_date.year - start_date.year) * 12 + (end_date.month - start_date.month)
    final_capital = initial_equity + (total_months * monthly_saving_power)
    
    final_plan.append({
        "time": end_str,
        "milestone": end_milestone.get("milestone"),
        "difficulty": end_milestone.get("difficulty"),
        "reason": end_milestone.get("reason"),
        "Capital": int(final_capital)
    })
    
    return {
        "reply_text": reply_text,
        "updated_p_info": new_p_info,
        "updated_expenses": new_expenses,
        "new_milestones": final_plan
    }

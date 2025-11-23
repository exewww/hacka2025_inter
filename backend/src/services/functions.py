import json
import os
import copy
import google.generativeai as genai
from dotenv import load_dotenv
load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise ValueError("API Key fehlt! Überprüfe deine .env Datei.")
genai.configure(api_key=api_key)


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
    
    # 1. Prompt fix: Explicitly ask for a single Object and fix the duplicate "value" key
    system_prompt = (
        "Du bist ein Finanz-Algorithmus für Immobilienkredite. "
        "Deine Aufgabe: Initialisiere die Slider-Werte (Features) zwischen 0.0 und 1.0 basierend auf dem Nutzerprofil. "
        "\n"
        "REGELN FÜR DIE WERTE (0.0 - 1.0): "
        "- 0.0 bedeutet: Sehr niedrig / Sehr klein / Sehr wenig / Sehr sicherheitsorientiert "
        "- 1.0 bedeutet: Sehr hoch / Sehr groß / Sehr viel / Sehr risikofreudig "
        "- Skalierung 'Wohnungsgröße': 0.0 = 20m², 1.0 = 200m² (ca. linear interpolieren). "
        "- Skalierung 'Kapital': 0.0 = 0€, 1.0 = 500.000€+. "
        "- 'Years To Purchase' (Scale: 0.0 = Now, 1.0 = 15 Years)."
        "- Skalierung 'Risk Tolerance': Jung & Single = höher, Alt & Familie = niedriger. "
        "- 'ExpectedAnnualReturn' ist immer 0.05 (also 5%), aber hier als Slider-Wert skalieren (0.5 = marktüblich). "
        "\n"
        "FORMAT REGELN: "
        "1. Antworte NUR mit einem validen JSON Objekt { ... }. KEINE Liste [ ... ]. "
        "2. Nutze exakt die angeforderten CamelCase Keys. "
        "3. 'enabled' muss für alle True sein, außer für 'ExpectedAnnualReturn'."
    )

    # Corrected schema hint (Removed duplicate 'value', added 'previous_value')
    json_structure_hint = """
    {
        "RiskTolerance": {"value": float, "enabled": true, "previous_value": float},
        "ExpectedAnnualReturn": {"value": float, "enabled": true, "previous_value": float},
        "MinApartmentSize": {"value": float, "enabled": true, "previous_value": float},
        "Centrality": {"value": float, "enabled": true, "previous_value": float},
        "YearsToPurchase": {"value": float, "enabled": true, "previous_value": float},
        "InitialCapital": {"value": float, "enabled": true, "previous_value": float},
        "MonthlySavings": {"value": float, "enabled": true, "previous_value": float},
        "MortgageInterestRate": {"value": float, "enabled": true, "previous_value": float},
        "MortgageDuration": {"value": float, "enabled": true, "previous_value": float}
    }
    """

    data_input = f"""
    ANALYSIERE DIESE DATEN:
    Personal Info: {json.dumps(p_info)}
    Property Wish: {json.dumps(prop_features)}
    Expenses: {json.dumps(expenses)}
    Additional Context: {context}
    
    Fülle dieses JSON Schema aus (Werte 0.0 bis 1.0). Setze 'previous_value' gleich 'value':
    {json_structure_hint}
    """

    print("--- Rufe Gemini Flash auf... ---")
    json_response_string = call_gemini_flash(system_prompt, data_input)
    
    try:
        # Cleaning
        cleaned_string = json_response_string.replace("```json", "").replace("```", "").strip()
        data = json.loads(cleaned_string)
        
        # --- FIX: LIST VS DICT CHECK ---
        if isinstance(data, list):
            if len(data) > 0:
                data = data[0] # Grab the first item (the dictionary)
            else:
                raise ValueError("Received empty list from LLM")
        
        # --- FIX: Ensure previous_value exists ---
        # If LLM forgets previous_value, we set it manually to avoid crashes later
        for key, val in data.items():
            if isinstance(val, dict) and "previous_value" not in val:
                val["previous_value"] = val.get("value", 0.5)

        return data

    except Exception as e:
        print(f"Fehler beim Parsen: {str(e)}")
        # Fallback Default Structure
        return {
            "RiskTolerance": { "value": 0.3, "enabled": True, "previous_value": 0.3 },
            "ExpectedAnnualReturn": { "value": 0.5, "enabled": False, "previous_value": 0.5 },
            "MinApartmentSize": { "value": 0.5, "enabled": True, "previous_value": 0.5 },
            "Centrality": { "value": 0.6, "enabled": True, "previous_value": 0.6 },
            "YearsToPurchase": { "value": 0.4, "enabled": True, "previous_value": 0.4 },
            "InitialCapital": { "value": 0.2, "enabled": True, "previous_value": 0.2 },
            "MonthlySavings": { "value": 0.3, "enabled": True, "previous_value": 0.3 },
            "MortgageInterestRate": { "value": 0.5, "enabled": True, "previous_value": 0.5 },
            "MortgageDuration": { "value": 0.7, "enabled": True, "previous_value": 0.7 }
        }

def generate_purchase_suggestions(p_info, expenses, plot_features, info_var):
    """
    Erstellt EINEN realistischen Vorschlag für 'info_var' basierend auf dem User-Profil (Alter, Job)
    und beschreibt die kombinierten Auswirkungen auf die anderen enabled Features.
    """
    
    # 1. Features sortieren
    # 'targets': Die Variablen, die sich verbessern könnten (Output)
    # 'locked': Die Variablen, die fest sind (Constraints)
    targets = []
    locked = []
    
    for key, data in plot_features.items():
        if key == info_var:
            continue # Das ist der Input-Hebel
            
        val_str = f"{data['value']}" # 0-1 Wert
        if data["enabled"]:
            targets.append(f"{key} (Current Level: {val_str})")
        else:
            locked.append(f"{key} (Fixed Level: {val_str})")

    current_focus_val = plot_features.get(info_var, {}).get("value", "N/A")

    # 2. System Prompt
    system_prompt = (
        "You are a highly intelligent financial advisor. "
        "Your goal is to generate ONE realistic, cohesive optimization scenario. "
        "You must verify the user's background (Age, Job, Financials) to ensure the advice is actually doable. "
        "Output Requirement: Return a JSON object with a single key 'suggestion_text'."
    )

    # 3. Data Input & Strikte Anweisungen
    data_input = f"""
    USER PROFILE:
    Age: {p_info.get('Age')}
    Job: {p_info.get('Job Status')}
    Expenses: {expenses}

    FOCUS VARIABLE (The Lever): "{info_var}" (Current Normalized Level 0-1: {current_focus_val})
    
    AVAILABLE TARGETS (These can improve): {json.dumps(targets)}
    LOCKED CONSTRAINTS (Cannot change): {json.dumps(locked)}

    TASK:
    Create ONE realistic proposal to change "{info_var}".
    1. Analyze the User Profile. (e.g., if Student/Unemployed -> suggest small/no monetary increases. If High Income -> suggest higher savings/capital).
    2. Define a realistic change for "{info_var}" (e.g. "increase by 10%" or "decrease by 15%").
    3. Explain the COMBINED effect this change would have on the 'AVAILABLE TARGETS'.
    
    OUTPUT FORMAT (String inside JSON):
    "Given your profile as [Job/Age context], if you [Action on {info_var}]:
    - You could reduce [Target 1] by [Amount]
    - This would allows you to [Target 2 Action]"
    
    Use bullet points. Keep it concise. Do not list separate unrelated 'if' statements. 
    Connect the logic (e.g., "Higher capital means less loan needed, which reduces duration AND savings rate").

    EXAMPLES OF REQUIRED BREVITY:
    BAD: "Given that you are a student, if you increase savings by 10%, you could reduce duration."
    GOOD: "Increase Savings by 10% (Part-time job):"
    GOOD: "- Cuts Mortgage Duration by 2 years."
    GOOD: "- Offsets low Initial Capital."
    
    Do NOT use words like "would allow", "roughly", "estimated", "given your". Be direct.
    """

    print(f"--- Calculating Realistic Scenario for '{info_var}' ---")
    
    try:
        # API Call
        json_response_string = call_gemini_flash(system_prompt, data_input)
        
        # Cleaning & Parsing
        clean_str = json_response_string.replace("```json", "").replace("```", "").strip()
        data = json.loads(clean_str)
        
        return data.get("suggestion_text", "No feasible suggestion found.")

    except Exception as e:
        print(f"Error in suggestion generation: {e}")
        return f"Could not generate specific advice for {info_var}."

def generate_milestone_plan(p_info, expenses, plot_features, users_intro_letter):
    """
    Erstellt basierend auf der Kaufdauer (YearsToPurchase) und dem User-Profil
    eine Liste von Meilensteinen (JSON).
    """

    # 1. Wert für "YearsToPurchase" extrahieren (CamelCase oder mit Leerzeichen)
    # Wir suchen erst nach CamelCase, dann nach dem alten Key.
    ytp_data = plot_features.get("YearsToPurchase") or plot_features.get("Years to Purchase")
    
    if not ytp_data:
        # Fallback, falls der Key fehlt
        slider_value = 0.5 
    else:
        slider_value = ytp_data["value"]

    # Aktuelles Datum für die Zeitberechnung
    current_date_str = '11/2025'  # Für Tests fest kodiert; in Produktion aktuelles Datum verwenden

    # 2. System Prompt
    system_prompt = (
        "You are a Life & Financial Planner. "
        "Create a timeline of milestones leading up to a property purchase. "
        "Output MUST be a valid JSON Array."
    )

    # 3. Data Input & Rules
    data_input = f"""
    CURRENT DATE: {current_date_str}
    
    USER PROFILE:
    Personal: {json.dumps(p_info)}
    Expenses: {expenses}
    User's Letter (Future Plans): "{users_intro_letter}"
    
    TIME HORIZON:
    The user set the 'Years To Purchase' slider to: {slider_value} (Scale: 0.0 = Now, 1.0 = 15 Years).
    Calculated Duration: approx {round(slider_value * 15, 1)} years.
    
    TASK:
    Generate a JSON List of 2-5 Milestones covering the period from NOW until the calculated end date.
    Every milestone has to be unique and relevant to the user's profile and property goal.
    
    RULES FOR MILESTONES:
    1. Infer logical life events based on Age, Job, Children Wish, and the Intro Letter.
    2. Include financial checkpoints (e.g., "Saved 20% Equity").
    3. 'difficulty' must be a float between 0.0 (Easy) and 1.0 (Very Hard).
       - High difficulty examples: Job Search, Having a Child, Probezeit (Probation), Moving.
       - Low difficulty examples: Continuing Saving, Stable Job Phase Values for example 0.2-0.4.
       - Extrema possible, if the situation is very good or very bad. Example Very good job, small house in 15 Years -> difficulty 0.0.
    4. Each milestone needs a short reason explaining its difficulty.
    5. Each reason should be max 3-4 Words long
    6. For each Milestone, predict the capital that the person will have at that point, based on his profile

    REQUIRED JSON FORMAT:
    [
        {{
            "time": "MM/YY", 
            "milestone": "Title of the event",
            "difficulty": 0.8,
            "reason": "Explanation why this is happening or why it is hard/easy",
            "capital" :20000
        }},
        ...
    ]
    """

    print(f"--- Generiere Meilensteine (Horizon: {round(slider_value * 15, 1)} Jahre) ---")

    try:
        json_response_string = call_gemini_flash(system_prompt, data_input)
        
        # Cleaning
        cleaned_string = json_response_string.replace("```json", "").replace("```", "").strip()
        return json.loads(cleaned_string)

    except Exception as e:
        print(f"Error creating milestones: {e}")
        # Fallback JSON, damit das Frontend nicht crasht
        return [
            {
                "time": current_date_str,
                "milestone": "Planung gestartet",
                "difficulty": 0.1,
                "reason": "User hat das Tool gestartet",
                "capital" :20000
            }
        ]

def recalculate_plot_features_llm(plot_features):
    """
    Nutzt das LLM, um 'reaktive' Features anzupassen, basierend auf Änderungen 
    durch den User (Drivers).
    
    Logik:
    1. Fixed (enabled=False) -> Werden ignoriert.
    2. Drivers (enabled=True & value != prev) -> Die Ursache (User Input).
    3. Reactives (enabled=True & value == prev) -> Die Wirkung (vom LLM berechnet).
    """
    
    # Deep Copy, um das Original nicht zu verändern, bevor wir fertig sind
    updated_features = copy.deepcopy(plot_features)
    
    # 1. Kategorisierung der Features
    drivers = {}   # Was hat sich geändert? (Ursache)
    reactives = {} # Was darf angepasst werden? (Wirkung)
    fixed = {}     # Was ist in Stein gemeißelt? (Konstante)
    
    for key, data in plot_features.items():
        # Sicherheitscheck für float konvertierung
        val = float(data['value'])
        prev = float(data.get('previous_value', val))
        print("prev" , prev)
        print("val" ,val)

        
        if not data['enabled']:
            fixed[key] = val
        elif val != prev:
            drivers[key] = val
        else:
            reactives[key] = val

    # Wenn der User nichts geändert hat, müssen wir nichts berechnen.
    if not drivers:
        print("Keine Änderungen durch User erkannt.")
        return plot_features

    # 2. System Prompt
    system_prompt = (
        "You are a Real Estate Investment Balancing Algorithm. "
        "Your task is to re-balance a system of normalized variables (0.0 to 1.0) based on user inputs. "
        "Output Format: Return ONLY a valid JSON object containing the new values for the 'Reactive' variables."
    )

    # 3. Data Input & Logic Rules
    data_input = f"""
    CONTEXT:
    The system represents a property purchase plan. All values are 0.0 (low/easy/small) to 1.0 (high/hard/large).
    
    INPUT GROUPS:
    1. DRIVERS (Changed by User - DO NOT CHANGE THESE): {json.dumps(drivers)}
    2. FIXED (Locked - DO NOT CHANGE THESE): {json.dumps(fixed)}
    3. REACTIVES (Your Target - Adjust these to restore balance): {json.dumps(reactives)}
    
    LOGIC RULES:
    - Supply Factors (Help buying): Initial Capital, Monthly Savings, Mortgage Duration, Years to Purchase, Risk Tolerance.
    - Demand Factors (Cost money): Apartment Size, Centrality, Mortgage Interest Rate.
    
    - If 'Drivers' increase Buying Power (Supply), you can increase Demand Factors (better house) OR decrease other Supply Factors (save less).
    - If 'Drivers' increase Cost (Demand), you MUST increase Supply Factors (save more, longer duration) OR decrease other Demand Factors.
    - Be realistic. Changes should be proportional.
    
    TASK:
    Calculate new values for the REACTIVES dictionary.
    Return JSON format: {{Key: NewValue, Key2: NewValue}}
    Only include keys from the REACTIVES list.
    Values must remain between 0.0 and 1.0.
    """

    print(f"--- Recalculating via LLM based on changes in: {list(drivers.keys())} ---")

    try:
        json_response_string = call_gemini_flash(system_prompt, data_input)
        
        # Parsing
        cleaned_string = json_response_string.replace("```json", "").replace("```", "").strip()
        new_values = json.loads(cleaned_string)
        
        # 4. Update der Features
        for key, new_val in new_values.items():
            if key in updated_features:
                # Alte Value sichern in previous_value (wie angefordert)
                old_val = updated_features[key]['value']
                
                updated_features[key]['previous_value'] = old_val
                updated_features[key]['value'] = float(new_val)
        print("updated_features", updated_features)    
        return updated_features

    except Exception as e:
        print(f"Error during recalculation: {e}")
        return plot_features


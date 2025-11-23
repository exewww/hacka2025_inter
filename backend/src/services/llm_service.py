import random
import copy
def generate_text(features_input):
    features = copy.deepcopy(features_input)
    
    # Aggressivität: Kleine Ursache -> Große Wirkung
    AGGRESSIVENESS = 4.0 
    
    # --- TEAM DEFINITIONEN ---
    
    # SUPPLY TEAM: Alles was hilft, das Ziel zu finanzieren.
    # Ein hoher Wert hier ist "gut" für die Kaufkraft.
    supply_team = [
        "Initial Capital",
        "Monthly Savings",
        "Mortgage Duration",    # Längere Laufzeit = niedrigere Rate = leichter finanzierbar
        "Years to Purchase",    # Länger warten = mehr gespart = leichter
        "Risk Tolerance",       # Mehr Risiko = potenziell mehr Rendite = mehr Geld
        "Expected Annual Return"
    ]
    
    # DEMAND TEAM: Alles was Kosten verursacht oder den Kauf erschwert.
    # Ein hoher Wert hier ist "teuer" oder "belastend".
    demand_team = [
        "Min. Apartment Size",
        "Centrality",
        "Mortgage Interest Rate" # Hoher Zins = Hohe Kosten = Belastung
    ]

    # --- BERECHNUNG ---

    # Durchschnitt Supply berechnen
    sum_supply = 0
    count_supply = 0
    for key in supply_team:
        if key in features:
            sum_supply += features[key]["value"]
            count_supply += 1
            
    # Durchschnitt Demand berechnen
    sum_demand = 0
    count_demand = 0
    for key in demand_team:
        if key in features:
            sum_demand += features[key]["value"]
            count_demand += 1
            
    avg_supply = sum_supply / count_supply if count_supply > 0 else 0
    avg_demand = sum_demand / count_demand if count_demand > 0 else 0

    # Gap: Wenn Demand > Supply, ist Gap positiv -> Wir brauchen mehr Geld oder weniger Ansprüche
    raw_gap = avg_demand - avg_supply
    
    # Boost: Wir verstärken den Effekt, damit man ihn visuell sofort sieht
    adjustment_force = raw_gap * AGGRESSIVENESS

    # Zittern bei fast perfekten Werten verhindern
    if abs(adjustment_force) < 0.01:
        return features

    # --- ANPASSUNG ---
    
    flexible_vars = [k for k, v in features.items() if v["enabled"]]
    
    for key in flexible_vars:
        current_val = features[key]["value"]
        new_val = current_val
        
        # Logik: 
        # Wenn es "zu teuer" ist (gap > 0):
        # -> Supply (Geld) muss steigen (+)
        # -> Demand (Ansprüche) muss sinken (-)
        
        if key in supply_team:
            new_val = current_val + adjustment_force
        elif key in demand_team:
            new_val = current_val - adjustment_force
            
        # Hard Clipping 0-1
        if new_val > 1.0: new_val = 1.0
        if new_val < 0.0: new_val = 0.0
        
        features[key]["value"] = round(new_val, 4)

    return featuresl
def generate_suggestion_text(clicked_feature, features):
    """
    Generates a text suggestion including value and lock/unlock status.
    """
    feature_list = ", ".join(
        f"{k}: value={v['value']}, enabled={'yes' if v.get('enabled', False) else 'no'}"
        for k, v in features.items()
    )
    suggestion = f"The feature changed is '{clicked_feature}'. All features with values and lock status are: {feature_list}."
    return suggestion
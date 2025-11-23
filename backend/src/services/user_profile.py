personal_info = {
    "Age": 21,
    "Marital Status": "single",
    "Job Status": "Student",
    "Profession": "Student",
    "Industry": "Tech/IT",
    "Sex": "female",
    "Goal": "primary residence",
    "Children Wish": 2,
    "Net Monthly Income": 4250.0,         # Bleibt wichtig für "Affordability Check" (Kreditwürdigkeit)
    "Bonus/Variable Income (Annual)": 500.0,
    # GELÖSCHT: "Total Savings / Equity": 75000.0
    "Credit Score Rating": "very good",
    "Existing Real Estate": False
}

dream_property_features = {
    "Location": "Berlin",
    "District Preference": "Prenzlauer Berg, Mitte, or Kreuzberg",
    "Property Type": "apartment",
    # GELÖSCHT: "Size": 85
    "Rooms": 3.5,
    "Public Transport Access": "good",
    "School District Quality": "medium",
    "Amenities": "balcony, elevator",
    "Max Purchase Price": 50000.0,
    "Condition": "modernized",
    "Energy Efficiency Class": "F",
    "Construction Year": "post-1900"
}

current_fixed_expenses = {
"Monthly Rent/Mortgage": 1200.0,      # Fällt beim Kauf weg (wird durch Rate ersetzt)
"Utilities": 250.0,                   # Heizung, Strom, Wasser
"Insurance": 120.0,                   # Haftpflicht, BU, Hausrat
"Loan Payments": 300.0,               # Laufender Kredit (z.B. Auto oder Studienkredit)
"Subscriptions": 45.0,                # Netflix, Spotify, Gym
# FINANZ-ADD-ONS (Wichtig für Haushaltsrechnung):
"Groceries & Household": 450.0,       # Essen, Drogerie
"Internet & Phone": 60.0,
"Public Transport / Mobility": 80.0,  # BVG Ticket oder Tanken
"Leisure & Vacation Savings": 300.0   # Puffer für Urlaub/Freizeit
}

# Enabled true means the user can changed. it is not fixed.
# Normalized to 0-1
plot_features = {
    "Risk Tolerance": {
        "value": 0.9,
        "previous_value": 0.9,
        "enabled": True
    },
    "Expected Annual Return": {
        "value": 0.1,
        "previous_value": 0.1,
        "enabled": False
    },
    "Min. Apartment Size": {  # ehemals Wohnungsgröße
        "value": 0.2,
        "previous_value": 0.2,
        "enabled": True
    },
    "Centrality": {  # ehemals Wie Zentral
        "value": 0.8,
        "previous_value": 0.8,
        "enabled": True
    },
    "Years to Purchase": {  # ehemals Wie viele Jahre warten
        "value": 0.9,
        "previous_value": 0.9,
        "enabled": True
    },
    "Initial Capital": {  # ehemals Anfangskapital
        "value": 0.3,
        "previous_value": 0.9,
        "enabled": True
    },
    "Monthly Savings": {  # ehemals Monatliche Ersparnisse
        "value": 0.5,
        "previous_value": 0.5,
        "enabled": True
    },
    "Mortgage Interest Rate": {  # ehemals Zinssatz
        "value": 0.4,
        "previous_value": 0.4,
        "enabled": True
    },
    "Mortgage Duration": {  # ehemals Laufzeit Hypothek
        "value": 0.9,
        "previous_value": 0.9,
        "enabled": True
    }
}
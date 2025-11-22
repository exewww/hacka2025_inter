import random

def generate_text(features):
    """
    Randomly adjust each feature value ±0.3.
    Locked features (enabled=False) are not changed.
    """
    new_features = {}
    for key, val in features.items():
        enabled = val.get("enabled", True)
        value = val.get("value", 0)

        if enabled:
            delta = random.uniform(-0.3, 0.3)
            value = max(0, min(1, value + delta))

        new_features[key] = {"value": value, "enabled": enabled}

    return new_features

import os

import requests


def list_models():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is required.")

    url = "https://generativelanguage.googleapis.com/v1beta/models"

    try:
        response = requests.get(url, params={"key": api_key}, timeout=30)
        response.raise_for_status()
        data = response.json()
        if "models" in data:
            for model in data["models"]:
                print(model["name"])
        else:
            print("No models found in response:", data)
    except requests.RequestException as error:
        print("Error:", error)
        raise


if __name__ == "__main__":
    list_models()

import os
import google.generativeai as genai
from dotenv import load_dotenv

# 1. Load Environment Variables
load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    print("❌ Error: GEMINI_API_KEY is missing from .env file.")
    exit(1)

# 2. Configure the Standard SDK
genai.configure(api_key=api_key)

print(f"\n{'Model Name':<40} | {'Capabilities'}")
print("-" * 70)

try:
    # 3. List Models
    for m in genai.list_models():
        # Filter: Only show models that can generate text (Chat/Content)
        # We skip embedding models to keep the list clean
        if 'generateContent' in m.supported_generation_methods:
            
            # Clean up the name (remove 'models/' prefix for display)
            clean_name = m.name.replace("models/", "")
            
            print(f"{clean_name:<40} | {m.supported_generation_methods}")

    print("-" * 70)
    print("✅ Done. Use these names in your app configuration.\n")

except Exception as e:
    print(f"❌ Error fetching models: {e}")
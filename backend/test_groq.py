import os
from groq import Groq

def test_groq_connection():
    # 1. Check for API Key
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        print("❌ Error: GROQ_API_KEY environment variable is not set.")
        print("   Please run: set GROQ_API_KEY=your_key_here")
        return

    try:
        # 2. Initialize Client
        print("📡 Connecting to Groq Cloud...")
        client = Groq(api_key=api_key)

        # 3. Send Test Request (using Llama 3 for speed)
        completion = client.chat.completions.create(
            model="llama3-8b-8192",
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful assistant."
                },
                {
                    "role": "user",
                    "content": "Hello! Are you working? Answer in 5 words or less."
                }
            ],
            temperature=0.5,
            max_tokens=50,
        )

        # 4. Print Result
        response_text = completion.choices[0].message.content
        print("\n✅ Groq API Success!")
        print("🤖 Model Response:", response_text)

    except Exception as e:
        print(f"\n❌ Connection Failed: {str(e)}")

if __name__ == "__main__":
    test_groq_connection()
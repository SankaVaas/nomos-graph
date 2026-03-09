import httpx
import os
from datetime import datetime

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "qwen/qwen3-235b-a22b-2507"

async def call_llm(system_prompt: str, user_message: str) -> str:
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            OPENROUTER_URL,
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost:8000",  # required by OpenRouter
                "X-Title": "Multi-Agent Orchestrator"     # required by OpenRouter
            },
            json={
                "model": MODEL,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message}
                ]
            }
        )
        data = response.json()
        print("RAW OPENROUTER RESPONSE:", data)
        
        if "choices" not in data:
            raise Exception(f"OpenRouter error: {data.get('error', data)}")
        
        return data["choices"][0]["message"]["content"]
import httpx
import os

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
MODEL = "arcee-ai/trinity-mini:free"

async def generate_ai_summary(user_name: str, activities: list):
    if not OPENROUTER_API_KEY:
        # Fallback for hackathon demo
        return f"Пользователь {user_name} проявляет высокую активность в сферах IT и волонтерства. Рекомендуется для стажировок в крупных компаниях. (Демо-режим)"
    
    activity_text = "\n".join([f"- {a['title']} ({a['points']} points)" for a in activities])
    prompt = f"""
    Проанализируй профиль активности: {user_name}.
    Резюмируй в 2-3 абзаца (лидерство, стабильность).
    CRITICAL INSTRUCTION: You MUST answer ONLY in Russian language. Отвечай СТРОГО на русском языке. Любой другой язык запрещен.
    Мероприятия:
    {activity_text}
    """
    
    async with httpx.AsyncClient() as client:
        # First API call with reasoning
        response = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "HTTP-Referer": "https://razum.dev",
                "X-Title": "RAZUM 2.0",
                "Content-Type": "application/json"
            },
            json={
                "model": MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "reasoning": {"enabled": True}
            }
        )
        
        if response.status_code == 200:
            data = response.json()
            message = data["choices"][0]["message"]
            result = message.get("content", "")
            return result
        else:
            return f"Error from AI service: {response.text}"

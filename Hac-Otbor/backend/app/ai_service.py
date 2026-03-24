import httpx
import os
import json

OPENROUTER_API_KEY = "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"
MODEL = "arcee-ai/trinity-mini:free"

async def generate_ai_summary(user_name: str, activities: list, total_points: int = 0, level: str = "Новичок"):
    if not OPENROUTER_API_KEY:
        # Fallback for hackathon demo
        return {
            "summary": f"Пользователь {user_name} проявляет высокую активность в сферах IT и волонтерства. Рекомендуется для стажировок в крупных компаниях. (Демо-режим)",
            "stats": [
                {"name": "Лидерство", "value": 75},
                {"name": "Коммуникация", "value": 80},
                {"name": "Технические навыки", "value": 65},
                {"name": "Креативность", "value": 70},
                {"name": "Ответственность", "value": 85}
            ]
        }
    
    activity_text = "\n".join([f"- {a['title']} ({a['points']} points)" for a in activities])
    if not activity_text:
        activity_text = f"Пользователь пока не участвовал в мероприятиях. Сделай вероятностный прогноз его навыков на основе его текущего уровня ({level}) и баллов ({total_points})."

    prompt = f"""
    Проанализируй профиль активности: {user_name}.
    Уровень: {level}, Всего баллов: {total_points}.
    Мероприятия:
    {activity_text}

    CRITICAL INSTRUCTION: Верни ответ СТРОГО в формате JSON. Никакого дополнительного текста до или после JSON.
    Ожидаемый формат JSON:
    {{
        "summary": "2-3 абзаца текста с детальным анализом профиля на русском языке...",
        "stats": [
            {{"name": "Лидерство", "value": 85}},
            {{"name": "Коммуникация", "value": 70}},
            {{"name": "Технические навыки", "value": 90}},
            {{"name": "Креативность", "value": 65}},
            {{"name": "Ответственность", "value": 80}}
        ]
    }}
    Значения value должны быть от 0 до 100.
    """
    
    async with httpx.AsyncClient() as client:
        try:
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
                },
                timeout=30.0 # Add timeout to prevent hanging
            )
            
            if response.status_code == 200:
                data = response.json()
                message = data["choices"][0]["message"]
                result = message.get("content", "")
                
                # Clean up the output in case the model adds markdown formatting like ```json ... ```
                result = result.strip()
                if result.startswith("```json"):
                    result = result[7:]
                if result.startswith("```"):
                    result = result[3:]
                if result.endswith("```"):
                    result = result[:-3]
                result = result.strip()
                
                # Verify it's valid JSON
                try:
                    return json.loads(result)
                except json.JSONDecodeError:
                    # Fallback if AI fails to return proper JSON
                    return {
                        "summary": f"Анализ профиля (raw): {result}",
                        "stats": [
                            {"name": "Анализ", "value": 50}
                        ]
                    }
            elif response.status_code == 401:
                return {
                    "summary": f"Пользователь {user_name} проявляет активность. (Ошибка авторизации API: Неверный или отсутствующий ключ OpenRouter)",
                    "stats": [
                        {"name": "Лидерство", "value": 50},
                        {"name": "Коммуникация", "value": 50}
                    ]
                }
            else:
                return {
                    "summary": f"Ошибка генерации: статус {response.status_code}",
                    "stats": []
                }
        except httpx.RequestError as exc:
            print(f"An error occurred while requesting {exc.request.url!r}.")
            return {
                "summary": f"Пользователь {user_name} проявляет активность. (Ошибка сети: Не удалось подключиться к серверам OpenRouter. Возможно, проблема с интернетом или DNS внутри контейнера.)",
                "stats": [
                    {"name": "Лидерство", "value": 60},
                    {"name": "Коммуникация", "value": 60},
                    {"name": "Технические навыки", "value": 60}
                ]
            }

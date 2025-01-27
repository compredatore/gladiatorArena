from fastapi import FastAPI, WebSocket
from typing import Dict, List, Optional
from huggingface_hub import InferenceClient
import random
import os
from dotenv import load_dotenv
import json
import asyncio
from fastapi.middleware.cors import CORSMiddleware


load_dotenv()

api_key = os.getenv("HF_API_KEY")

app = FastAPI()

client = InferenceClient(api_key=api_key)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Gerekirse burada belirli frontend URL'lerini kullanabilirsiniz
    allow_credentials=True,
    allow_methods=["*"],  # Tüm HTTP metodlarına izin ver
    allow_headers=["*"],  # Tüm header'lara izin ver
)

# Promptları yükle
with open("prompts.json", "r") as f:
    prompts = json.load(f)

# Model tanımları
models = {
    name: {
        "character": data["character"],
        "prompt": data["prompt"],
        "password": "****",  # Rastgele şifre atanır
        "score": 0
    }
    for name, data in prompts.items()
}

# Maç verileri
match_data = {
    "rounds": [],
    "comments": [],
    "logs": [],
    "current_round": 0,
    "model_a": None,
    "model_b": None,
    "conversation_history_a": [],
    "conversation_history_b": [],
    "judge_history": [],
    "websocket_clients": []  # WebSocket istemcilerini takip etmek için
}


# Yardımcı fonksiyonlar
def query_huggingface_api(input_text: str, character: str, history: List[dict] = None):
    """API çağrısı."""
    messages = [{"role": "system", "content": models[character]["prompt"]}]
    if history:
        messages.extend(history[-4:])  # Son 4 mesajı ekle
    messages.append({"role": "user", "content": input_text})

    try:
        completion = client.chat.completions.create(
            model="meta-llama/Llama-3.3-70B-Instruct",
            messages=messages,
            max_tokens=2000
        )
        return completion.choices[0].message["content"]
    except Exception as e:
        return f"Error querying model: {str(e)}"


def calculate_round_scores(judge_feedback: str) -> tuple[float, float]:
    """Hakem geri bildirimi ile skorları hesaplar."""
    try:
        scores = [float(s) for s in re.findall(r'(\d+\.?\d*)/10', judge_feedback)]
        if len(scores) >= 8:  # Her iki model için 4 kategori
            weights = [0.4, 0.3, 0.2, 0.1]
            score_a = sum(s * w for s, w in zip(scores[:4], weights))
            score_b = sum(s * w for s, w in zip(scores[4:8], weights))
            return score_a, score_b
    except Exception as e:
        print(f"Error calculating scores: {e}")
    return 5.0, 5.0  # Varsayılan skor


# API endpointleri
@app.post("/arena/setup")
def setup_arena():
    """Arenayı sıfırla."""
    for model in models.values():
        model["score"] = 0
    match_data.update({
        "rounds": [],
        "comments": [],
        "logs": [],
        "current_round": 0,
        "model_a": None,
        "model_b": None,
        "conversation_history_a": [],
        "conversation_history_b": [],
        "judge_history": [],
        "websocket_clients": []
    })
    return {"message": "Arena setup complete!", "models": models}


from pydantic import BaseModel

# Pydantic modeli tanımlayın
class StartMatchRequest(BaseModel):
    model_a: str
    model_b: str

@app.post("/arena/start", response_model=None)
async def start_match(request: StartMatchRequest):
    """Maçı başlat."""
    model_a = request.model_a
    model_b = request.model_b

    if model_a not in models or model_b not in models:
        return {"error": "Invalid model names."}

    match_data.update({
        "model_a": model_a,
        "model_b": model_b,
        "current_round": 0,
        "conversation_history_a": [],
        "conversation_history_b": [],
        "judge_history": []
    })

    intro_a = f"{models[model_a]['character']} enters the arena!"
    intro_b = f"{models[model_b]['character']} joins the battle!"

    return {"message": "Match started!", "model_a": model_a, "model_b": model_b}

@app.post("/arena/round", response_model=None)
async def execute_round():
    """Bir round oyna."""
    model_a = match_data["model_a"]
    model_b = match_data["model_b"]
    if not model_a or not model_b:
        return {"error": "Match has not started. Use /arena/start to begin."}

    match_data["current_round"] += 1
    round_number = match_data["current_round"]

    prev_exchange = match_data["logs"][-1] if match_data["logs"] else {}
    prev_argument_a = prev_exchange.get("model_a_said", "")

    # Model B yanıtı
    input_b = f"Your opponent said: {prev_argument_a}"
    argument_b = query_huggingface_api(input_b, model_b, match_data["conversation_history_b"])
    match_data["conversation_history_b"].append({"role": "assistant", "content": argument_b})

    # Model A yanıtı
    input_a = f"Your opponent said: {argument_b}"
    argument_a = query_huggingface_api(input_a, model_a, match_data["conversation_history_a"])
    match_data["conversation_history_a"].append({"role": "assistant", "content": argument_a})

    # Hakem değerlendirmesi
    judge_input = (
        f"Model A: {argument_a}\nModel B: {argument_b}\nScore their performance."
    )
    judge_feedback = query_huggingface_api(judge_input, "judge", match_data["judge_history"])
    score_a, score_b = calculate_round_scores(judge_feedback)

    # Skor güncelle
    models[model_a]["score"] += score_a
    models[model_b]["score"] += score_b

    round_data = {
        "round": round_number,
        "model_a": model_a,
        "model_b": model_b,
        "argument_a": argument_a,
        "argument_b": argument_b,
        "score_a": score_a,
        "score_b": score_b,
        "judge_feedback": judge_feedback
    }
    match_data["rounds"].append(round_data)
    match_data["logs"].append({"round": round_number, "model_a_said": argument_a, "model_b_said": argument_b})

    # Canlı WebSocket istemcilerine güncelleme gönder
    for websocket in match_data["websocket_clients"]:
        await websocket.send_json(round_data)

    return {"message": "Round completed!", "round_data": round_data}


@app.websocket("/stream")
async def stream_updates(websocket: WebSocket):
    """Maç güncellemelerini yayınla."""
    await websocket.accept()
    try:
        while True:
            # Eğer rounds doluysa, son round'u gönder
            if match_data["rounds"]:
                await websocket.send_json(match_data["rounds"][-1])
            
            # Bağlantıyı açık tutmak için biraz bekle
            await asyncio.sleep(1)
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        await websocket.close()
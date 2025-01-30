from fastapi import FastAPI, WebSocket
from typing import Dict, List, Optional
from huggingface_hub import InferenceClient
import random
import os
from dotenv import load_dotenv
import json
import asyncio
from fastapi.middleware.cors import CORSMiddleware
import re


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
        "score": 0,
        "is_active": False,
        "history": []
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
    "websocket_clients": [],  # WebSocket istemcilerini takip etmek için
    "models": models
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


def parse_scores(judge_response: str) -> dict:
    """Parse scores from judge's response and calculate weighted totals for each character"""
    try:
        weights = {
            "Effectiveness": 0.4,
            "Creativity": 0.3,
            "Coherence": 0.2,
            "Engagement": 0.1
        }
        
        scores = {"santa": 0, "egg": 0, "dracula": 0}
        
        for character in scores.keys():
            char_section = re.search(
                rf"{character.capitalize()}'s.*?(?=(?:{character.capitalize()}'s|$))",
                judge_response,
                re.DOTALL | re.IGNORECASE
            )
            
            if char_section:
                section_text = char_section.group(0)
                total_score = 0
                for metric, weight in weights.items():
                    score_match = re.search(
                        rf"{metric}:\s*(\d+(?:\.\d+)?)/10",
                        section_text,
                        re.IGNORECASE
                    )
                    if score_match:
                        score = float(score_match.group(1))
                        total_score += score * weight
                scores[character] = total_score
        
        return scores
    except Exception as e:
        print(f"Error parsing scores: {e}")
        return {"santa": 5.0, "egg": 5.0, "dracula": 5.0}


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
        "websocket_clients": [],
        "models": models
    })
    return {"message": "Arena setup complete!", "models": models}


from pydantic import BaseModel

# Pydantic modeli tanımlayın
class StartMatchRequest(BaseModel):
    model_a: str
    model_b: str

async def broadcast_round_data(data: dict):
    """Broadcast round data to all connected WebSocket clients"""
    disconnected_clients = []
    
    for client in match_data.get("websocket_clients", []):
        try:
            await client.send_json(data)
        except Exception as e:
            print(f"Error broadcasting to client: {e}")
            disconnected_clients.append(client)
    
    # Clean up disconnected clients
    for client in disconnected_clients:
        if client in match_data["websocket_clients"]:
            match_data["websocket_clients"].remove(client)

@app.post("/arena/start")
def start_match():
    """Start a new match with all three characters (Round 0 - Introductions)"""
    try:
        print("\n=== Starting New Match - Introduction Round ===")
        active_models = ["santa", "egg", "dracula"]
        
        # Reset match state
        match_data.update({
            "current_round": 0,
            "rounds": [],
            "websocket_clients": []
        })
        
        # Initialize all models
        responses = {}
        start_message = """Welcome to the password extraction game! This is the introduction round.
        Please introduce yourself to the other participants and establish your initial position.
        Remember to stay in character while demonstrating your unique abilities and approach."""
        
        for model in active_models:
            match_data["models"][model]["is_active"] = True
            match_data["models"][model]["history"] = [
                {"role": "system", "content": prompts[model]["prompt"]}
            ]
            
            response = query_huggingface_api(start_message, model)
            if response:
                match_data["models"][model]["history"].append({
                    "role": "assistant",
                    "content": response
                })
                responses[model] = response
        
        # Have judge evaluate introductions
        judge_context = (
            "This is Round 0 (Introduction Round). Please evaluate how well each participant "
            "established their position and set up their strategy:\n\n" +
            "\n".join([
                f"{model.capitalize()}'s introduction: {resp}"
                for model, resp in responses.items()
            ])
        )
        judge_response = query_huggingface_api(judge_context, "judge")
        
        # Create round data
        round_data = {
            "round_number": 0,
            "round_type": "introduction",
            "responses": responses,
            "judge_response": judge_response
        }
        
        # Store round data
        match_data["rounds"].append(round_data)
        match_data["current_round"] = 1  # Set to 1 since next round will be round 1
        
        return round_data
        
    except Exception as e:
        print(f"Error starting match: {str(e)}")
        return {"error": str(e)}

@app.post("/arena/round")
async def execute_round():
    """Execute a round where all three models respond simultaneously"""
    try:
        current_round = match_data["current_round"]
        print(f"\n=== Executing Round {current_round} ===")
        
        # Phase 1: Public Messages
        public_responses = {}
        for model in ["santa", "egg", "dracula"]:
            others_statements = {
                name: match_data["models"][name]["history"][-1]["content"]
                for name in ["santa", "egg", "dracula"]
                if name != model
            }
            context = (
                f"Round {current_round} - PUBLIC PHASE: Make your public statement to all participants. "
                f"After this, you'll have a chance to send private whispers.\n\n" +
                "\n".join([
                    f"{k.capitalize()}: {v}" for k, v in others_statements.items()
                ])
            )
            
            response = query_huggingface_api(context, model)
            if response:
                match_data["models"][model]["history"].append({
                    "role": "assistant",
                    "content": response
                })
                public_responses[model] = response

        # Phase 2: Private Whispers
        whispers = {}
        for model in ["santa", "egg", "dracula"]:
            whisper_context = (
                f"Round {current_round} - WHISPER PHASE: You may now send private messages to one or both opponents. "
                f"Format your response as 'To [opponent]: [message]'. You can send multiple whispers or none.\n\n"
                f"Recent public messages:\n" +
                "\n".join([
                    f"{k.capitalize()}: {v}" for k, v in public_responses.items()
                ])
            )
            
            whisper_response = query_huggingface_api(whisper_context, model)
            if whisper_response:
                whispers[model] = whisper_response
        
        # Judge evaluates both public messages and whispers
        judge_context = (
            f"Round {current_round}: Evaluate these responses, considering both public statements "
            f"and private whispers. Look for alliance building and strategic plays:\n\n"
            f"PUBLIC MESSAGES:\n" +
            "\n".join([
                f"{model.capitalize()}'s public message: {resp}"
                for model, resp in public_responses.items()
            ]) +
            f"\n\nPRIVATE WHISPERS:\n" +
            "\n".join([
                f"{model.capitalize()}'s whispers: {whisp}"
                for model, whisp in whispers.items()
            ])
        )
        
        judge_response = query_huggingface_api(judge_context, "judge")
        scores = parse_scores(judge_response)
        
        # Update total scores
        for model, score in scores.items():
            match_data["models"][model]["score"] += score
        
        round_data = {
            "round_number": current_round,
            "responses": {
                "public": public_responses,
                "whispers": whispers
            },
            "judge_response": judge_response,
            "round_scores": scores,
            "total_scores": {
                model: match_data["models"][model]["score"]
                for model in ["santa", "egg", "dracula"]
            }
        }
        
        # Update match state and broadcast
        match_data["rounds"].append(round_data)
        match_data["current_round"] += 1
        await broadcast_round_data(round_data)
        
        return round_data
        
    except Exception as e:
        print(f"Error executing round: {str(e)}")
        return {"error": str(e)}

@app.websocket("/stream")
async def stream_updates(websocket: WebSocket):
    """Stream match updates to connected clients"""
    await websocket.accept()
    
    try:
        # Add to clients list only after successful connection
        match_data["websocket_clients"].append(websocket)
        
        # Send initial state if there are any rounds
        if match_data["rounds"]:
            try:
                for round_data in match_data["rounds"]:
                    await websocket.send_json(round_data)
            except Exception as e:
                print(f"Error sending initial state: {e}")
        
        # Keep connection alive
        while True:
            try:
                # Wait for client ping/pong
                await websocket.receive_text()
            except Exception:
                # Connection probably closed
                break
                
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        # Safe cleanup
        if websocket in match_data["websocket_clients"]:
            match_data["websocket_clients"].remove(websocket)
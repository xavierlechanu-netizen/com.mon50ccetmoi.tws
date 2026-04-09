from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import bcrypt
import jwt
import socketio

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).parent

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_ALGORITHM = "HS256"

def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]

# Password hashing
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

# JWT Token creation
def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "access"
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=30),
        "type": "refresh"
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

# Auth helper
async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Non authentifié")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Type de token invalide")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="Utilisateur non trouvé")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expiré")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token invalide")

# Optional auth (returns None if not authenticated)
async def get_optional_user(request: Request) -> Optional[dict]:
    try:
        return await get_current_user(request)
    except HTTPException:
        return None

# Create the main app
app = FastAPI(title="Mon 50cc et moi API")

# Socket.IO setup
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=True,
    engineio_logger=True
)
socket_app = socketio.ASGIApp(sio, app)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ============ MODELS ============

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    created_at: datetime

class SignalCreate(BaseModel):
    lat: float
    lng: float
    type: str  # "police", "danger", "tunnel", "speed_limit"
    description: Optional[str] = None  # Optional description for forbidden routes

class SignalResponse(BaseModel):
    id: str
    lat: float
    lng: float
    type: str
    description: Optional[str] = None
    upvotes: int
    downvotes: int
    user_id: str
    created_at: datetime

class VoteCreate(BaseModel):
    vote_type: str  # "up" or "down"

# ============ VEHICLE MODELS ============

SCOOTER_BRANDS = [
    # Marques classiques
    "Peugeot", "MBK", "Piaggio", "Kymco", "Sym", "Honda", "Yamaha", "Aprilia", "Vespa", "Derbi", "Gilera", "Malaguti",
    # Groupe Baotian France
    "Baotian", "Jiajue", "Znen", "Generic", "Keeway", "CPI", "Sachs", "Rex", "Jinlun", "Qingqi",
    # Maxiscoot / Import
    "TNT Motor", "Rieju", "Beta", "Fantic", "Sherco", "Gas Gas", "TGB", "Daelim", "Hyosung", "Benelli",
    # Autres
    "Autre"
]

class VehicleCreate(BaseModel):
    brand: str
    model: str
    year: int
    engine_type: str  # "2T" or "4T"
    mileage: int  # in km
    last_oil_change_km: Optional[int] = None
    last_oil_change_date: Optional[str] = None
    last_belt_change_km: Optional[int] = None
    last_spark_plug_change_km: Optional[int] = None
    notes: Optional[str] = None

class VehicleUpdate(BaseModel):
    mileage: Optional[int] = None
    last_oil_change_km: Optional[int] = None
    last_oil_change_date: Optional[str] = None
    last_belt_change_km: Optional[int] = None
    last_spark_plug_change_km: Optional[int] = None
    notes: Optional[str] = None

class MaintenanceLogCreate(BaseModel):
    type: str  # "oil_change", "belt", "spark_plug", "brake", "tire", "other"
    mileage: int
    description: Optional[str] = None
    cost: Optional[float] = None

class AskMechanicRequest(BaseModel):
    question: str
    category: Optional[str] = None  # "maintenance", "diagnostic", "fuel", "repair"

# ============ AUTH ENDPOINTS ============

@api_router.post("/auth/register")
async def register(user_data: UserCreate, response: Response):
    email = user_data.email.lower()
    
    # Check if user exists
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")
    
    # Create user
    user_doc = {
        "email": email,
        "password_hash": hash_password(user_data.password),
        "name": user_data.name,
        "role": "user",
        "created_at": datetime.now(timezone.utc)
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    
    # Create tokens
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    # Set cookies
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=2592000, path="/")
    
    return {
        "id": user_id,
        "email": email,
        "name": user_data.name,
        "token": access_token
    }

@api_router.post("/auth/login")
async def login(user_data: UserLogin, response: Response):
    email = user_data.email.lower()
    
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    
    if not verify_password(user_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    
    user_id = str(user["_id"])
    
    # Create tokens
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    # Set cookies
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=2592000, path="/")
    
    return {
        "id": user_id,
        "email": email,
        "name": user["name"],
        "token": access_token
    }

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"message": "Déconnexion réussie"}

@api_router.get("/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    return user

# ============ SIGNALS ENDPOINTS ============

@api_router.get("/signals")
async def get_signals():
    # Get signals from last 2 hours
    two_hours_ago = datetime.now(timezone.utc) - timedelta(hours=2)
    
    signals = await db.signals.find({
        "created_at": {"$gte": two_hours_ago}
    }).to_list(1000)
    
    result = []
    for signal in signals:
        result.append({
            "id": str(signal["_id"]),
            "lat": signal["lat"],
            "lng": signal["lng"],
            "type": signal["type"],
            "description": signal.get("description"),
            "upvotes": signal.get("upvotes", 0),
            "downvotes": signal.get("downvotes", 0),
            "user_id": signal["user_id"],
            "created_at": signal["created_at"].isoformat()
        })
    
    return result

@api_router.post("/signals")
async def create_signal(signal_data: SignalCreate, request: Request):
    user = await get_current_user(request)
    
    # Anti-spam: check last signal from this user
    one_minute_ago = datetime.now(timezone.utc) - timedelta(seconds=20)
    recent_signal = await db.signals.find_one({
        "user_id": user["_id"],
        "created_at": {"$gte": one_minute_ago}
    })
    
    if recent_signal:
        raise HTTPException(status_code=429, detail="Veuillez attendre 20 secondes entre chaque signalement")
    
    signal_doc = {
        "lat": signal_data.lat,
        "lng": signal_data.lng,
        "type": signal_data.type,
        "description": signal_data.description,
        "upvotes": 0,
        "downvotes": 0,
        "voters": [],
        "user_id": user["_id"],
        "created_at": datetime.now(timezone.utc)
    }
    
    result = await db.signals.insert_one(signal_doc)
    signal_id = str(result.inserted_id)
    
    # Broadcast new signal to all connected clients
    signal_response = {
        "id": signal_id,
        "lat": signal_data.lat,
        "lng": signal_data.lng,
        "type": signal_data.type,
        "description": signal_data.description,
        "upvotes": 0,
        "downvotes": 0,
        "user_id": user["_id"],
        "created_at": signal_doc["created_at"].isoformat()
    }
    
    await sio.emit('new_signal', signal_response)
    
    return signal_response

@api_router.post("/signals/{signal_id}/vote")
async def vote_signal(signal_id: str, vote_data: VoteCreate, request: Request):
    user = await get_current_user(request)
    
    try:
        signal = await db.signals.find_one({"_id": ObjectId(signal_id)})
    except:
        raise HTTPException(status_code=404, detail="Signalement non trouvé")
    
    if not signal:
        raise HTTPException(status_code=404, detail="Signalement non trouvé")
    
    # Check if user already voted
    voters = signal.get("voters", [])
    if user["_id"] in voters:
        raise HTTPException(status_code=400, detail="Vous avez déjà voté")
    
    # Update vote
    update_field = "upvotes" if vote_data.vote_type == "up" else "downvotes"
    await db.signals.update_one(
        {"_id": ObjectId(signal_id)},
        {
            "$inc": {update_field: 1},
            "$push": {"voters": user["_id"]}
        }
    )
    
    # Get updated signal
    updated_signal = await db.signals.find_one({"_id": ObjectId(signal_id)})
    
    signal_response = {
        "id": signal_id,
        "lat": updated_signal["lat"],
        "lng": updated_signal["lng"],
        "type": updated_signal["type"],
        "description": updated_signal.get("description"),
        "upvotes": updated_signal.get("upvotes", 0),
        "downvotes": updated_signal.get("downvotes", 0),
        "user_id": updated_signal["user_id"],
        "created_at": updated_signal["created_at"].isoformat()
    }
    
    # Broadcast vote update
    await sio.emit('signal_updated', signal_response)
    
    return signal_response

@api_router.delete("/signals/{signal_id}")
async def delete_signal(signal_id: str, request: Request):
    user = await get_current_user(request)
    
    try:
        signal = await db.signals.find_one({"_id": ObjectId(signal_id)})
    except:
        raise HTTPException(status_code=404, detail="Signalement non trouvé")
    
    if not signal:
        raise HTTPException(status_code=404, detail="Signalement non trouvé")
    
    # Only owner can delete
    if signal["user_id"] != user["_id"]:
        raise HTTPException(status_code=403, detail="Non autorisé")
    
    await db.signals.delete_one({"_id": ObjectId(signal_id)})
    
    # Broadcast deletion
    await sio.emit('signal_deleted', {"id": signal_id})
    
    return {"message": "Signalement supprimé"}

# ============ SOCKET.IO EVENTS ============

@sio.event
async def connect(sid, environ):
    logger.info(f"Client connected: {sid}")

@sio.event
async def disconnect(sid):
    logger.info(f"Client disconnected: {sid}")

@sio.event
async def join_map(sid, data):
    await sio.enter_room(sid, 'map_room')
    logger.info(f"Client {sid} joined map room")

# ============ VEHICLE ENDPOINTS ============

@api_router.get("/vehicles/brands")
async def get_brands():
    """Get list of supported scooter brands"""
    return {"brands": SCOOTER_BRANDS}

@api_router.get("/vehicles/my")
async def get_my_vehicle(request: Request):
    """Get current user's vehicle"""
    user = await get_current_user(request)
    vehicle = await db.vehicles.find_one({"user_id": user["_id"]})
    if not vehicle:
        return None
    vehicle["_id"] = str(vehicle["_id"])
    return vehicle

@api_router.post("/vehicles")
async def create_vehicle(vehicle_data: VehicleCreate, request: Request):
    """Create or update user's vehicle"""
    user = await get_current_user(request)
    
    # Check if user already has a vehicle
    existing = await db.vehicles.find_one({"user_id": user["_id"]})
    
    vehicle_doc = {
        "user_id": user["_id"],
        "brand": vehicle_data.brand,
        "model": vehicle_data.model,
        "year": vehicle_data.year,
        "engine_type": vehicle_data.engine_type,
        "mileage": vehicle_data.mileage,
        "last_oil_change_km": vehicle_data.last_oil_change_km,
        "last_oil_change_date": vehicle_data.last_oil_change_date,
        "last_belt_change_km": vehicle_data.last_belt_change_km,
        "last_spark_plug_change_km": vehicle_data.last_spark_plug_change_km,
        "notes": vehicle_data.notes,
        "updated_at": datetime.now(timezone.utc)
    }
    
    if existing:
        await db.vehicles.update_one(
            {"_id": existing["_id"]},
            {"$set": vehicle_doc}
        )
        vehicle_doc["_id"] = str(existing["_id"])
    else:
        vehicle_doc["created_at"] = datetime.now(timezone.utc)
        result = await db.vehicles.insert_one(vehicle_doc)
        vehicle_doc["_id"] = str(result.inserted_id)
    
    return vehicle_doc

@api_router.patch("/vehicles")
async def update_vehicle(vehicle_data: VehicleUpdate, request: Request):
    """Update vehicle mileage and maintenance info"""
    user = await get_current_user(request)
    
    vehicle = await db.vehicles.find_one({"user_id": user["_id"]})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Véhicule non trouvé")
    
    update_data = {k: v for k, v in vehicle_data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.vehicles.update_one(
        {"_id": vehicle["_id"]},
        {"$set": update_data}
    )
    
    updated = await db.vehicles.find_one({"_id": vehicle["_id"]})
    updated["_id"] = str(updated["_id"])
    return updated

@api_router.get("/vehicles/maintenance-tips")
async def get_maintenance_tips(request: Request):
    """Get maintenance tips based on vehicle"""
    user = await get_current_user(request)
    vehicle = await db.vehicles.find_one({"user_id": user["_id"]})
    
    tips = []
    
    if vehicle:
        mileage = vehicle.get("mileage", 0)
        engine_type = vehicle.get("engine_type", "4T")
        
        # Oil change tips
        last_oil_km = vehicle.get("last_oil_change_km", 0)
        oil_interval = 1500 if engine_type == "2T" else 3000
        km_since_oil = mileage - last_oil_km
        
        if km_since_oil >= oil_interval:
            tips.append({
                "type": "oil_change",
                "priority": "high",
                "icon": "water",
                "title": "Vidange à faire !",
                "description": f"Vous avez parcouru {km_since_oil} km depuis la dernière vidange. Recommandé tous les {oil_interval} km pour un moteur {engine_type}.",
                "action": "Changer l'huile moteur"
            })
        elif km_since_oil >= oil_interval * 0.8:
            tips.append({
                "type": "oil_change",
                "priority": "medium",
                "icon": "water",
                "title": "Vidange à prévoir",
                "description": f"Plus que {oil_interval - km_since_oil} km avant la prochaine vidange.",
                "action": "Planifier une vidange"
            })
        
        # Belt tips (variator belt)
        last_belt_km = vehicle.get("last_belt_change_km", 0)
        belt_interval = 8000
        km_since_belt = mileage - last_belt_km
        
        if km_since_belt >= belt_interval:
            tips.append({
                "type": "belt",
                "priority": "high",
                "icon": "sync-circle",
                "title": "Courroie à vérifier !",
                "description": f"La courroie de variateur devrait être contrôlée après {km_since_belt} km.",
                "action": "Faire vérifier la courroie"
            })
        
        # Spark plug tips
        last_spark_km = vehicle.get("last_spark_plug_change_km", 0)
        spark_interval = 5000
        km_since_spark = mileage - last_spark_km
        
        if km_since_spark >= spark_interval:
            tips.append({
                "type": "spark_plug",
                "priority": "medium",
                "icon": "flash",
                "title": "Bougie à vérifier",
                "description": f"Il est recommandé de vérifier/remplacer la bougie tous les {spark_interval} km.",
                "action": "Vérifier l'état de la bougie"
            })
        
        # 2T specific tips
        if engine_type == "2T":
            tips.append({
                "type": "2t_mix",
                "priority": "info",
                "icon": "beaker",
                "title": "Huile 2 temps",
                "description": "Vérifiez régulièrement le niveau d'huile 2 temps dans le réservoir séparé.",
                "action": "Contrôler le niveau"
            })
    
    # General tips
    tips.append({
        "type": "pressure",
        "priority": "info",
        "icon": "speedometer",
        "title": "Pression des pneus",
        "description": "Vérifiez la pression des pneus chaque semaine. Avant: 1.5-1.8 bar, Arrière: 2.0-2.5 bar.",
        "action": "Vérifier la pression"
    })
    
    tips.append({
        "type": "fuel",
        "priority": "info",
        "icon": "leaf",
        "title": "Économie de carburant",
        "description": "Évitez les accélérations brusques et maintenez une vitesse constante pour économiser du carburant.",
        "action": "Adopter une conduite souple"
    })
    
    return {"tips": tips, "vehicle": vehicle}

@api_router.get("/vehicles/common-problems")
async def get_common_problems(request: Request):
    """Get common problems and diagnostics for the vehicle"""
    user = await get_current_user(request)
    vehicle = await db.vehicles.find_one({"user_id": user["_id"]})
    
    problems = []
    
    # Common problems for all scooters
    problems.append({
        "symptom": "Le scooter ne démarre pas",
        "icon": "close-circle",
        "causes": [
            {"cause": "Batterie déchargée", "solution": "Recharger ou remplacer la batterie", "difficulty": "facile"},
            {"cause": "Bougie encrassée", "solution": "Nettoyer ou remplacer la bougie", "difficulty": "facile"},
            {"cause": "Essence coupée", "solution": "Vérifier le robinet d'essence et le filtre", "difficulty": "facile"},
            {"cause": "Problème d'allumage", "solution": "Faire vérifier par un professionnel", "difficulty": "difficile"}
        ]
    })
    
    problems.append({
        "symptom": "Le scooter cale au ralenti",
        "icon": "pause-circle",
        "causes": [
            {"cause": "Ralenti mal réglé", "solution": "Ajuster la vis de ralenti", "difficulty": "moyen"},
            {"cause": "Filtre à air encrassé", "solution": "Nettoyer ou remplacer le filtre à air", "difficulty": "facile"},
            {"cause": "Carburateur encrassé", "solution": "Nettoyer le carburateur", "difficulty": "moyen"}
        ]
    })
    
    problems.append({
        "symptom": "Manque de puissance",
        "icon": "trending-down",
        "causes": [
            {"cause": "Filtre à air bouché", "solution": "Remplacer le filtre à air", "difficulty": "facile"},
            {"cause": "Pot d'échappement obstrué", "solution": "Nettoyer ou remplacer le pot", "difficulty": "moyen"},
            {"cause": "Courroie usée", "solution": "Remplacer la courroie de variateur", "difficulty": "moyen"},
            {"cause": "Galets variateur usés", "solution": "Remplacer les galets", "difficulty": "moyen"}
        ]
    })
    
    problems.append({
        "symptom": "Consommation excessive",
        "icon": "water",
        "causes": [
            {"cause": "Pneus sous-gonflés", "solution": "Vérifier et ajuster la pression", "difficulty": "facile"},
            {"cause": "Filtre à air encrassé", "solution": "Remplacer le filtre", "difficulty": "facile"},
            {"cause": "Carburateur déréglé", "solution": "Faire régler le carburateur", "difficulty": "moyen"}
        ]
    })
    
    problems.append({
        "symptom": "Freins inefficaces",
        "icon": "hand-left",
        "causes": [
            {"cause": "Plaquettes usées", "solution": "Remplacer les plaquettes de frein", "difficulty": "moyen"},
            {"cause": "Disque usé", "solution": "Remplacer le disque de frein", "difficulty": "difficile"},
            {"cause": "Air dans le circuit", "solution": "Purger le circuit de frein", "difficulty": "moyen"}
        ]
    })
    
    if vehicle and vehicle.get("engine_type") == "2T":
        problems.append({
            "symptom": "Fumée blanche excessive (2T)",
            "icon": "cloud",
            "causes": [
                {"cause": "Trop d'huile dans le mélange", "solution": "Ajuster le dosage d'huile", "difficulty": "facile"},
                {"cause": "Pompe à huile déréglée", "solution": "Faire vérifier la pompe à huile", "difficulty": "moyen"}
            ]
        })
    
    return {"problems": problems, "vehicle": vehicle}

# ============ AI MECHANIC ADVICE ============

@api_router.post("/vehicles/ask-mechanic")
async def ask_mechanic(ask_data: AskMechanicRequest, request: Request):
    """Get AI-powered mechanic advice"""
    user = await get_current_user(request)
    vehicle = await db.vehicles.find_one({"user_id": user["_id"]})
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        # Build context about the vehicle
        vehicle_context = ""
        if vehicle:
            vehicle_context = f"""
Informations sur le scooter de l'utilisateur:
- Marque: {vehicle.get('brand', 'Non spécifié')}
- Modèle: {vehicle.get('model', 'Non spécifié')}
- Année: {vehicle.get('year', 'Non spécifié')}
- Type moteur: {vehicle.get('engine_type', 'Non spécifié')}
- Kilométrage actuel: {vehicle.get('mileage', 'Non spécifié')} km
- Dernière vidange: {vehicle.get('last_oil_change_km', 'Non spécifié')} km
- Dernière courroie: {vehicle.get('last_belt_change_km', 'Non spécifié')} km
"""
        
        system_message = f"""Tu es un mécanicien expert en scooters et cyclomoteurs 50cc. Tu donnes des conseils pratiques, 
clairs et adaptés aux débutants. Tu réponds TOUJOURS en français.

IMPORTANT: Tu ne parles QUE des scooters et cyclomoteurs 50cc. Les motos sont INTERDITES dans cette application.
Si on te pose une question sur les motos, rappelle que cette app est uniquement pour les 50cc.

{vehicle_context}

Donne des conseils concis, pratiques et sécuritaires. Mentionne toujours quand il vaut mieux consulter un professionnel.
Format ta réponse de manière claire avec des points si nécessaire."""

        chat = LlmChat(
            api_key=os.environ.get("EMERGENT_LLM_KEY"),
            session_id=f"mechanic_{user['_id']}_{datetime.now().timestamp()}",
            system_message=system_message
        ).with_model("openai", "gpt-4.1-mini")
        
        user_message = UserMessage(text=ask_data.question)
        response = await chat.send_message(user_message)
        
        # Save to history
        await db.mechanic_chats.insert_one({
            "user_id": user["_id"],
            "question": ask_data.question,
            "answer": response,
            "category": ask_data.category,
            "created_at": datetime.now(timezone.utc)
        })
        
        return {
            "answer": response,
            "vehicle": vehicle
        }
        
    except Exception as e:
        logger.error(f"AI Mechanic error: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de la génération du conseil. Réessayez plus tard.")

@api_router.get("/vehicles/chat-history")
async def get_chat_history(request: Request, limit: int = 10):
    """Get user's mechanic chat history"""
    user = await get_current_user(request)
    
    chats = await db.mechanic_chats.find(
        {"user_id": user["_id"]}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    result = []
    for chat in chats:
        result.append({
            "id": str(chat["_id"]),
            "question": chat["question"],
            "answer": chat["answer"],
            "category": chat.get("category"),
            "created_at": chat["created_at"].isoformat()
        })
    
    return {"history": result}

# ============ MAINTENANCE LOG ============

@api_router.post("/vehicles/maintenance-log")
async def add_maintenance_log(log_data: MaintenanceLogCreate, request: Request):
    """Add a maintenance log entry"""
    user = await get_current_user(request)
    vehicle = await db.vehicles.find_one({"user_id": user["_id"]})
    
    if not vehicle:
        raise HTTPException(status_code=404, detail="Ajoutez d'abord votre véhicule")
    
    log_doc = {
        "user_id": user["_id"],
        "vehicle_id": vehicle["_id"],
        "type": log_data.type,
        "mileage": log_data.mileage,
        "description": log_data.description,
        "cost": log_data.cost,
        "created_at": datetime.now(timezone.utc)
    }
    
    result = await db.maintenance_logs.insert_one(log_doc)
    
    # Update vehicle last maintenance km based on type
    update_field = None
    if log_data.type == "oil_change":
        update_field = "last_oil_change_km"
    elif log_data.type == "belt":
        update_field = "last_belt_change_km"
    elif log_data.type == "spark_plug":
        update_field = "last_spark_plug_change_km"
    
    if update_field:
        await db.vehicles.update_one(
            {"_id": vehicle["_id"]},
            {"$set": {
                update_field: log_data.mileage,
                "mileage": max(vehicle.get("mileage", 0), log_data.mileage),
                "updated_at": datetime.now(timezone.utc)
            }}
        )
    
    log_doc["_id"] = str(result.inserted_id)
    log_doc["vehicle_id"] = str(log_doc["vehicle_id"])
    return log_doc

@api_router.get("/vehicles/maintenance-log")
async def get_maintenance_logs(request: Request, limit: int = 20):
    """Get maintenance log history"""
    user = await get_current_user(request)
    
    logs = await db.maintenance_logs.find(
        {"user_id": user["_id"]}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    result = []
    for log in logs:
        result.append({
            "id": str(log["_id"]),
            "type": log["type"],
            "mileage": log["mileage"],
            "description": log.get("description"),
            "cost": log.get("cost"),
            "created_at": log["created_at"].isoformat()
        })
    
    return {"logs": result}

# ============ INSURANCE COMPARISON ============

# Insurance data for 50cc scooters in France
INSURANCE_BROKER = {
    "name": "Robert GUILLUY",
    "title": "Courtier National du Courtage",
    "phone_mobile": "07 84 88 51 12",
    "phone_fixed": "09 81 13 27 63",
    "description": "Courtier spécialisé 50cc - Tarifs préférentiels avec suivi GPS",
    "special_offer": "Réduction si vous prouvez éviter autoroutes et voies rapides via GPS",
    "color": "#10b981"
}

INSURANCE_PROVIDERS = [
    {
        "id": "april",
        "name": "April Moto",
        "logo": "shield-checkmark",
        "color": "#e74c3c",
        "description": "Spécialiste 2 roues depuis 1988",
        "rating": 4.2,
        "formulas": [
            {
                "name": "Tiers",
                "price_min": 8,
                "price_max": 15,
                "coverages": ["Responsabilité civile", "Défense pénale", "Recours suite accident"],
                "excluded": ["Vol", "Incendie", "Dommages"]
            },
            {
                "name": "Tiers+",
                "price_min": 12,
                "price_max": 22,
                "coverages": ["Responsabilité civile", "Vol", "Incendie", "Catastrophes naturelles", "Assistance 0km"],
                "excluded": ["Dommages tous accidents"]
            },
            {
                "name": "Tous Risques",
                "price_min": 18,
                "price_max": 35,
                "coverages": ["Responsabilité civile", "Vol", "Incendie", "Dommages tous accidents", "Équipements", "Assistance 0km"],
                "excluded": []
            }
        ],
        "pros": ["Devis rapide en ligne", "Spécialiste 2 roues", "Assistance 24h/24"],
        "cons": ["Franchise élevée", "Tarifs jeunes conducteurs"]
    },
    {
        "id": "amv",
        "name": "AMV Assurances",
        "logo": "bicycle",
        "color": "#3498db",
        "description": "N°1 de l'assurance moto en France",
        "rating": 4.0,
        "formulas": [
            {
                "name": "Essentiel",
                "price_min": 7,
                "price_max": 14,
                "coverages": ["Responsabilité civile", "Défense recours", "Protection juridique"],
                "excluded": ["Vol", "Incendie", "Dommages"]
            },
            {
                "name": "Confort",
                "price_min": 11,
                "price_max": 20,
                "coverages": ["Responsabilité civile", "Vol", "Incendie", "Assistance", "Accessoires 300€"],
                "excluded": ["Dommages collision"]
            },
            {
                "name": "Intégral",
                "price_min": 16,
                "price_max": 32,
                "coverages": ["Responsabilité civile", "Vol", "Incendie", "Dommages tous accidents", "Accessoires 800€", "Assistance 0km", "Prêt de véhicule"],
                "excluded": []
            }
        ],
        "pros": ["Leader du marché", "Nombreuses agences", "Application mobile"],
        "cons": ["Délais de remboursement", "Service client perfectible"]
    },
    {
        "id": "macif",
        "name": "Macif",
        "logo": "people",
        "color": "#27ae60",
        "description": "Mutuelle d'assurance",
        "rating": 4.3,
        "formulas": [
            {
                "name": "Tiers Simple",
                "price_min": 6,
                "price_max": 12,
                "coverages": ["Responsabilité civile", "Défense recours"],
                "excluded": ["Vol", "Incendie", "Dommages", "Assistance"]
            },
            {
                "name": "Tiers Étendu",
                "price_min": 10,
                "price_max": 18,
                "coverages": ["Responsabilité civile", "Vol", "Incendie", "Bris de glace", "Assistance 25km"],
                "excluded": ["Dommages collision"]
            },
            {
                "name": "Tous Risques",
                "price_min": 15,
                "price_max": 30,
                "coverages": ["Responsabilité civile", "Vol", "Incendie", "Dommages tous accidents", "Assistance 0km", "Équipement pilote"],
                "excluded": []
            }
        ],
        "pros": ["Tarifs compétitifs", "Bonne réputation", "Réseau d'agences"],
        "cons": ["Moins spécialisé 2 roues"]
    },
    {
        "id": "maaf",
        "name": "MAAF",
        "logo": "car",
        "color": "#9b59b6",
        "description": "Assureur généraliste",
        "rating": 4.1,
        "formulas": [
            {
                "name": "Tiers",
                "price_min": 7,
                "price_max": 13,
                "coverages": ["Responsabilité civile", "Protection juridique"],
                "excluded": ["Vol", "Incendie", "Dommages"]
            },
            {
                "name": "Tiers Confort",
                "price_min": 11,
                "price_max": 19,
                "coverages": ["Responsabilité civile", "Vol", "Incendie", "Catastrophes naturelles", "Assistance"],
                "excluded": ["Dommages collision"]
            },
            {
                "name": "Tous Risques",
                "price_min": 17,
                "price_max": 33,
                "coverages": ["Responsabilité civile", "Vol", "Incendie", "Dommages tous accidents", "Équipements 500€", "Assistance 0km"],
                "excluded": []
            }
        ],
        "pros": ["Multi-contrats avantageux", "Service client réactif"],
        "cons": ["Franchise parfois élevée"]
    },
    {
        "id": "assurland",
        "name": "Assurland",
        "logo": "search",
        "color": "#f39c12",
        "description": "Comparateur + assureur",
        "rating": 3.9,
        "formulas": [
            {
                "name": "Éco",
                "price_min": 5,
                "price_max": 11,
                "coverages": ["Responsabilité civile", "Défense recours"],
                "excluded": ["Vol", "Incendie", "Dommages", "Assistance"]
            },
            {
                "name": "Médium",
                "price_min": 9,
                "price_max": 17,
                "coverages": ["Responsabilité civile", "Vol", "Incendie", "Assistance dépannage"],
                "excluded": ["Dommages tous accidents"]
            },
            {
                "name": "Premium",
                "price_min": 14,
                "price_max": 28,
                "coverages": ["Responsabilité civile", "Vol", "Incendie", "Dommages", "Assistance 0km", "Valeur à neuf 1 an"],
                "excluded": []
            }
        ],
        "pros": ["Prix très compétitifs", "Souscription 100% en ligne"],
        "cons": ["Service client limité", "Peu d'agences"]
    },
    {
        "id": "leocare",
        "name": "Leocare",
        "logo": "phone-portrait",
        "color": "#1abc9c",
        "description": "Assurance 100% mobile",
        "rating": 4.4,
        "formulas": [
            {
                "name": "Tiers",
                "price_min": 6,
                "price_max": 12,
                "coverages": ["Responsabilité civile", "Protection juridique", "Assistance téléphone"],
                "excluded": ["Vol", "Incendie", "Dommages"]
            },
            {
                "name": "Intermédiaire",
                "price_min": 10,
                "price_max": 18,
                "coverages": ["Responsabilité civile", "Vol", "Incendie", "Assistance 0km", "Casque et gants inclus"],
                "excluded": ["Dommages collision"]
            },
            {
                "name": "Tous Risques",
                "price_min": 15,
                "price_max": 29,
                "coverages": ["Responsabilité civile", "Vol", "Incendie", "Dommages tous accidents", "Équipement 1000€", "Assistance 0km"],
                "excluded": []
            }
        ],
        "pros": ["100% digital", "Gestion via app", "Prix attractifs", "Jeunes conducteurs acceptés"],
        "cons": ["Pas d'agence physique", "Nouveau sur le marché"]
    }
]

@api_router.get("/insurance/providers")
async def get_insurance_providers():
    """Get list of insurance providers with their formulas"""
    return {
        "providers": INSURANCE_PROVIDERS, 
        "brands": SCOOTER_BRANDS,
        "broker": INSURANCE_BROKER
    }

# ============ PARKING ENDPOINTS ============

@api_router.get("/parking/nearby")
async def get_nearby_parking(lat: float, lng: float, radius: float = 2000):
    """Get parking spots for 50cc near a location"""
    # Get user-reported parking spots
    user_parkings = await db.parkings.find({
        "location": {
            "$near": {
                "$geometry": {
                    "type": "Point",
                    "coordinates": [lng, lat]
                },
                "$maxDistance": radius
            }
        }
    }).to_list(50)
    
    # Add some default known free parking areas for 50cc in major cities
    default_parkings = [
        {
            "id": "default_1",
            "name": "Parking 2 roues gratuit",
            "type": "free",
            "lat": lat + 0.002,
            "lng": lng + 0.001,
            "description": "Zone de stationnement 2 roues",
            "is_default": True
        }
    ]
    
    result = []
    for parking in user_parkings:
        result.append({
            "id": str(parking["_id"]),
            "name": parking.get("name", "Parking 50cc"),
            "type": parking.get("type", "free"),
            "lat": parking["lat"],
            "lng": parking["lng"],
            "description": parking.get("description"),
            "upvotes": parking.get("upvotes", 0),
            "downvotes": parking.get("downvotes", 0),
            "created_at": parking.get("created_at", datetime.now(timezone.utc)).isoformat()
        })
    
    return {"parkings": result}

@api_router.post("/parking")
async def create_parking(request: Request):
    """Report a free parking spot for 50cc"""
    user = await get_current_user(request)
    body = await request.json()
    
    parking_doc = {
        "name": body.get("name", "Parking 50cc gratuit"),
        "type": body.get("type", "free"),  # "free", "paid", "limited"
        "lat": body["lat"],
        "lng": body["lng"],
        "location": {
            "type": "Point",
            "coordinates": [body["lng"], body["lat"]]
        },
        "description": body.get("description"),
        "upvotes": 0,
        "downvotes": 0,
        "voters": [],
        "user_id": user["_id"],
        "created_at": datetime.now(timezone.utc)
    }
    
    result = await db.parkings.insert_one(parking_doc)
    
    return {
        "id": str(result.inserted_id),
        "name": parking_doc["name"],
        "type": parking_doc["type"],
        "lat": parking_doc["lat"],
        "lng": parking_doc["lng"],
        "description": parking_doc.get("description")
    }

@api_router.post("/parking/{parking_id}/vote")
async def vote_parking(parking_id: str, request: Request):
    """Vote on a parking spot"""
    user = await get_current_user(request)
    body = await request.json()
    vote_type = body.get("vote_type", "up")
    
    try:
        parking = await db.parkings.find_one({"_id": ObjectId(parking_id)})
    except:
        raise HTTPException(status_code=404, detail="Parking non trouvé")
    
    if not parking:
        raise HTTPException(status_code=404, detail="Parking non trouvé")
    
    voters = parking.get("voters", [])
    if user["_id"] in voters:
        raise HTTPException(status_code=400, detail="Vous avez déjà voté")
    
    update_field = "upvotes" if vote_type == "up" else "downvotes"
    await db.parkings.update_one(
        {"_id": ObjectId(parking_id)},
        {
            "$inc": {update_field: 1},
            "$push": {"voters": user["_id"]}
        }
    )
    
    return {"message": "Vote enregistré"}

# ============ GPS TRACKING FOR INSURANCE ============

@api_router.post("/gps/track")
async def save_gps_track(request: Request):
    """Save GPS track point for insurance proof"""
    user = await get_current_user(request)
    body = await request.json()
    
    track_point = {
        "user_id": user["_id"],
        "lat": body["lat"],
        "lng": body["lng"],
        "speed": body.get("speed", 0),
        "timestamp": datetime.now(timezone.utc)
    }
    
    await db.gps_tracks.insert_one(track_point)
    
    return {"status": "saved"}

@api_router.get("/gps/stats")
async def get_gps_stats(request: Request):
    """Get GPS statistics for insurance (no highways, no fast roads)"""
    user = await get_current_user(request)
    
    # Get last 30 days of tracks
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    
    tracks = await db.gps_tracks.find({
        "user_id": user["_id"],
        "timestamp": {"$gte": thirty_days_ago}
    }).to_list(10000)
    
    total_points = len(tracks)
    max_speed = 0
    avg_speed = 0
    highway_violations = 0
    
    if tracks:
        speeds = [t.get("speed", 0) for t in tracks]
        max_speed = max(speeds)
        avg_speed = sum(speeds) / len(speeds)
        
        # Count highway violations (speed > 50 km/h for 50cc is suspicious)
        highway_violations = len([s for s in speeds if s > 50])
    
    # Calculate compliance score
    compliance_score = 100
    if highway_violations > 0:
        compliance_score -= min(50, highway_violations * 2)
    if max_speed > 60:
        compliance_score -= 20
    
    compliance_score = max(0, compliance_score)
    
    return {
        "total_points": total_points,
        "max_speed_kmh": round(max_speed, 1),
        "avg_speed_kmh": round(avg_speed, 1),
        "highway_violations": highway_violations,
        "compliance_score": compliance_score,
        "period_days": 30,
        "eligible_for_discount": compliance_score >= 80,
        "message": "Excellent ! Vous êtes éligible à une réduction" if compliance_score >= 80 else "Continuez à éviter les voies rapides pour obtenir une réduction"
    }

@api_router.post("/insurance/estimate")
async def get_insurance_estimate(request: Request):
    """Get personalized insurance estimates"""
    body = await request.json()
    
    age = body.get("driver_age", 18)
    experience = body.get("experience_years", 0)
    vehicle_value = body.get("vehicle_value", 1500)
    brand = body.get("brand", "")
    postal_code = body.get("postal_code", "75000")
    
    # Calculate risk factor based on inputs
    risk_factor = 1.0
    
    # Age factor
    if age < 21:
        risk_factor *= 1.5
    elif age < 25:
        risk_factor *= 1.2
    elif age > 40:
        risk_factor *= 0.9
    
    # Experience factor
    if experience == 0:
        risk_factor *= 1.3
    elif experience >= 3:
        risk_factor *= 0.85
    
    # Location factor (simplified - Paris and big cities more expensive)
    if postal_code.startswith("75") or postal_code.startswith("13") or postal_code.startswith("69"):
        risk_factor *= 1.2
    elif postal_code.startswith("97"):  # DOM-TOM
        risk_factor *= 1.4
    
    # Vehicle value factor
    if vehicle_value > 3000:
        risk_factor *= 1.15
    elif vehicle_value < 1000:
        risk_factor *= 0.9
    
    # Premium brands slightly cheaper (better anti-theft)
    premium_brands = ["Honda", "Yamaha", "Piaggio", "Vespa", "Peugeot"]
    if brand in premium_brands:
        risk_factor *= 0.95
    
    # Budget brands slightly more expensive
    budget_brands = ["Baotian", "Jiajue", "Znen", "Generic", "Jinlun", "Qingqi"]
    if brand in budget_brands:
        risk_factor *= 1.05
    
    estimates = []
    for provider in INSURANCE_PROVIDERS:
        provider_estimate = {
            "id": provider["id"],
            "name": provider["name"],
            "logo": provider["logo"],
            "color": provider["color"],
            "rating": provider["rating"],
            "formulas": []
        }
        
        for formula in provider["formulas"]:
            estimated_price = (formula["price_min"] + formula["price_max"]) / 2 * risk_factor
            estimated_price = round(estimated_price, 2)
            
            provider_estimate["formulas"].append({
                "name": formula["name"],
                "price_monthly": estimated_price,
                "price_yearly": round(estimated_price * 12 * 0.95, 2),  # 5% discount annual
                "coverages": formula["coverages"],
                "excluded": formula["excluded"]
            })
        
        estimates.append(provider_estimate)
    
    # Sort by cheapest tiers option
    estimates.sort(key=lambda x: x["formulas"][0]["price_monthly"])
    
    return {
        "estimates": estimates,
        "risk_factor": round(risk_factor, 2),
        "profile": {
            "age": age,
            "experience": experience,
            "vehicle_value": vehicle_value,
            "brand": brand,
            "postal_code": postal_code
        }
    }

# ============ HEALTH CHECK ============

@api_router.get("/")
async def root():
    return {"message": "Mon 50cc et moi API", "status": "running"}

@api_router.get("/health")
async def health():
    return {"status": "healthy"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Admin seeding
async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@mon50cc.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        hashed = hash_password(admin_password)
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hashed,
            "name": "Admin",
            "role": "admin",
            "created_at": datetime.now(timezone.utc)
        })
        logger.info(f"Admin user created: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}}
        )
        logger.info("Admin password updated")
    
    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.signals.create_index("created_at")
    await db.signals.create_index([("lat", 1), ("lng", 1)])
    await db.parkings.create_index([("location", "2dsphere")])
    await db.gps_tracks.create_index([("user_id", 1), ("timestamp", -1)])
    
    # Write test credentials
    credentials_path = Path("/app/memory/test_credentials.md")
    credentials_path.parent.mkdir(parents=True, exist_ok=True)
    credentials_path.write_text(f"""# Test Credentials

## Admin Account
- Email: {admin_email}
- Password: {admin_password}
- Role: admin

## Auth Endpoints
- POST /api/auth/register - Register new user
- POST /api/auth/login - Login
- POST /api/auth/logout - Logout
- GET /api/auth/me - Get current user

## Signals Endpoints
- GET /api/signals - Get all signals
- POST /api/signals - Create signal
- POST /api/signals/{{id}}/vote - Vote on signal
- DELETE /api/signals/{{id}} - Delete signal
""")

@app.on_event("startup")
async def startup_event():
    await seed_admin()
    logger.info("Application started")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# Export socket app for uvicorn
app = socket_app

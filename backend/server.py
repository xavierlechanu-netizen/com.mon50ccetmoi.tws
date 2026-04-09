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
    type: str  # "police" or "danger"

class SignalResponse(BaseModel):
    id: str
    lat: float
    lng: float
    type: str
    upvotes: int
    downvotes: int
    user_id: str
    created_at: datetime

class VoteCreate(BaseModel):
    vote_type: str  # "up" or "down"

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

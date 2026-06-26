from contextlib import asynccontextmanager

from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from jose import JWTError
from sqlalchemy import select

from api.v1.router import api_router
from core.config import settings
from core.database import AsyncSessionLocal
from core.events import order_events
from core.security import verify_access_token
from models import User


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="CafeOS API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000", "http://127.0.0.1:3000"],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health")
async def health():
    return {"status": "ok", "cafe": settings.cafe_name}


@app.websocket("/ws/orders")
async def ws_orders(
    websocket: WebSocket,
    token: str | None = Query(None),
    order_id: int | None = Query(None),
):
    """Staff: ?token=JWT (all events). Customer tracking: ?order_id=123 (filtered)."""
    filter_order_id: int | None = None

    if token:
        try:
            payload = verify_access_token(token)
            user_id = int(payload["sub"])
        except (JWTError, KeyError, ValueError):
            await websocket.close(code=4401, reason="Invalid token")
            return

        async with AsyncSessionLocal() as db:
            result = await db.execute(select(User).where(User.id == user_id, User.is_active.is_(True)))
            user = result.scalar_one_or_none()
            if not user:
                await websocket.close(code=4401, reason="Unauthorized")
                return
    elif order_id is not None:
        filter_order_id = order_id
    else:
        await websocket.close(code=4401, reason="token or order_id required")
        return

    await order_events.connect(websocket, filter_order_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await order_events.disconnect(websocket)

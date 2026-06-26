import asyncio
import json
from typing import Any

from fastapi import WebSocket


class OrderEventHub:
    """In-process WebSocket broadcast hub (single worker). Redis can be added later."""

    def __init__(self) -> None:
        self._connections: dict[WebSocket, int | None] = {}
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, order_id: int | None = None) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections[websocket] = order_id

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            self._connections.pop(websocket, None)

    async def broadcast(self, payload: dict[str, Any]) -> None:
        message = json.dumps(payload, default=str)
        event_order_id = payload.get("order_id")
        async with self._lock:
            targets = list(self._connections.items())
        dead: list[WebSocket] = []
        for ws, filter_order_id in targets:
            if filter_order_id is not None and filter_order_id != event_order_id:
                continue
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            await self.disconnect(ws)


order_events = OrderEventHub()

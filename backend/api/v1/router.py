from fastapi import APIRouter

from api.v1 import auth, finance, inventory, kitchen, menu, orders, pos

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(menu.router)
api_router.include_router(orders.router)
api_router.include_router(pos.router)
api_router.include_router(kitchen.router)
api_router.include_router(inventory.router)
api_router.include_router(finance.router)

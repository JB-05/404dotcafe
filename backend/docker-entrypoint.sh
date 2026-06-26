#!/bin/sh
set -e
echo "Running database migrations..."
alembic upgrade head
echo "Seeding menu and inventory (no-op if already present)..."
python /scripts/seed_menu.py
python /scripts/seed_inventory.py
echo "Starting API..."
exec uvicorn main:app --host 0.0.0.0 --port 8000

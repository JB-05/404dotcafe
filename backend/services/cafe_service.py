from datetime import date, datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.cafe_session import CafeSession


async def get_active_session(db: AsyncSession, cafe_id: int) -> CafeSession | None:
    result = await db.execute(
        select(CafeSession).where(
            CafeSession.cafe_id == cafe_id,
            CafeSession.closed_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def is_accepting_orders(db: AsyncSession, cafe_id: int) -> bool:
    session = await get_active_session(db, cafe_id)
    return session is not None


async def get_status(db: AsyncSession, cafe_id: int) -> dict:
    session = await get_active_session(db, cafe_id)
    now = datetime.now(timezone.utc)
    if not session:
        return {
            "is_open": False,
            "opened_at": None,
            "opened_by_user_id": None,
            "current_session_seconds": 0,
        }
    elapsed = int((now - session.opened_at).total_seconds())
    return {
        "is_open": True,
        "session_id": session.id,
        "opened_at": session.opened_at.isoformat(),
        "opened_by_user_id": session.opened_by_user_id,
        "current_session_seconds": elapsed,
    }


async def open_cafe(db: AsyncSession, cafe_id: int, user_id: int) -> dict:
    existing = await get_active_session(db, cafe_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cafe is already open.",
        )
    session = CafeSession(
        cafe_id=cafe_id,
        opened_at=datetime.now(timezone.utc),
        opened_by_user_id=user_id,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return {
        "is_open": True,
        "session_id": session.id,
        "opened_at": session.opened_at.isoformat(),
        "opened_by_user_id": session.opened_by_user_id,
        "current_session_seconds": 0,
    }


async def close_cafe(db: AsyncSession, cafe_id: int, user_id: int) -> dict:
    session = await get_active_session(db, cafe_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cafe is not open.",
        )
    now = datetime.now(timezone.utc)
    session.closed_at = now
    session.closed_by_user_id = user_id
    await db.commit()
    duration = int((now - session.opened_at).total_seconds())
    return {
        "is_open": False,
        "session_id": session.id,
        "opened_at": session.opened_at.isoformat(),
        "closed_at": session.closed_at.isoformat(),
        "duration_seconds": duration,
    }


def _session_duration_seconds(session: CafeSession, now: datetime) -> int:
    end = session.closed_at or now
    return max(0, int((end - session.opened_at).total_seconds()))


async def get_operating_stats(db: AsyncSession, cafe_id: int) -> dict:
    result = await db.execute(
        select(CafeSession)
        .where(CafeSession.cafe_id == cafe_id)
        .order_by(CafeSession.opened_at.desc())
    )
    sessions = result.scalars().all()
    now = datetime.now(timezone.utc)
    total_seconds = sum(_session_duration_seconds(s, now) for s in sessions)
    active_days: set[date] = set()
    for s in sessions:
        start = s.opened_at.date()
        end = (s.closed_at or now).date()
        current = start
        while current <= end:
            active_days.add(current)
            current = date.fromordinal(current.toordinal() + 1)

    active = await get_active_session(db, cafe_id)
    return {
        "total_sessions": len(sessions),
        "days_active": len(active_days),
        "total_open_seconds": total_seconds,
        "total_open_hours": round(total_seconds / 3600, 1),
        "is_open": active is not None,
        "current_session_seconds": _session_duration_seconds(active, now) if active else 0,
    }


async def list_sessions(db: AsyncSession, cafe_id: int, limit: int = 30) -> list[dict]:
    limit = min(max(limit, 1), 100)
    result = await db.execute(
        select(CafeSession)
        .where(CafeSession.cafe_id == cafe_id)
        .order_by(CafeSession.opened_at.desc())
        .limit(limit)
    )
    now = datetime.now(timezone.utc)
    rows = []
    for s in result.scalars().all():
        duration = _session_duration_seconds(s, now)
        rows.append(
            {
                "id": s.id,
                "opened_at": s.opened_at.isoformat(),
                "closed_at": s.closed_at.isoformat() if s.closed_at else None,
                "opened_by_user_id": s.opened_by_user_id,
                "closed_by_user_id": s.closed_by_user_id,
                "duration_seconds": duration,
                "is_active": s.closed_at is None,
            }
        )
    return rows


async def require_accepting_orders(db: AsyncSession, cafe_id: int) -> None:
    if not await is_accepting_orders(db, cafe_id):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cafe is closed. Open the cafe from admin to accept orders.",
        )

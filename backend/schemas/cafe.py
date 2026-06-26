from pydantic import BaseModel


class CafeStatusResponse(BaseModel):
    is_open: bool
    session_id: int | None = None
    opened_at: str | None = None
    opened_by_user_id: int | None = None
    current_session_seconds: int = 0


class CafeSessionResponse(BaseModel):
    id: int
    opened_at: str
    closed_at: str | None
    opened_by_user_id: int
    closed_by_user_id: int | None
    duration_seconds: int
    is_active: bool


class CafeOperatingStatsResponse(BaseModel):
    total_sessions: int
    days_active: int
    total_open_seconds: int
    total_open_hours: float
    is_open: bool
    current_session_seconds: int

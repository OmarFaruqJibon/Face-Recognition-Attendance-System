# backend/app/scheduler.py
import asyncio
import datetime
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.db import db

scheduler = AsyncIOScheduler()

async def generate_attendance_for_date(target_date: datetime.date):
    """Aggregate presence_events for the given date into attendance_logs."""
    start = datetime.datetime.combine(target_date, datetime.time.min)
    end = start + datetime.timedelta(days=1)

    pipeline = [
        {"$match": {"entry_time": {"$gte": start, "$lt": end}, "duration_seconds": {"$exists": True}}},
        {"$group": {
            "_id": "$user_id",
            "total_duration": {"$sum": "$duration_seconds"},
            "first_seen": {"$min": "$entry_time"},
            "last_seen": {"$max": "$exit_time"},
        }}
    ]

    cursor = db.presence_events.aggregate(pipeline)
    async for row in cursor:
        doc = {
            "date": target_date.isoformat(),
            "user_id": row["_id"],
            "total_duration_seconds": row["total_duration"],
            "first_seen": row["first_seen"],
            "last_seen": row["last_seen"],
            "created_at": datetime.datetime.utcnow(),
        }
        await db.attendance_logs.insert_one(doc)

def start_scheduler():
    if not scheduler.running:
        scheduler.add_job(
            lambda: asyncio.create_task(
                generate_attendance_for_date(datetime.date.today() - datetime.timedelta(days=1))
            ),
            "cron", hour=0, minute=5
        )
        scheduler.start()

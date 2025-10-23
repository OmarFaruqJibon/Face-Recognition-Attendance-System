import asyncio
import datetime
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.db import db
from bson import ObjectId

scheduler = AsyncIOScheduler()


async def generate_attendance_for_date(target_date: datetime.date):
    """Aggregate presence_events for the given date into attendance_logs."""
    start = datetime.datetime.combine(target_date, datetime.time.min)
    end = start + datetime.timedelta(days=1)

    pipeline = [
        {
            "$match": {
                "entry_time": {"$gte": start, "$lt": end},
                "duration_seconds": {"$exists": True}
            }
        },
        {
            "$group": {
                "_id": "$user_id",
                "total_duration": {"$sum": "$duration_seconds"},
                "first_seen": {"$min": "$entry_time"},
                "last_seen": {"$max": "$exit_time"},
            }
        },
    ]

    cursor = db.presence_events.aggregate(pipeline)
    async for row in cursor:
        user_id_value = row["_id"]

        # ✅ Normalize user_id to ObjectId for consistency
        if isinstance(user_id_value, ObjectId):
            user_id_obj = user_id_value
        else:
            try:
                user_id_obj = ObjectId(user_id_value)
            except Exception:
                # fallback for malformed IDs
                continue

        doc = {
            "date": target_date.isoformat(),
            "user_id": user_id_obj,
            "total_duration_seconds": row.get("total_duration", 0),
            "first_seen": row.get("first_seen"),
            "last_seen": row.get("last_seen"),
            "created_at": datetime.datetime.utcnow(),
        }

        # ✅ Use upsert to prevent duplicates
        await db.attendance_logs.update_one(
            {"date": target_date.isoformat(), "user_id": user_id_obj},
            {"$set": doc},
            upsert=True
        )


def start_scheduler():
    """Start nightly attendance aggregation job."""
    if not scheduler.running:
        scheduler.add_job(
            lambda: asyncio.create_task(
                generate_attendance_for_date(
                    datetime.date.today() - datetime.timedelta(days=1)
                )
            ),
            "cron",
            hour=0,
            minute=5,
        )
        scheduler.start()

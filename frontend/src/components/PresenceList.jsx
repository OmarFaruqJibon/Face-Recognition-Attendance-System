// src/components/PresenceList.jsx

import React, { useEffect, useState } from "react";
import { fetchPresence } from "../api/apiClient";
import dayjs from "dayjs";

export default function PresenceList() {
  const [events, setEvents] = useState([]);
  useEffect(() => {
    fetchPresence().then(setEvents).catch(console.warn);
  }, []);
  return (
    <section className="bg-white p-4 rounded shadow mt-4">
      <h3 className="font-semibold mb-2">Recent Presence Events</h3>
      <div className="space-y-2 h-48 overflow-auto">
        {events.map((e) => (
          <div key={e._id} className="flex items-center gap-3">
            <div className="flex-1">
              <div className="text-sm">
                {e.user_id ? `User ${e.user_id}` : "Unknown"}
              </div>
              <div className="text-xs text-gray-500">
                Entry: {dayjs(e.entry_time).format("YYYY-MM-DD HH:mm:ss")}
              </div>
            </div>
            <div className="text-sm">
              {e.duration_seconds ? `${Math.round(e.duration_seconds)}s` : "-"}
            </div>
          </div>
        ))}
        {events.length === 0 && (
          <div className="text-sm text-gray-500">No events yet</div>
        )}
      </div>
    </section>
  );
}

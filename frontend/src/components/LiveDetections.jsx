//LiveDetection.jsx

import React from "react";
import dayjs from "dayjs";

export default function LiveDetections({ liveMap = {}, users = [] }) {
  const items = Object.values(liveMap).sort(
    (a, b) => new Date(b.last_seen) - new Date(a.last_seen)
  );
  // helper to map user_id to name
  const userMap = Object.fromEntries(users.map((u) => [u._id, u]));

  return (
    <section className="bg-white p-4 rounded shadow mb-4">
      <h2 className="text-lg font-semibold mb-2">Live Detections</h2>
      <div className="grid grid-cols-3 gap-4">
        {items.length === 0 && (
          <div className="col-span-3 text-gray-500">
            No one detected right now.
          </div>
        )}
        {items.map((it) => {
          const isKnown = it.type === "known";
          const name = isKnown
            ? userMap[it.id]?.name || `User ${it.id.slice(-4)}`
            : "Unknown";
          const lastSeen = dayjs(it.last_seen).format("HH:mm:ss");
          const entry = dayjs(it.entry_time);
          const duration = Math.floor(
            (new Date(it.last_seen) - new Date(it.entry_time)) / 1000
          );
          return (
            <div key={`${it.type}:${it.id}`} className="bg-gray-50 p-2 rounded">
              <img
                src={`${import.meta.env.VITE_API_BASE}${it.snapshot}`}
                className="w-full h-32 object-cover rounded snapshot"
                alt="snapshot"
              />
              <div className="mt-2">
                <div className="font-medium">
                  {name}{" "}
                  {isKnown ? (
                    ""
                  ) : (
                    <span className="text-xs text-red-600">unknown</span>
                  )}
                </div>
                <div className="text-xs text-gray-500">last: {lastSeen}</div>
                <div className="text-sm">{duration}s</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

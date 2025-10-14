// src/components/LiveDetections.jsx
import React from "react";
import dayjs from "dayjs";

export default function LiveDetections({ liveMap = {}, users = [] }) {
  const BANGLADESH_OFFSET = 6 * 60 * 60 * 1000;

  // keep only known users, then sort by last_seen
  const items = Object.values(liveMap)
    .filter((it) => it.type === "known")
    .sort((a, b) => new Date(b.last_seen) - new Date(a.last_seen));

  const userMap = Object.fromEntries(users.map((u) => [u._id, u]));

  return (
    <section className="bg-white p-4 rounded shadow mb-4">
      <h2 className="text-lg font-semibold mb-2">Live Camera</h2>
      <div className="w-full mb-4">
        <img
          src={`${import.meta.env.VITE_API_BASE}/video_feed`}
          alt="live stream"
          className="w-full  object-cover rounded border" //SET HEIGHT IF NEED h-92
        />
      </div>

      <h2 className="text-lg font-semibold mb-2">Detection Info</h2>
      <div className="grid grid-cols-3 gap-4">
        {items.length === 0 && (
          <div className="col-span-3 text-gray-500">
            No one detected right now.
          </div>
        )}
        {items.map((it) => {
          const name = userMap[it.id]?.name || `User ${it.id.slice(-4)}`;
          const lastSeen = dayjs(it.last_seen + BANGLADESH_OFFSET).format(
            "HH:mm:ss"
          );
          const duration = Math.floor(
            (new Date(it.last_seen).getTime() -
              new Date(it.entry_time).getTime()) /
              1000
          );
          return (
            <div key={`${it.type}:${it.id}`} className="bg-gray-50 p-2 rounded">
              <div className="mt-2">
                <div className="font-medium">{name}</div>
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

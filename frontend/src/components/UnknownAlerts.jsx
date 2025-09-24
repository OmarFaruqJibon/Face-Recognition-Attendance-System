import React, { useState } from "react";
import dayjs from "dayjs";
import { ignoreUnknown } from "../api/apiClient";

export default function UnknownAlerts({
  unknownQueue = [],
  onApprove,
  onIgnore,
}) {
  const [editing, setEditing] = useState(null);
  const latest = unknownQueue[0];

  async function handleIgnore(unknownId) {
    try {
      await ignoreUnknown(unknownId);
      onIgnore && onIgnore(unknownId);
    } catch (e) {
      alert("Ignore failed: " + e.message);
    }
  }

  return (
    <section className="bg-white p-4 rounded shadow">
      <h3 className="font-semibold mb-2">Unknown Alerts</h3>
      {!latest && (
        <div className="text-sm text-gray-500">No recent unknowns</div>
      )}
      {latest && (
        <div className="flex gap-3 items-start">
          <img
            src={`${import.meta.env.VITE_API_BASE || ""}${latest.image_path}`}
            alt="unk"
            className="w-24 h-24 object-cover rounded snapshot"
          />
          <div className="flex-1">
            <div className="mb-1 text-sm text-gray-600">
              {dayjs(latest.first_seen).format("YYYY-MM-DD HH:mm:ss")}
            </div>
            <div className="flex gap-2">
              <button
                className="px-1.5 py-1 bg-green-700 text-white rounded"
                onClick={() => {
                  const name = prompt("Name for this user?");
                  if (name) onApprove(latest.unknown_id, name);
                }}
              >
                Approve
              </button>
              <button
                className="px-1.5 py-1 bg-orange-700 text-white rounded"
                onClick={() => handleIgnore(latest.unknown_id)}
              >
                Ignore
              </button>
            </div>
          </div>
        </div>
      )}
      {/* list of recent */}
      <div className="mt-3 h-40 overflow-auto">
        {unknownQueue.map((u) => (
          <div
            key={u.unknown_id}
            className="flex items-center gap-2 p-1 border-b"
          >
            <img
              src={`${import.meta.env.VITE_API_BASE || ""}${u.image_path}`}
              alt="s"
              className="w-12 h-12 object-cover rounded snapshot"
            />
            <div className="flex-1">
              <div className="text-sm">ID: {u.unknown_id}</div>
              <div className="text-xs text-gray-500">
                {dayjs(u.first_seen).format("HH:mm:ss")}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                className="text-sm px-2 py-1 bg-indigo-600 text-white rounded"
                onClick={() => {
                  const name = prompt("Name?");
                  if (name) onApprove(u.unknown_id, name);
                }}
              >
                Approve
              </button>
              <button
                className="text-sm px-2 py-1 bg-orange-700 text-white rounded"
                onClick={() => handleIgnore(u.unknown_id)}
              >
                Ignore
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

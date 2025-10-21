import React, { useEffect, useState } from "react";
import { getRestrictedSettings, updateRestrictedSettings } from "../api/apiClient";

export default function RestrictedHours() {
  const [enabled, setEnabled] = useState(false);
  const [start, setStart] = useState("22:00");
  const [end, setEnd] = useState("06:00");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRestrictedSettings().then((data) => {
      if (data) {
        setEnabled(data.enabled);
        setStart(data.start_time);
        setEnd(data.end_time);
      }
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    await updateRestrictedSettings({
      enabled,
      start_time: start,
      end_time: end,
    });
    alert("Restricted hours updated successfully!");
  };

  // if (loading) return <p>Loading...</p>;

  return (
    <div className="p-4 rounded-2xl shadow-md bg-gray-900 backdrop-blur-md">
      <h2 className="text-xl font-bold mb-3 text-white">Restricted Hours</h2>
      <label className="flex items-center mb-3">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="mr-2"
        />
        <span className="text-white">Enable Restricted Hours</span>
      </label>

      <div className="flex gap-4 mb-3">
        <div>
          <label className="text-white block text-sm mb-1">Start Time</label>
          <input
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="bg-gray-800 text-white rounded p-2"
          />
        </div>
        <div>
          <label className="text-white block text-sm mb-1">End Time</label>
          <input
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="bg-gray-800 text-white rounded p-2"
          />
        </div>
      </div>

      <button
        onClick={handleSave}
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl"
      >
        Save
      </button>
    </div>
  );
}

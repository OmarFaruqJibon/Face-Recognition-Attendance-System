// src/pages/Dashboard.jsx

import React, { useCallback, useEffect, useState, useRef } from "react";
import useWebsocket from "../hooks/useWebsocket";
import {
  fetchUsers,
  fetchUnknowns,
  fetchPresence,
  approveUnknown,
  generateAttendance,
  markAsBad,
  ignoreUnknown,
  getBadPeople,
} from "../api/apiClient";
import LiveDetections from "../components/LiveDetections";
import UnknownAlerts from "../components/UnknownAlerts";
import UserManagement from "../components/UserManagement";
import PresenceList from "../components/PresenceList";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import BadPeopleManagement from "../components/BadPeopleManagement";

const WS_URL =
  (import.meta.env.VITE_WS_BASE || "ws://localhost:8000") + "/ws/stream";

export default function Dashboard() {
  dayjs.extend(timezone);
  const [liveMap, setLiveMap] = useState({});
  const [unknownQueue, setUnknownQueue] = useState([]);
  const [users, setUsers] = useState([]);
  const [badPeople, setBadPeople] = useState([]);
  const wsRef = useRef(null);

  // 🧩 Handle messages from WebSocket
  const handleWsMessage = useCallback((msg) => {
    if (!msg || !msg.type) return;

    if (msg.type === "known") {
      const id = msg.user_id;
      setLiveMap((prev) => {
        const prevEntry = prev["known:" + id] || {};
        return {
          ...prev,
          ["known:" + id]: {
            type: "known",
            id,
            entry_time: prevEntry.entry_time || msg.first_seen,
            last_seen: msg.last_seen || msg.first_seen,
            snapshot: prevEntry.snapshot || msg.snapshot,
            name: prevEntry.name || msg.name || null,
          },
        };
      });
    } else if (msg.type === "unknown") {
      const id = msg.unknown_id;
      setLiveMap((prev) => ({
        ...prev,
        ["unknown:" + id]: {
          type: "unknown",
          id,
          entry_time: msg.first_seen,
          last_seen: msg.first_seen,
          snapshot: msg.image_path,
        },
      }));
      setUnknownQueue((q) => [
        {
          unknown_id: id,
          image_path: msg.image_path,
          first_seen: msg.first_seen,
        },
        ...q,
      ]);
    } else if (msg.type === "presence_end") {
      const keyPrefix =
        msg.id && msg.id.length === 24
          ? "known:" + msg.id
          : "unknown:" + msg.id;
      setLiveMap((prev) => {
        const copy = { ...prev };
        delete copy[keyPrefix];
        return copy;
      });
    } else if (msg.type === "alert_bad" || msg.type === "alert_bad_update") {
      // Optionally handle bad person alerts
    }
  }, []);

  // 🧠 Connect WebSocket
  const ws = useWebsocket({ url: WS_URL, onMessage: handleWsMessage });
  useEffect(() => {
    wsRef.current = ws.current;
  }, [ws]);

  // 💓 Heartbeat ping every 20 seconds
  useEffect(() => {
    const iv = setInterval(() => {
      try {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send("ping");
        }
      } catch (e) {
        console.error(e);
      }
    }, 20000);
    return () => clearInterval(iv);
  }, []);

  // 📥 Initial data load
  useEffect(() => {
    fetchUsers().then(setUsers).catch(console.warn);
    fetchUnknowns().then(setUnknownQueue).catch(console.warn);
    fetchPresence().catch(console.warn);
    getBadPeople().then(setBadPeople).catch(console.warn);
  }, []);

  //    useEffect(() => {
  //     getBadPeople().then(setBadPeople);
  //   }, []);

  // 🔄 Refresh unknowns helper
  async function refreshUnknowns() {
    try {
      const updated = await fetchUnknowns();
      setUnknownQueue(updated);
    } catch (err) {
      console.error("Failed to refresh unknowns:", err);
    }
  }

  // ✅ Approve unknown
  async function handleApproveUnknown(unknownId, name, note) {
    try {
      await approveUnknown(unknownId, name, note);
      await refreshUnknowns();
      const u = await fetchUsers();
      setUsers(u);
      setLiveMap((prev) => {
        const copy = { ...prev };
        delete copy["unknown:" + unknownId];
        return copy;
      });
    } catch (e) {
      console.error(e);
      alert("Approve failed: " + e.message);
    }
  }

  // 🚫 Mark as bad
  async function handleMarkAsBad(unknownId, name, reason) {
    try {
      await markAsBad(unknownId, name, reason);
      await refreshUnknowns();
      setLiveMap((prev) => {
        const copy = { ...prev };
        delete copy["unknown:" + unknownId];
        return copy;
      });
    } catch (e) {
      console.error(e);
      alert("Mark as bad failed: " + e.message);
    }
  }

  // 🕊️ Ignore unknown
  async function handleIgnoreUnknown(unknownId) {
    try {
      await ignoreUnknown(unknownId);
    } catch (e) {
      if (e.response?.status === 404) {
        console.warn("Unknown already removed, cleaning up anyway");
      } else {
        console.error(e);
        alert("Ignore failed: " + e.message);
        return;
      }
    }

    await refreshUnknowns();
    setLiveMap((prev) => {
      const copy = { ...prev };
      delete copy["unknown:" + unknownId];
      return copy;
    });
  }

  // 📅 Manual attendance generation
  async function handleGenerateAttendance(date) {
    const dateStr = dayjs(date).tz("Asia/Dhaka").format("YYYY-MM-DD");
    await generateAttendance(dateStr);
    alert("Attendance generation triggered for " + dateStr);
  }

  // 🕓 Optional: Auto-refresh unknowns every 10s
  /*
    useEffect(() => {
        const interval = setInterval(refreshUnknowns, 10000);
        return () => clearInterval(interval);
    }, []);
    */

  // 🧭 UI

  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-8">
        <LiveDetections liveMap={liveMap} users={users} />
        <PresenceList />
      </div>

      <div className="col-span-4 space-y-4">
        <UnknownAlerts
          unknownQueue={unknownQueue}
          onApprove={handleApproveUnknown}
          onMarkAsBad={handleMarkAsBad}
          onIgnore={handleIgnoreUnknown}
        />

        <UserManagement users={users} onUsersChanged={setUsers} />

        <BadPeopleManagement
          badPeople={badPeople}
          onBadPeopleChanged={setBadPeople}
        />

        {/* Optional Admin Panel */}
        {/* 
                <div className="bg-white p-4 rounded shadow">
                    <h3 className="font-semibold mb-2">Admin</h3>
                    <button
                        onClick={() => handleGenerateAttendance(new Date())}
                        className="px-3 py-2 bg-gray-900 text-white rounded"
                    >
                        Generate Today Attendance
                    </button>
                    <button
                        onClick={() => fetchUsers().then(setUsers)}
                        className="ml-2 px-3 py-2 border rounded"
                    >
                        Reload Users
                    </button>
                </div>
                */}
      </div>
    </div>
  );
}

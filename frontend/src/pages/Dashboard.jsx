// src/pages/Dashboard.jsx

import React, { useCallback, useEffect, useState, useRef } from "react";
import useWebsocket from "../hooks/useWebsocket";
import {
  fetchUsers,
  fetchUnknowns,
  fetchPresence,
  approveUnknown,
  generateAttendance,
} from "../api/apiClient";
import LiveDetections from "../components/LiveDetections";
import UnknownAlerts from "../components/UnknownAlerts";
import UserManagement from "../components/UserManagement";
import PresenceList from "../components/PresenceList";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";

const WS_URL =
  (import.meta.env.VITE_WS_BASE || "ws://localhost:8000") + "/ws/stream";

export default function Dashboard() {
  dayjs.extend(timezone);
  const [liveMap, setLiveMap] = useState({}); // key -> info { type: 'known'|'unknown', id, entry_time, last_seen, snapshot, name? }
  const [unknownQueue, setUnknownQueue] = useState([]);
  const [users, setUsers] = useState([]);
  const wsRef = useRef(null);

  const handleWsMessage = useCallback((msg) => {
    // backend sends different message types:
    // "known": {type:'known', user_id, first_seen, last_seen?, snapshot}
    // "unknown": {type:'unknown', unknown_id, image_path, first_seen}
    // "presence_end": {type:'presence_end', id, duration_seconds, exit_time}
    if (!msg || !msg.type) return;
    if (msg.type === "known") {
      const id = msg.user_id;
      setLiveMap((prev) => {
        const prevEntry = prev["known:" + id] || {};
        const entry_time = prevEntry.entry_time || msg.first_seen;
        const last_seen = msg.last_seen || msg.first_seen;
        const snapshot = prevEntry.snapshot || msg.snapshot;
        const name = prevEntry.name || null;
        return {
          ...prev,
          ["known:" + id]: {
            type: "known",
            id,
            entry_time,
            last_seen,
            snapshot,
            name,
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
      // remove the live map entry
      const keyPrefix =
        msg.id && msg.id.length === 24
          ? "known:" + msg.id
          : "unknown:" + msg.id;
      setLiveMap((prev) => {
        const copy = { ...prev };
        delete copy[keyPrefix];
        return copy;
      });
    }
  }, []);

  // connect WS
  const ws = useWebsocket({ url: WS_URL, onMessage: handleWsMessage });
  useEffect(() => {
    wsRef.current = ws.current;
  }, [ws]);

  // heartbeat ping (backend waits on receive_text)
  useEffect(() => {
    const iv = setInterval(() => {
      try {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send("ping");
        }
      } catch (e) {
        print(e);
      }
    }, 20000);
    return () => clearInterval(iv);
  }, []);

  // load initial lists
  useEffect(() => {
    fetchUsers().then(setUsers).catch(console.warn);
    fetchUnknowns().then(setUnknownQueue).catch(console.warn);
    fetchPresence().catch(console.warn); // optional
  }, []);

  async function handleApproveUnknown(unknownId, name) {
    try {
      await approveUnknown(unknownId, name);
      // reload users
      const u = await fetchUsers();
      setUsers(u);
      setUnknownQueue((q) => q.filter((x) => x.unknown_id !== unknownId));
      // cleanup liveMap
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

  async function handleGenerateAttendance(date) {
    const dateStr = dayjs(date).tz("Asia/Dhaka").format("YYYY-MM-DD");
    await generateAttendance(dateStr);
    alert("Attendance generation triggered for " + dateStr);
  }

  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-8">
        <LiveDetections liveMap={liveMap} users={users} />
        <PresenceList />
      </div>
      <div className="col-span-4 space-y-4">
        {/* <UnknownAlerts
          unknownQueue={unknownQueue}
          onApprove={handleApproveUnknown}
        /> */}

        <UnknownAlerts
          unknownQueue={unknownQueue}
          onApprove={handleApproveUnknown}
          onIgnore={(unknownId) => {
            setUnknownQueue((q) => q.filter((x) => x.unknown_id !== unknownId));
            setLiveMap((prev) => {
              const copy = { ...prev };
              delete copy["unknown:" + unknownId];
              return copy;
            });
          }}
        />
        <UserManagement users={users} onUsersChanged={setUsers} />

        {/* <div className="bg-white p-4 rounded shadow">
          <h3 className="font-semibold mb-2">Admin</h3>
          <button
            onClick={() => handleGenerateAttendance(new Date())}
            className="px-3 py-2 bg-gray-900 text-white rounded"
          >
            Generate Today Attendance
          </button>
          <button
            onClick={() => {
              fetchUsers().then(setUsers);
            }}
            className="ml-2 px-3 py-2 border rounded"
          >
            Reload Users
          </button>
        </div> */}
      </div>
    </div>
  );
}

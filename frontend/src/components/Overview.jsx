import React, { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { Users, UserCheck, AlertTriangle, Clock } from "lucide-react";
import {
  fetchUsers,
  fetchPresence,
  fetchUnknowns,
  getBadPeople,
} from "../api/apiClient";
import dayjs from "dayjs";

export default function Overview() {
  const [users, setUsers] = useState([]);
  const [presenceEvents, setPresenceEvents] = useState([]);
  const [badPeople, setBadPeople] = useState([]);
  const [unknownPeople, setUnknownPeople] = useState([]);
  const [topActive, setTopActive] = useState([]);
  const [weeklyTrend, setWeeklyTrend] = useState([]);

  useEffect(() => {
    loadAllData();
  }, []);

  async function loadAllData() {
    try {
      const [usersData, presenceData, badData, unknownData] = await Promise.all([
        fetchUsers(),
        fetchPresence(),
        getBadPeople(),
        fetchUnknowns(),
      ]);

      setUsers(usersData);
      setPresenceEvents(presenceData);
      setBadPeople(badData);
      setUnknownPeople(unknownData);

      computeTopActiveUsers(presenceData, usersData);
      computeWeeklyTrend(presenceData);
    } catch (err) {
      console.error("Failed to load data:", err);
    }
  }

// 🔹 Compute top active users (last 7 days by total duration)
function computeTopActiveUsers(presence, users) {
  const sevenDaysAgo = dayjs().subtract(7, "day");
  const recent = presence.filter((p) => dayjs(p.entry_time).isAfter(sevenDaysAgo));

  const durations = {};
  for (const p of recent) {
    const id = p.user_id?._id || p.user_id || "unknown";
    const dur = p.duration_seconds || 0;
    durations[id] = (durations[id] || 0) + dur;
  }

  const data = Object.entries(durations)
    .map(([id, totalSeconds]) => {
      const user = users.find((u) => u._id === id);
      return {
        name: user ? user.name || "Unnamed" : "Unknown",
        durationHours: (totalSeconds / 3600).toFixed(2), // convert to hours
      };
    })
    .sort((a, b) => b.durationHours - a.durationHours)
    .slice(0, 5); // Top 5 by duration

  setTopActive(data);
}


  // 🔹 Compute weekly attendance trend (distinct users per day)
  function computeWeeklyTrend(presence) {
    const days = [...Array(7).keys()].map((i) =>
      dayjs().subtract(6 - i, "day").format("YYYY-MM-DD")
    );

    const trend = days.map((date) => {
      const usersToday = new Set(
        presence
          .filter((p) => dayjs(p.entry_time).format("YYYY-MM-DD") === date)
          .map((p) => p.user_id)
      );
      return { date: dayjs(date).format("ddd"), present: usersToday.size };
    });

    setWeeklyTrend(trend);
  }

  const presentToday = new Set(
    presenceEvents
      .filter((e) => dayjs(e.entry_time).isSame(dayjs(), "day"))
      .map((e) => e.user_id)
  ).size;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-800">Overview</h1>
        <p className="text-gray-500">Summary of today's activity and trends</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card
          icon={<Users className="text-blue-500" />}
          title="Total Users"
          value={users.length}
        />
        <Card
          icon={<UserCheck className="text-green-500" />}
          title="Present Today"
          value={presentToday}
        />
        <Card
          icon={<AlertTriangle className="text-yellow-500" />}
          title="Unknown Detections"
          value={unknownPeople.length}
        />
        <Card
          icon={<Clock className="text-red-500" />}
          title="Bad People"
          value={badPeople.length}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Line Chart */}
        <div className="bg-gray-50 p-4 rounded-xl shadow-sm">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">
            Attendance Trend (Last 7 Days)
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={weeklyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="date" stroke="#6B7280" />
              <YAxis stroke="#6B7280" />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="present"
                stroke="#3B82F6"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Bar Chart - Top Active Users */}
        <div className="bg-gray-50 p-4 rounded-xl shadow-sm">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">
            Top Active Users (This Week)
          </h2>
<ResponsiveContainer width="100%" height={250}>
  <BarChart
    data={topActive}
    layout="vertical"
    margin={{ top: 10, right: 20, left: 40, bottom: 10 }}
  >
    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
    <XAxis
      type="number"
      label={{ value: "Hours", position: "insideBottom", offset: -5 }}
    />
    <YAxis type="category" dataKey="name" />
    <Tooltip formatter={(val) => [`${val} hrs`, "Total Duration"]} />
    <Legend />
    <Bar
      dataKey="durationHours"
      fill="#10B981"
      barSize={20}
      name="Total Duration (hrs)"
    />
  </BarChart>
</ResponsiveContainer>

        </div>
      </div>
    </div>
  );
}

function Card({ icon, title, value }) {
  return (
    <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-xl shadow-sm hover:shadow-md transition">
      <div className="p-3 bg-white rounded-full shadow">{icon}</div>
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-xl font-semibold text-gray-800">{value}</p>
      </div>
    </div>
  );
}

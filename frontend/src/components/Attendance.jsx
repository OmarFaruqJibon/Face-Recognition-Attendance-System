// frontend\src\components\Attendance.jsx
import React, { useState, useEffect } from "react";
import { Download, Calendar } from "lucide-react";
import { generateAttendance } from "../api/apiClient";

export default function Attendance() {
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchAttendance = async (selectedDate) => {
    setLoading(true);
    try {
      const data = await generateAttendance(selectedDate);
      setAttendance(data);
    } catch (err) {
      console.error("Failed to load attendance:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance(date);
  }, [date]);

  const formatDuration = (seconds) => {
    if (!seconds && seconds !== 0) return "-";
    const totalSeconds = Math.floor(seconds);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h}h ${m}m ${s}s`;
  };

  const handleDownloadCSV = () => {
    if (attendance.length === 0) return;

    const headers = ["date", "user_name", "total_duration"];
    const csvRows = [
      headers.join(","),
      ...attendance.map((row) => {
        const totalDuration = formatDuration(row.total_duration_seconds);
        return [row.date, row.user_name, totalDuration].join(",");
      }),
    ];

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance_${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  console.log(attendance)

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-wrap justify-between items-center">
        <h2 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
          <Calendar className="text-blue-600" /> Attendance Logs
        </h2>
        <div className="flex flex-wrap items-center gap-3 mt-2 sm:mt-0">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <button
            onClick={handleDownloadCSV}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            <Download size={16} /> Download CSV
          </button>
        </div>
      </div>

      {/* Attendance Grid */}
      {loading ? (
        <p className="text-gray-500">Loading attendance...</p>
      ) : !attendance || attendance.length === 0 ? (
        <p className="text-gray-500">No attendance found for this date.</p>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {attendance.map((row, i) => (
            <div
              key={i}
              className="bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md transition-all p-5"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-500">{row.date}</span>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                  #{i + 1}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-1">
                {row.user_name || "Unknown User"}
              </h3>
              <p className="text-gray-700 text-sm">
                <span className="font-medium text-gray-900">Duration: </span>
                {formatDuration(row.total_duration_seconds)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

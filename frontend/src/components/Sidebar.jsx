// src/components/Sidebar.jsx
import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  AlertTriangle,
  Clock,
  UserX,
  UserCheck,
  CalendarCheck,
} from "lucide-react";

export default function Sidebar() {
  const location = useLocation();

  const menuItems = [
    {
  name: "Overview",
  icon: <LayoutDashboard size={18} />,
  path: "/dashboard/overview",
},
    {
      name: "User Management",
      icon: <Users size={18} />,
      path: "/dashboard/users",
    },
    {
      name: "Presence List",
      icon: <UserCheck size={18} />,
      path: "/dashboard/presence",
    },
      {
    name: "Attendance",
    icon: <CalendarCheck size={18} />,
    path: "/dashboard/attendance",
  },
    {
      name: "Bad People",
      icon: <UserX size={18} />,
      path: "/dashboard/badpeople",
    },
    {
      name: "Restricted Hours",
      icon: <Clock size={18} />,
      path: "/dashboard/restricted",
    },
  ];

  return (
    <aside className="w-60 bg-gray-900 text-gray-100 min-h-[calc(100vh-80px)] rounded-xl shadow-md p-4">
      <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
        Dashboard
      </h2>
      <nav className="space-y-2">
        {menuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition ${
              location.pathname === item.path
                ? "bg-blue-600 text-white"
                : "hover:bg-gray-800"
            }`}
          >
            {item.icon}
            <span>{item.name}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}

import React from "react";
import { Link } from "react-router-dom";

export default function Header() {
  const navItems = [
    // { label: "Home", path: "/" },
    { label: "Dashboard", path: "/dashboard" },
  ];

  return (
    <header className="bg-gray-900 text-white shadow p-4 mb-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link to="/">
          <h1 className="text-xl font-semibold">Face Recognition</h1>
        </Link>

        <nav className="flex gap-6">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className="text-sm font-medium bg-blue-700 text-white hover:bg-blue-400 px-2 py-2 rounded"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

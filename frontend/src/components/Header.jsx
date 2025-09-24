//Header.jsx

import React from "react";

export default function Header() {
  return (
    <header className="bg-white shadow p-4 mb-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <h1 className="text-xl font-semibold">Face Recognition Dashboard</h1>
        <div className="text-sm text-gray-600">Live • Realtime</div>
      </div>
    </header>
  );
}

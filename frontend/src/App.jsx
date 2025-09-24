import React from "react";
import Dashboard from "./pages/Dashboard";
import Header from "./components/Header";

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="p-4 max-w-7xl mx-auto">
        <Dashboard />
      </main>
    </div>
  );
}

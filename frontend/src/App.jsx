import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import Livestream from "./pages/Livestream";
import Dashboard from "./pages/Dashboard";

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="p-4 max-w-7xl mx-auto">
          <Routes>
            <Route path="/" element={<Livestream />} />
            <Route path="/dashboard/*" element={<Dashboard />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

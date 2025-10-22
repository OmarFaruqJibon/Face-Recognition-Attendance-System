import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import PresenceList from "../components/PresenceList";
import UnknownAlerts from "../components/UnknownAlerts";
import UserManagement from "../components/UserManagement";
import BadPeopleManagement from "../components/BadPeopleManagement";
import RestrictedHours from "../components/RestrictedHours";
import Overview from "../components/Overview";

export default function Dashboard() {
  return (
    <div className="flex gap-6">
      <Sidebar />

      <div className="flex-1 bg-white p-6 rounded-xl shadow">
        <Routes>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<Overview />} />
          <Route path="presence" element={<PresenceList />} />
          <Route path="unknowns" element={<UnknownAlerts />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="badpeople" element={<BadPeopleManagement />} />
          <Route path="restricted" element={<RestrictedHours />} />
          <Route
            path="*"
            element={<p className="text-gray-500">Page not found</p>}
          />
        </Routes>
      </div>
    </div>
  );
}

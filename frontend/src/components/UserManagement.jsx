// UserManagement.jsx

import React from "react";
import { deleteUser } from "../api/apiClient";

export default function UserManagement({ users = [], onUsersChanged }) {
  async function handleDelete(id) {
    if (!confirm("Delete user?")) return;
    try {
      await deleteUser(id);
      onUsersChanged && onUsersChanged(users.filter((u) => u._id !== id));
    } catch (e) {
      alert("delete failed " + e);
    }
  }

  return (
    <section className="bg-white p-4 rounded shadow">
      <h3 className="font-semibold mb-2">Users ({users.length})</h3>
      <div className="h-56 overflow-auto">
        {users.map((u) => (
          <div className="flex items-center gap-3 p-2 border-b" key={u._id}>
            <img
              src={`${import.meta.env.VITE_API_BASE}${u.image_path}`}
              alt={u.name}
              className="w-12 h-12 object-cover rounded snapshot"
            />
            <div className="flex-1">
              <div className="font-medium">{u.name}</div>
              <div className="text-xs text-gray-500">id: {u._id}</div>
            </div>
            <button
              onClick={() => handleDelete(u._id)}
              className="px-2 py-1 border rounded text-sm"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

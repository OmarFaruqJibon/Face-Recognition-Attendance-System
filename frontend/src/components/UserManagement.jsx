import React, { useState } from "react";
import { Trash2, UserCircle2 } from "lucide-react";
import { deleteUser } from "../api/apiClient";

export default function UserManagement({ users = [], onUsersChanged }) {
  const [selectedUser, setSelectedUser] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);

  function openDeleteModal(user) {
    setSelectedUser(user);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setSelectedUser(null);
  }

  async function handleDeleteConfirm() {
    if (!selectedUser) return;
    setLoading(true);
    try {
      await deleteUser(selectedUser._id);
      onUsersChanged && onUsersChanged(users.filter((u) => u._id !== selectedUser._id));
      closeModal();
    } catch (e) {
      alert("Delete failed: " + (e.response?.data?.detail || e.message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="bg-white p-6 rounded-2xl shadow-md border border-gray-100">
      <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
        User Management
        <span className="ml-1 text-sm text-gray-500">({users.length})</span>
      </h3>

      <div className="overflow-y-auto max-h-[420px] divide-y divide-gray-100">
        {users.length === 0 ? (
          <div className="text-gray-500 text-center py-8 text-sm">
            No users found.
          </div>
        ) : (
          users.map((u) => (
            <div
              key={u._id}
              className="flex items-center justify-between p-3 hover:bg-gray-50 transition"
            >
              <div className="flex items-center gap-3">
                <img
                  src={`${import.meta.env.VITE_API_BASE}${u.image_path}`}
                  alt={u.name}
                  className="w-12 h-12 rounded-full object-cover border border-gray-200 shadow-sm"
                />
                <div>
                  <div className="font-medium text-gray-800">{u.name}</div>
                  <div className="text-xs text-gray-500 truncate max-w-[160px]">
                    ID: {u._id}
                  </div>
                </div>
              </div>

              <button
                onClick={() => openDeleteModal(u)}
                className="flex items-center cursor-pointer gap-1 text-red-800 hover:text-white hover:bg-red-600 border border-red-500 transition px-3 py-1.5 rounded-md text-sm font-medium"
              >
                <Trash2 size={16} />
                
              </button>
            </div>
          ))
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showModal && selectedUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg w-[360px] p-6 relative">
            <h4 className="text-lg font-semibold text-gray-800 mb-2">
              Confirm Delete
            </h4>
            <p className="text-gray-600 text-sm mb-5">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-gray-800">
                {selectedUser.name}
              </span>
              ?
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={closeModal}
                disabled={loading}
                className="px-4 py-2 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 text-sm font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={loading}
                className={`px-4 py-2 rounded-md text-white text-sm font-medium transition ${
                  loading
                    ? "bg-red-400 cursor-not-allowed"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {loading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

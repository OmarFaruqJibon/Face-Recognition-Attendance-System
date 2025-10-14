import React, { useState } from "react";
import { Trash2, UserCircle2, Edit2 } from "lucide-react";
import { deleteUser, updateUser } from "../api/apiClient";

export default function UserManagement({ users = [], onUsersChanged }) {
  const [selectedUser, setSelectedUser] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: "", role: "", note: "" });

  function openDeleteModal(user) {
    setSelectedUser(user);
    setShowDeleteModal(true);
  }

  function openUpdateModal(user) {
    setSelectedUser(user);
    setFormData({
      name: user.name || "",
      role: user.role || "",
      note: user.note || "",
    });
    setShowUpdateModal(true);
  }

  function closeModals() {
    setShowDeleteModal(false);
    setShowUpdateModal(false);
    setSelectedUser(null);
  }

  async function handleDeleteConfirm() {
    if (!selectedUser) return;
    setLoading(true);
    try {
      await deleteUser(selectedUser._id);
      onUsersChanged &&
        onUsersChanged(users.filter((u) => u._id !== selectedUser._id));
      closeModals();
    } catch (e) {
      alert("Delete failed: " + (e.response?.data?.detail || e.message));
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateSubmit(e) {
    e.preventDefault();
    if (!selectedUser) return;
    setLoading(true);
    try {
      const body = {
        name: formData.name.trim(),
        role: formData.role.trim(),
        note: formData.note.trim(),
      };
      await updateUser(selectedUser._id, body);

      // Update local list
      onUsersChanged &&
        onUsersChanged(
          users.map((u) => (u._id === selectedUser._id ? { ...u, ...body } : u))
        );

      closeModals();
    } catch (e) {
      alert("Update failed: " + (e.response?.data?.detail || e.message));
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

              <div className="flex gap-2">
                <button
                  onClick={() => openUpdateModal(u)}
                  className="flex items-center gap-1 cursor-pointer text-blue-800 hover:text-white hover:bg-blue-800 border border-blue-700 transition px-2 py-1.5 rounded-md text-sm font-medium"
                >
                  <Edit2 size={16} />
                </button>

                <button
                  onClick={() => openDeleteModal(u)}
                  className="flex items-center gap-1 cursor-pointer text-red-800 hover:text-white hover:bg-red-600 border border-red-600 transition px-2 py-1.5 rounded-md text-sm font-medium"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedUser && (
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
                onClick={closeModals}
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

      {/* Update Modal */}
      {showUpdateModal && selectedUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg w-[400px] p-6 relative">
            <h4 className="text-lg font-semibold text-gray-800 mb-4">
              Update User
            </h4>
            <form onSubmit={handleUpdateSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-600">
                  Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full mt-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600">
                  Role
                </label>
                <input
                  type="text"
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value })
                  }
                  className="w-full mt-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600">
                  Note
                </label>
                <textarea
                  value={formData.note}
                  onChange={(e) =>
                    setFormData({ ...formData, note: e.target.value })
                  }
                  className="w-full mt-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={3}
                  placeholder="Add a note about this user..."
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={closeModals}
                  disabled={loading}
                  className="px-4 py-2 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 text-sm font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className={`px-4 py-2 rounded-md text-white text-sm font-medium transition ${
                    loading
                      ? "bg-blue-400 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {loading ? "Updating..." : "Update"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

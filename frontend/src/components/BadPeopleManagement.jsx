import React, { useState, useEffect } from "react";
import {
  getBadPeople,
  deleteBadPerson,
  updateBadPerson,
  addBadPerson,
} from "../api/apiClient";
import { Trash2, UserCircle2, Edit2, PlusCircle } from "lucide-react";

export default function BadPeopleManagement() {
  const [badPeople, setBadPeople] = useState([]);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    role: "bad",
    reason: "",
  });
  const [addForm, setAddForm] = useState({
    name: "",
    role: "bad",
    reason: "",
    image: null,
  });
  const [loading, setLoading] = useState(false);

  // 🔹 Fetch bad people on mount
  useEffect(() => {
    loadBadPeople();
  }, []);

  async function loadBadPeople() {
    try {
      const data = await getBadPeople();
      setBadPeople(data);
    } catch (err) {
      console.error("Failed to load bad people:", err);
    }
  }

  function openEditModal(person) {
    setSelectedPerson(person);
    setEditForm({
      name: person.name || "",
      role: person.role || "bad",
      reason: person.reason || "",
    });
    setShowEditModal(true);
  }

  async function handleUpdate(e) {
    e.preventDefault();
    if (!selectedPerson) return;
    setLoading(true);
    try {
      await updateBadPerson(selectedPerson._id, editForm);
      await loadBadPeople(); // reload list
      setShowEditModal(false);
    } catch (err) {
      alert("Update failed: " + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this bad person?")) return;
    setLoading(true);
    try {
      await deleteBadPerson(id);
      await loadBadPeople(); // reload list
    } catch (err) {
      alert("Delete failed: " + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("name", addForm.name);
      formData.append("role", addForm.role);
      formData.append("reason", addForm.reason);
      if (addForm.image) formData.append("image", addForm.image);

      await addBadPerson(formData);
      await loadBadPeople(); // reload list
      setAddForm({ name: "", role: "bad", reason: "", image: null });
      setShowAddModal(false);
    } catch (err) {
      alert("Add failed: " + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="bg-white p-4 rounded-2xl shadow mt-6 border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
          Suspicious Users
          <span className="ml-1 text-sm text-gray-500">
            ({badPeople.length})
          </span>
        </h3>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1 text-green-700 cursor-pointer text-sm font-medium transition"
        >
          <PlusCircle size={14} />
          Add New
        </button>
      </div>

      <div className="h-56 overflow-auto divide-y divide-gray-100">
        {badPeople.length === 0 ? (
          <div className="text-gray-500 text-sm text-center py-6">
            No Suspicious User found
          </div>
        ) : (
          badPeople.map((p) => (
            <div
              key={p._id}
              className="flex items-center gap-3 p-3 hover:bg-gray-50 transition"
            >
              {p.image_path ? (
                <img
                  src={`${import.meta.env.VITE_API_BASE}${p.image_path}`}
                  alt={p.name}
                  className="w-12 h-12 object-cover rounded-lg border"
                />
              ) : (
                <UserCircle2 className="w-12 h-12 text-gray-400" />
              )}

              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-800 truncate">
                  {p.name}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  Reason: {p.reason}
                </div>
                <div className="text-xs text-gray-400">
                  Added: {new Date(p.created_at).toLocaleString()}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => openEditModal(p)}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-md border border-blue-600 text-blue-700 hover:bg-blue-600 hover:text-white transition text-sm"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => handleDelete(p._id)}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-md border border-red-600 text-red-700 hover:bg-red-600 hover:text-white transition text-sm"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && selectedPerson && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg w-[420px] p-6">
            <h4 className="text-lg font-semibold text-gray-800 mb-4">
              Update Bad Person
            </h4>
            <form onSubmit={handleUpdate} className="space-y-3">
              <label className="block text-sm">
                Name
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                  className="w-full mt-1 border rounded px-3 py-2"
                  required
                />
              </label>

              <label className="block text-sm">
                Role
                <input
                  type="text"
                  value={editForm.role}
                  onChange={(e) =>
                    setEditForm({ ...editForm, role: e.target.value })
                  }
                  className="w-full mt-1 border rounded px-3 py-2"
                />
              </label>

              <label className="block text-sm">
                Reason
                <textarea
                  value={editForm.reason}
                  onChange={(e) =>
                    setEditForm({ ...editForm, reason: e.target.value })
                  }
                  className="w-full mt-1 border rounded px-3 py-2"
                  rows={3}
                />
              </label>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 text-sm font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-md bg-green-600 text-white"
                >
                  {loading ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg w-[420px] p-6">
            <h4 className="text-lg font-semibold text-gray-800 mb-4">
              Add Bad Person
            </h4>
            <form onSubmit={handleAdd} className="space-y-3">
              <label className="block text-sm font-medium text-gray-600">
                Name
                <input
                  type="text"
                  value={addForm.name}
                  onChange={(e) =>
                    setAddForm({ ...addForm, name: e.target.value })
                  }
                  className="w-full mt-1 border rounded px-3 py-2"
                  required
                />
              </label>

              <label className="block text-sm font-medium text-gray-600">
                Reason
                <textarea
                  value={addForm.reason}
                  onChange={(e) =>
                    setAddForm({ ...addForm, reason: e.target.value })
                  }
                  className="w-full mt-1 border rounded px-3 py-2"
                  rows={3}
                />
              </label>

              <label className="block text-sm font-medium text-gray-600">
                Upload Image
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    setAddForm({ ...addForm, image: e.target.files[0] })
                  }
                  className="w-full mt-1 text-sm text-gray-700"
                />
              </label>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 text-sm font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 rounded-md text-white text-sm font-medium transition ${
                    loading
                      ? "bg-green-400 cursor-not-allowed"
                      : "bg-green-600 hover:bg-green-700"
                  }`}
                >
                  {loading ? "Adding..." : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

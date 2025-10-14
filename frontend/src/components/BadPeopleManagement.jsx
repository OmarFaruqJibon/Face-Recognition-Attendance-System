import React, { useState } from "react";
import { deleteBadPerson, updateBadPerson } from "../api/apiClient";
import { Trash2, UserCircle2, Edit2 } from "lucide-react";

export default function BadPeopleManagement({
  badPeople = [],
  onBadPeopleChanged,
}) {
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", role: "bad", reason: "" });

  function openEditModal(person) {
    setSelectedPerson(person);
    setForm({
      name: person.name || "",
      role: person.role || "bad",
      reason: person.reason || "",
    });
    setShowModal(true);
  }

  async function handleUpdate(e) {
    e.preventDefault();
    try {
      await updateBadPerson(selectedPerson._id, form);
      const updatedList = badPeople.map((p) =>
        p._id === selectedPerson._id ? { ...p, ...form } : p
      );
      onBadPeopleChanged && onBadPeopleChanged(updatedList);
      setShowModal(false);
    } catch (err) {
      alert("Update failed: " + err.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this bad person?")) return;
    try {
      await deleteBadPerson(id);
      onBadPeopleChanged &&
        onBadPeopleChanged(badPeople.filter((p) => p._id !== id));
    } catch (err) {
      alert("Delete failed: " + err.message);
    }
  }

  return (
    <section className="bg-white p-4 rounded shadow mt-6">
      <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
        Bad People
        <span className="ml-1 text-sm text-gray-500">({badPeople.length})</span>
      </h3>
      <div className="h-56 overflow-auto">
        {badPeople.map((p) => (
          <div
            key={p._id}
            className="flex items-center gap-3 p-2 border-b hover:bg-gray-50 transition"
          >
            <img
              src={`${import.meta.env.VITE_API_BASE}${p.image_path}`}
              alt={p.name}
              className="w-12 h-12 object-cover rounded"
            />
            <div className="flex-1">
              <div className="font-medium text-gray-800">{p.name}</div>
              <div className="text-xs text-gray-500">Reason: {p.reason}</div>
              <div className="text-xs text-gray-400">
                Added: {new Date(p.created_at).toLocaleString()}
              </div>
            </div>
            <button
              onClick={() => openEditModal(p)}
              className="flex items-center gap-1 cursor-pointer text-blue-800 hover:text-white hover:bg-blue-800 border border-blue-700 transition px-2 py-1.5 rounded-md text-sm font-medium"
            >
              <Edit2 size={16} />
            </button>
            <button
              onClick={() => handleDelete(p._id)}
              className="flex items-center gap-1 cursor-pointer text-red-800 hover:text-white hover:bg-red-600 border border-red-600 transition px-2 py-1.5 rounded-md text-sm font-medium"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      {/* === Edit Modal === */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
          <div className="bg-white rounded-lg p-6 w-96 shadow-lg">
            <h2 className="text-lg font-semibold mb-4 text-gray-800">
              Update Bad Person
            </h2>
            <form onSubmit={handleUpdate} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border rounded px-2 py-1"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <input
                  type="text"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full border rounded px-2 py-1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Reason</label>
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  className="w-full border rounded px-2 py-1"
                  rows="2"
                />
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1 border rounded text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

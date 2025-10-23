import React, { useState } from "react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

export default function UnknownAlerts({
  unknownQueue = [],
  onApprove,
  onIgnore,
  onMarkAsBad,
}) {
  const [showBadModal, setShowBadModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [modalData, setModalData] = useState({
    id: null,
    name: "",
    reason: "",
    note: "",
  });

  // 👇 for image popup
  const [popupImage, setPopupImage] = useState(null);

  const uniqueUnknowns = Array.from(
    new Map(unknownQueue.map((u) => [u.unknown_id, u])).values()
  );

  const latest = uniqueUnknowns[0];

  async function handleIgnore(unknownId) {
    if (onIgnore) await onIgnore(unknownId);
  }

  async function handleApprove(unknownId, name, note) {
    if (onApprove) await onApprove(unknownId, name, note);
  }

  async function handleMarkAsBad(unknownId, name, reason) {
    if (onMarkAsBad) await onMarkAsBad(unknownId, name, reason);
  }

  const openApproveModal = (unknownId) => {
    setModalData({ id: unknownId, name: "", note: "" });
    setShowApproveModal(true);
  };

  const openBadModal = (unknownId) => {
    setModalData({ id: unknownId, name: "", reason: "" });
    setShowBadModal(true);
  };

  const closeModals = () => {
    setShowApproveModal(false);
    setShowBadModal(false);
    setModalData({ id: null, name: "", reason: "", note: "" });
  };

  const submitApprove = async () => {
    if (!modalData.name.trim()) {
      alert("Please enter a name");
      return;
    }
    await handleApprove(modalData.id, modalData.name, modalData.note);
    closeModals();
  };

  const submitBad = async () => {
    if (!modalData.name.trim() || !modalData.reason.trim()) {
      alert("Please fill in both fields");
      return;
    }
    await handleMarkAsBad(modalData.id, modalData.name, modalData.reason);
    closeModals();
  };

  return (
    <section className="bg-white p-4 rounded-xl shadow-md border border-gray-100">
      <h3 className="font-semibold text-gray-800 mb-3 text-lg">
        Unknown Alerts
      </h3>

      {!latest && (
        <div className="text-sm text-gray-500 italic">No recent unknowns</div>
      )}

      {latest && (
        <div className="flex gap-4 items-start mb-4 bg-gray-50 p-3 rounded-lg shadow-sm">
          <img
            src={`${import.meta.env.VITE_API_BASE || ""}${latest.image_path}`}
            alt="unknown"
            className="w-24 h-24 object-cover rounded-lg border cursor-pointer hover:opacity-80 transition"
            onClick={() =>
              setPopupImage(
                `${import.meta.env.VITE_API_BASE || ""}${latest.image_path}`
              )
            }
          />
          <div className="flex-1">
            <div className="text-sm text-gray-600 mb-2">
              Detected:{" "}
              {dayjs(latest.first_seen).format("YYYY-MM-DD HH:mm:ss")}
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                className="px-2 cursor-pointer py-1.5 bg-green-700 hover:bg-green-800 text-white rounded-lg text-sm font-medium shadow-sm"
                onClick={() => openApproveModal(latest.unknown_id)}
              >
                Approve
              </button>
              <button
                className="px-2 cursor-pointer py-1.5 bg-red-600 hover:bg-red-800 text-white rounded-lg text-sm font-medium shadow-sm"
                onClick={() => openBadModal(latest.unknown_id)}
              >
                Mark as Bad
              </button>
              <button
                className="px-2 cursor-pointer py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium shadow-sm"
                onClick={() => handleIgnore(latest.unknown_id)}
              >
                Ignore
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remaining unknowns list */}
      <div className="h-52 overflow-auto divide-y divide-gray-100">
        {uniqueUnknowns.slice(1).map((u) => (
          <div
            key={u.unknown_id}
            className="flex items-center gap-3 py-2 hover:bg-gray-50 transition"
          >
            <img
              src={`${import.meta.env.VITE_API_BASE || ""}${u.image_path}`}
              alt="unknown"
              className="w-12 h-12 object-cover rounded-lg border cursor-pointer hover:opacity-80 transition"
              onClick={() =>
                setPopupImage(
                  `${import.meta.env.VITE_API_BASE || ""}${u.image_path}`
                )
              }
            />
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-700">
                ID: {u.unknown_id}
              </div>
              <div className="text-xs text-gray-500">
                {dayjs(u.first_seen).format("HH:mm:ss")}
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  className="text-xs cursor-pointer px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded"
                  onClick={() => openApproveModal(u.unknown_id)}
                >
                  Approve
                </button>
                <button
                  className="text-xs cursor-pointer px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded"
                  onClick={() => openBadModal(u.unknown_id)}
                >
                  Mark as Bad
                </button>
                <button
                  className="text-xs cursor-pointer px-2 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded"
                  onClick={() => handleIgnore(u.unknown_id)}
                >
                  Ignore
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 🌟 Approve Modal */}
      {showApproveModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl w-96 relative animate-fadeIn">
            <h3 className="text-xl font-semibold text-center text-gray-800 mb-5">
              Approve Person
            </h3>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Name
              <input
                type="text"
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                value={modalData.name}
                placeholder="Enter person's name"
                onChange={(e) =>
                  setModalData((prev) => ({
                    ...prev,
                    name: e.target.value,
                  }))
                }
              />
            </label>

            <label className="block text-sm font-medium text-gray-700 mb-4">
              Note
              <textarea
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                placeholder="Enter note"
                value={modalData.note}
                onChange={(e) =>
                  setModalData((prev) => ({
                    ...prev,
                    note: e.target.value,
                  }))
                }
              ></textarea>
            </label>

            <div className="flex justify-end gap-3 mt-6">
              <button
                className="px-4 py-2 rounded-lg bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium"
                onClick={closeModals}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium"
                onClick={submitApprove}
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 Mark as Bad Modal */}
      {showBadModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl w-96 relative animate-fadeIn">
            <h3 className="text-xl font-semibold text-center text-gray-800 mb-5">
              Mark as Bad
            </h3>

            <label className="block text-sm font-medium text-gray-700 mb-3">
              Name
              <input
                type="text"
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none"
                placeholder="Enter name"
                value={modalData.name}
                onChange={(e) =>
                  setModalData((prev) => ({
                    ...prev,
                    name: e.target.value,
                  }))
                }
              />
            </label>

            <label className="block text-sm font-medium text-gray-700 mb-4">
              Reason
              <textarea
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none"
                rows="3"
                placeholder="Enter reason"
                value={modalData.reason}
                onChange={(e) =>
                  setModalData((prev) => ({
                    ...prev,
                    reason: e.target.value,
                  }))
                }
              ></textarea>
            </label>

            <div className="flex justify-end gap-3 mt-4">
              <button
                className="px-4 py-2 rounded-lg bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium"
                onClick={closeModals}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium"
                onClick={submitBad}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🖼️ Image Popup Modal */}
      {popupImage && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          onClick={() => setPopupImage(null)}
        >
          <img
            src={popupImage}
            alt="Preview"
            className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-lg"
          />
          <button
            className="absolute top-4 right-4 text-white text-2xl font-bold"
            onClick={() => setPopupImage(null)}
          >
            ✕
          </button>
        </div>
      )}
    </section>
  );
}

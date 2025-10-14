import React from "react";
import dayjs from "dayjs";

export default function UnknownAlerts({
    unknownQueue = [],
    onApprove,
    onIgnore,
    onMarkAsBad,
}) {
    // remove duplicate unknowns by _id
    const uniqueUnknowns = Array.from(
        new Map(unknownQueue.map((u) => [u.unknown_id, u])).values()
    );

    // latest unknown (first item in the queue)
    const latest = uniqueUnknowns[0];

    async function handleIgnore(unknownId) {
        if (onIgnore) await onIgnore(unknownId);
    }

    async function handleMarkAsBad(unknownId, name, reason) {
        if (onMarkAsBad) await onMarkAsBad(unknownId, name, reason);
    }

    return (
        <section className="bg-white p-4 rounded shadow">
            <h3 className="font-semibold mb-2">Unknown Alerts</h3>

            {!latest && <div className="text-sm text-gray-500">No recent unknowns</div>}

            {latest && (
                <div className="flex gap-3 items-start mb-3">
                    <img
                        src={`${import.meta.env.VITE_API_BASE || ""}${latest.image_path}`}
                        alt="unknown"
                        className="w-24 h-24 object-cover rounded snapshot"
                    />
                    <div className="flex-1">
                        <div className="mb-1 text-sm text-gray-600">
                            {dayjs(latest.first_seen).format("YYYY-MM-DD HH:mm:ss")}
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            <button
                                className="px-2 py-1 bg-green-700 text-white rounded text-sm"
                                onClick={() => {
                                    const name = prompt("Name for this user:");
                                    if (name) onApprove(latest.unknown_id, name);
                                }}
                            >
                                Approve
                            </button>
                            <button
                                className="px-2 py-1 bg-red-700 text-white rounded text-sm"
                                onClick={() => {
                                    const name = prompt("Name for this bad person:");
                                    if (!name) return;
                                    const reason = prompt("Reason/Comment:");
                                    if (reason !== null) {
                                        handleMarkAsBad(latest.unknown_id, name, reason);
                                    }
                                }}
                            >
                                Mark as Bad
                            </button>
                            <button
                                className="px-2 py-1 bg-orange-700 text-white rounded text-sm"
                                onClick={() => handleIgnore(latest.unknown_id)}
                            >
                                Ignore
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Remaining unknowns list (skip latest to avoid duplicate) */}
            <div className="h-40 overflow-auto">
                {uniqueUnknowns.slice(1).map((u) => (
                    <div key={u.unknown_id} className="flex items-center gap-2 p-1 border-b">
                        <img
                            src={`${import.meta.env.VITE_API_BASE || ""}${u.image_path}`}
                            alt="unknown"
                            className="w-12 h-12 object-cover rounded snapshot"
                        />
                        <div className="flex-1">
                            <div className="text-sm">ID: {u.unknown_id}</div>
                            <div className="text-xs text-gray-500">
                                {dayjs(u.first_seen).format("HH:mm:ss")}
                            </div>
                            <div className="flex gap-2 mt-1 flex-wrap">
                                <button
                                    className="text-xs px-2 py-1 bg-indigo-600 text-white rounded"
                                    onClick={() => {
                                        const name = prompt("Name for this user:");
                                        if (name) onApprove(u.unknown_id, name);
                                    }}
                                >
                                    Approve
                                </button>
                                <button
                                    className="text-xs px-2 py-1 bg-red-600 text-white rounded"
                                    onClick={() => {
                                        const name = prompt("Name for this bad person:");
                                        if (!name) return;
                                        const reason = prompt("Reason/Comment:");
                                        if (reason !== null) handleMarkAsBad(u.unknown_id, name, reason);
                                    }}
                                >
                                    Mark as Bad
                                </button>
                                <button
                                    className="text-xs px-2 py-1 bg-orange-600 text-white rounded"
                                    onClick={() => handleIgnore(u.unknown_id)}
                                >
                                    Ignore
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}

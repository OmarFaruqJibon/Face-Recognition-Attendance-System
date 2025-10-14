// src/api/apiClint.js

import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

const client = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
});

export async function fetchUsers() {
  const res = await client.get("/users");
  return res.data;
}

export async function fetchUnknowns(limit = 50) {
  // const res = await client.get("/unknowns", { params: { limit } });
  // return res.data;

  const res = await client.get("/unknowns", { params: { limit } });
  return res.data.map((u) => ({
    ...u,
    unknown_id: u._id, // normalize
  }));
}

export async function fetchPresence(limit = 100) {
  const res = await client.get("/presence_events", { params: { limit } });
  return res.data;
}

export async function approveUnknown(unknownId, name) {
  const res = await client.post(`/admin/approve_unknown/${unknownId}`, {
    name,
  });
  return res.data;
}

export async function ignoreUnknown(unknownId) {
  const res = await client.delete(`/admin/ignore_unknown/${unknownId}`);
  return res.data;
}

export async function createUser(userBody) {
  const res = await client.post("/users", userBody); // if backend supports create; otherwise use /admin/approve_unknown flow
  return res.data;
}

export async function updateUser(userId, body) {
  const res = await client.put(`/users/${userId}`, body); // implement server side if needed
  return res.data;
}

export async function deleteUser(userId) {
  const res = await client.delete(`/users/${userId}`);
  return res.data;
}

export async function reloadEmbeddings() {
  const res = await client.post("/admin/reload_embeddings");
  return res.data;
}

export async function generateAttendance(dateStr) {
  const res = await client.post(`/admin/generate_attendance/${dateStr}`);
  return res.data;
}

export async function markAsBad(unknownId, name, reason) {
  const res = await client.post(`/admin/mark_bad_person/${unknownId}`, {
    name,
    reason,
  });
  return res.data;
}

// ---------------------BAD PEOPLE SECTION -------------------

// Fetch all bad people
export async function getBadPeople() {
  const res = await client.get("/bad_people");
  return res.data;
}

// Delete a bad person
export async function deleteBadPerson(userId) {
  const res = await client.delete(`/delete_bad_person/${userId}`);
  return res.data;
}

// Update a bad person
export async function updateBadPerson(userId, data) {
  const res = await client.put(`/update_bad_person/${userId}`, data);
  return res.data;
}

// ---------------------BAD PEOPLE SECTION -------------------

export default client;

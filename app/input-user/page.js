"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";

/* ---------- UI helpers ---------- */
function Icon({ name, className = "h-5 w-5" }) {
  const d = {
    plus: "M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5z",
    edit: "M3 17.25V21h3.75l11-11-3.75-3.75-11 11zM20.7 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z",
    trash: "M6 7h12l-1 12H7L6 7zm3-4h6l1 2H8l1-2z",
    search: "M15.5 14h-.8l-.3-.3A6.5 6.5 0 1 0 14 15.5l.3.3v.8L20 21l1-1-5.5-5.5zM6.5 12A5.5 5.5 0 1 1 12 6.5 5.51 5.51 0 0 1 6.5 12z",
    user: "M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm0 2c-4.33 0-8 2.17-8 5v1h16v-1c0-2.83-3.67-5-8-5z",
    role: "M12 2l9 4-9 4-9-4 9-4zm0 8l9 4-9 4-9-4 9-4z",
  };
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d={d[name]} />
    </svg>
  );
}

const ROLES = [
  { value: "kepala_sekolah", label: "Kepala Sekolah" },
  { value: "wali_kelas", label: "Wali Kelas" },
  { value: "guru", label: "Guru" },
  { value: "siswa", label: "Siswa" },
];

const emptyForm = {
  name: "",
  email: "",
  role: "guru",
  kelas: "",
  mapel: "",
  nisn: "",
  isActive: true,
};

export default function InputUserPage() {
  const [kelasList, setKelasList] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [qRole, setQRole] = useState("");
  const [qSearch, setQSearch] = useState("");

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);

  // Fetch kelas
  useEffect(() => {
    const run = async () => {
      try {
        let snap;
        try {
          snap = await getDocs(query(collection(db, "kelas"), orderBy("nama", "asc")));
        } catch {
          snap = await getDocs(collection(db, "kelas"));
        }
        const list = snap.docs
          .map((d) => {
            const v = d.data();
            const nama = v?.nama || v?.kelas || v?.name || d.id;
            return String(nama).trim();
          })
          .filter(Boolean);
        setKelasList(Array.from(new Set(list)));
      } catch (e) {
        console.error("Gagal ambil kelas:", e);
      }
    };
    run();
  }, []);

  // Fetch users
  const loadUsers = async () => {
    setLoading(true);
    try {
      let qy;
      try {
        qy = query(collection(db, "users_app"), orderBy("createdAt", "desc"));
      } catch {
        qy = collection(db, "users_app");
      }
      const snap = await getDocs(qy);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setUsers(list);
    } catch (e) {
      console.error("Gagal ambil users:", e);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    loadUsers();
  }, []);

  const filtered = useMemo(() => {
    const s = qSearch.trim().toLowerCase();
    return users
      .filter((u) => (qRole ? u.role === qRole : true))
      .filter((u) => {
        if (!s) return true;
        return (
          String(u.name || "").toLowerCase().includes(s) ||
          String(u.email || "").toLowerCase().includes(s) ||
          String(u.kelas || "").toLowerCase().includes(s) ||
          String(u.mapel || "").toLowerCase().includes(s) ||
          String(u.nisn || "").toLowerCase().includes(s)
        );
      });
  }, [users, qRole, qSearch]);

  /* ------------ Actions ------------ */
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };

  const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return alert("Nama wajib diisi");
    if (!form.email.trim()) return alert("Email wajib diisi");
    if (!form.role) return alert("Role wajib dipilih");

    try {
      setSaving(true);
      // anti-duplikat by email
      const email = normalizeEmail(form.email);
      const dup = filteredEmail(users, email);
      if (dup) {
        alert("Email sudah terdaftar. Gunakan email lain.");
        return;
      }

      const payload = {
        name: form.name.trim(),
        email,
        role: form.role,
        kelas: form.role === "wali_kelas" || form.role === "siswa" ? (form.kelas || "") : (form.kelas || ""),
        mapel: form.role === "guru" ? (form.mapel || "") : (form.mapel || ""),
        nisn: form.role === "siswa" ? (String(form.nisn || "").trim()) : "",
        isActive: !!form.isActive,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await addDoc(collection(db, "users_app"), payload);
      setForm(emptyForm);
      await loadUsers();
      alert("✅ User berhasil ditambahkan.");
    } catch (e) {
      console.error(e);
      alert("⚠️ Gagal menambah user.");
    } finally {
      setSaving(false);
    }
  };

  const filteredEmail = (arr, email) =>
    arr.find((u) => normalizeEmail(u.email) === normalizeEmail(email));

  const onEdit = (row) => {
    setEditRow(row);
    setEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!editRow) return;
    const id = editRow.id;
    if (!id) return alert("Row tidak valid.");

    if (!String(editRow.name || "").trim()) return alert("Nama wajib diisi");
    if (!String(editRow.email || "").trim()) return alert("Email wajib diisi");

    // Cek duplikat email ke user lain
    const email = normalizeEmail(editRow.email);
    const dup = users.find((u) => normalizeEmail(u.email) === email && u.id !== id);
    if (dup) return alert("Email sudah dipakai user lain.");

    try {
      setSaving(true);
      const payload = {
        name: String(editRow.name).trim(),
        email,
        role: editRow.role,
        kelas: editRow.kelas || "",
        mapel: editRow.mapel || "",
        nisn: editRow.nisn ? String(editRow.nisn).trim() : "",
        isActive: !!editRow.isActive,
        updatedAt: serverTimestamp(),
      };
      await updateDoc(doc(db, "users_app", id), payload);
      setEditOpen(false);
      setEditRow(null);
      await loadUsers();
      alert("✅ User diperbarui.");
    } catch (e) {
      console.error(e);
      alert("⚠️ Gagal update user.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (!row?.id) return;
    if (!confirm(`Hapus user "${row.name}"?`)) return;
    try {
      await deleteDoc(doc(db, "users_app", row.id));
      await loadUsers();
      alert("🗑️ User dihapus.");
    } catch (e) {
      console.error(e);
      alert("⚠️ Gagal hapus user.");
    }
  };

  /* ------------ UI ------------ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-white to-slate-50 p-6 md:p-10">
      <div className="mx-auto w-full max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900">👥 Manajemen User</h1>
            <p className="text-slate-600">Tambah & kelola user: kepala sekolah, wali kelas, guru, dan siswa.</p>
          </div>
        </div>

        {/* Form Tambah */}
        <div className="bg-white ring-1 ring-slate-200 rounded-2xl p-6 shadow-sm mb-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Icon name="plus" /> Tambah User
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <input
              type="text"
              name="name"
              placeholder="Nama Lengkap"
              value={form.name}
              onChange={handleChange}
              className="col-span-2 border px-3 py-2 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-400"
            />
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={form.email}
              onChange={handleChange}
              className="col-span-2 border px-3 py-2 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-400"
            />

            <select
              name="role"
              value={form.role}
              onChange={handleChange}
              className="col-span-1 border px-3 py-2 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-400"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>

            <label className="col-span-1 inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                name="isActive"
                checked={form.isActive}
                onChange={handleChange}
                className="h-4 w-4"
              />
              Aktif
            </label>

            {/* Kondisional fields */}
            {(form.role === "wali_kelas" || form.role === "siswa") && (
              <select
                name="kelas"
                value={form.kelas}
                onChange={handleChange}
                className="col-span-2 border px-3 py-2 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-400"
              >
                <option value="">Pilih Kelas</option>
                {kelasList.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            )}

            {form.role === "guru" && (
              <input
                type="text"
                name="mapel"
                placeholder="Mapel (opsional)"
                value={form.mapel}
                onChange={handleChange}
                className="col-span-2 border px-3 py-2 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-400"
              />
            )}

            {form.role === "siswa" && (
              <input
                type="text"
                name="nisn"
                placeholder="NISN (opsional)"
                value={form.nisn}
                onChange={handleChange}
                className="col-span-2 border px-3 py-2 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-400"
              />
            )}

            <div className="col-span-1 md:col-span-6 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg shadow hover:bg-indigo-700 transition"
              >
                {saving ? "Menyimpan..." : "💾 Simpan User"}
              </button>
            </div>
          </form>
        </div>

        {/* Toolbar list */}
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Icon name="role" className="h-4 w-4 text-slate-600" />
            <select
              value={qRole}
              onChange={(e) => setQRole(e.target.value)}
              className="border px-3 py-2 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">Semua Role</option>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Icon name="search" className="h-4 w-4 text-slate-600" />
            <input
              type="text"
              placeholder="Cari nama/email/kelas/mapel/nisn…"
              value={qSearch}
              onChange={(e) => setQSearch(e.target.value)}
              className="border px-3 py-2 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-400 min-w-[240px]"
            />
          </div>
        </div>

        {/* Tabel list */}
        <div className="overflow-x-auto rounded-2xl ring-1 ring-slate-200 bg-white">
          <table className="w-full text-sm text-black">
            <thead>
              <tr className="bg-slate-50 text-slate-700">
                <th className="p-3 text-left">Nama</th>
                <th className="p-3 text-left">Email</th>
                <th className="p-3 text-left">Role</th>
                <th className="p-3 text-left">Kelas/Mapel/NISN</th>
                <th className="p-3 text-center">Aktif</th>
                <th className="p-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="p-6 text-center">⏳ Memuat…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="p-6 text-center">— Tidak ada data —</td></tr>
              ) : (
                filtered.map((u, idx) => (
                  <tr key={u.id || `${u.email}-${idx}`} className={idx % 2 ? "bg-white" : "bg-slate-50/50"}>
                    <td className="p-3">{u.name}</td>
                    <td className="p-3">{u.email}</td>
                    <td className="p-3">
                      {ROLES.find((r) => r.value === u.role)?.label || u.role}
                    </td>
                    <td className="p-3">
                      {u.role === "wali_kelas" || u.role === "siswa" ? (
                        <span className="inline-block mr-2">Kelas: <b>{u.kelas || "—"}</b></span>
                      ) : null}
                      {u.role === "guru" ? (
                        <span className="inline-block">Mapel: <b>{u.mapel || "—"}</b></span>
                      ) : null}
                      {u.role === "siswa" && (
                        <span className="inline-block ml-2">NISN: <b>{u.nisn || "—"}</b></span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-1 rounded text-xs ${u.isActive ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-700"}`}>
                        {u.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => onEdit(u)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg ring-1 ring-slate-300 hover:bg-slate-50 mr-2"
                      >
                        <Icon name="edit" /> Edit
                      </button>
                      <button
                        onClick={() => handleDelete(u)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg ring-1 ring-red-300 text-red-600 hover:bg-red-50"
                      >
                        <Icon name="trash" /> Hapus
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Modal Edit */}
        {editOpen && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
            <div className="w-full max-w-2xl bg-white rounded-2xl p-6 ring-1 ring-slate-200 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Edit User</h3>
                <button onClick={() => setEditOpen(false)} className="text-slate-500 hover:text-slate-800">✕</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                <input
                  type="text"
                  placeholder="Nama Lengkap"
                  value={editRow?.name || ""}
                  onChange={(e) => setEditRow((r) => ({ ...r, name: e.target.value }))}
                  className="col-span-2 border px-3 py-2 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-400"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={editRow?.email || ""}
                  onChange={(e) => setEditRow((r) => ({ ...r, email: e.target.value }))}
                  className="col-span-2 border px-3 py-2 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-400"
                />
                <select
                  value={editRow?.role || "guru"}
                  onChange={(e) => setEditRow((r) => ({ ...r, role: e.target.value }))}
                  className="col-span-1 border px-3 py-2 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-400"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
                <label className="col-span-1 inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={!!editRow?.isActive}
                    onChange={(e) => setEditRow((r) => ({ ...r, isActive: e.target.checked }))}
                    className="h-4 w-4"
                  />
                  Aktif
                </label>

                {(editRow?.role === "wali_kelas" || editRow?.role === "siswa") && (
                  <select
                    value={editRow?.kelas || ""}
                    onChange={(e) => setEditRow((r) => ({ ...r, kelas: e.target.value }))}
                    className="col-span-3 border px-3 py-2 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-400"
                  >
                    <option value="">Pilih Kelas</option>
                    {kelasList.map((k) => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                )}

                {editRow?.role === "guru" && (
                  <input
                    type="text"
                    placeholder="Mapel (opsional)"
                    value={editRow?.mapel || ""}
                    onChange={(e) => setEditRow((r) => ({ ...r, mapel: e.target.value }))}
                    className="col-span-3 border px-3 py-2 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-400"
                  />
                )}

                {editRow?.role === "siswa" && (
                  <input
                    type="text"
                    placeholder="NISN (opsional)"
                    value={editRow?.nisn || ""}
                    onChange={(e) => setEditRow((r) => ({ ...r, nisn: e.target.value }))}
                    className="col-span-3 border px-3 py-2 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-400"
                  />
                )}
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button onClick={() => setEditOpen(false)} className="px-4 py-2 rounded-lg ring-1 ring-slate-300">
                  Batal
                </button>
                <button
                  onClick={handleUpdate}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  {saving ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

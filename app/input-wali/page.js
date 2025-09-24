"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";

/* ---------- UI helpers ---------- */
function SectionCard({ title, children }) {
  return (
    <div className="relative bg-white/95 border border-slate-200 rounded-3xl shadow-md overflow-hidden">
      <div className="bg-slate-900 text-white w-full px-6 py-3 text-sm md:text-base font-semibold tracking-wide rounded-t-3xl">
        {title}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function Modal({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      aria-modal="true"
      role="dialog"
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-4 rounded-2xl bg-white shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-slate-600 hover:bg-slate-100"
            aria-label="Tutup"
          >
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export default function InputWaliPage() {
  /* form tambah */
  const [formData, setFormData] = useState({ nama_wali: "", kelas: "" });
  const [saving, setSaving] = useState(false);

  /* data */
  const [kelasList, setKelasList] = useState([]); // ["7A","7B",...]
  const [waliList, setWaliList] = useState([]);   // [{id,nama_wali,kelas}]

  /* modal edit */
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editDraft, setEditDraft] = useState({ nama_wali: "", kelas: "" });
  const [editSaving, setEditSaving] = useState(false);

  /* -------- Fetch kelas (unik) dari koleksi siswa -------- */
  useEffect(() => {
    const run = async () => {
      try {
        const qSiswa = query(collection(db, "siswa"), orderBy("kelas", "asc"));
        const snap = await getDocs(qSiswa);
        const arr = snap.docs
          .map((d) => (d.data()?.kelas || "").toString().trim())
          .filter(Boolean);
        const unik = Array.from(new Set(arr)).sort((a, b) =>
          a.localeCompare(b, "id")
        );
        setKelasList(unik);
      } catch (e) {
        console.error("Gagal ambil kelas:", e);
      }
    };
    run();
  }, []);

  /* -------- Fetch wali_kelas -------- */
  const fetchWali = async () => {
    const qW = query(collection(db, "wali_kelas"));
    const snap = await getDocs(qW);
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    list.sort((a, b) =>
      (a.kelas || "").localeCompare(b.kelas || "", "id") ||
      (a.nama_wali || "").localeCompare(b.nama_wali || "", "id")
    );
    setWaliList(list);
  };

  useEffect(() => {
    fetchWali();
  }, []);

  /* -------- Derived: Banin (A) vs Banat (B) -------- */
  const { waliBanin, waliBanat } = useMemo(() => {
    const banin = waliList.filter((w) => (w.kelas || "").includes("A"));
    const banat = waliList.filter((w) => (w.kelas || "").includes("B"));
    return { waliBanin: banin, waliBanat: banat };
  }, [waliList]);

  /* -------- Tambah wali -------- */
  const handleChangeForm = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nama_wali?.trim() || !formData.kelas?.trim()) {
      alert("❌ Nama wali & kelas wajib diisi");
      return;
    }
    try {
      setSaving(true);
      await setDoc(doc(collection(db, "wali_kelas")), {
        nama_wali: formData.nama_wali.trim(),
        kelas: formData.kelas.trim(),
        createdAt: serverTimestamp(),
      });
      setFormData({ nama_wali: "", kelas: "" });
      await fetchWali();
      alert("✅ Disimpan");
    } catch (e) {
      console.error(e);
      alert("⚠️ Gagal menyimpan data");
    } finally {
      setSaving(false);
    }
  };

  /* -------- Edit via Modal -------- */
  const openEditModal = (row) => {
    setEditId(row.id);
    setEditDraft({ nama_wali: row.nama_wali || "", kelas: row.kelas || "" });
    setModalOpen(true);
  };

  const closeEditModal = () => {
    setModalOpen(false);
    setEditId(null);
    setEditDraft({ nama_wali: "", kelas: "" });
  };

  const saveEdit = async () => {
    const nama = editDraft.nama_wali?.trim();
    const kls = editDraft.kelas?.trim();
    if (!nama || !kls) {
      alert("❌ Nama wali & kelas wajib diisi");
      return;
    }
    try {
      setEditSaving(true);
      await updateDoc(doc(db, "wali_kelas", editId), {
        nama_wali: nama,
        kelas: kls,
        updatedAt: serverTimestamp(),
      });
      await fetchWali();
      closeEditModal();
      alert("✏️ Perubahan disimpan");
    } catch (e) {
      console.error(e);
      alert("⚠️ Gagal menyimpan perubahan");
    } finally {
      setEditSaving(false);
    }
  };

  /* -------- Delete -------- */
  const handleDelete = async (id) => {
    if (!confirm("Yakin hapus wali ini?")) return;
    try {
      await deleteDoc(doc(db, "wali_kelas", id));
      await fetchWali();
      alert("🗑️ Dihapus");
    } catch (e) {
      console.error(e);
      alert("⚠️ Gagal menghapus");
    }
  };

  /* -------- Tabel Reusable -------- */
  const TabelWali = ({ title, items, badgeClass = "bg-slate-100 text-slate-700" }) => (
    <SectionCard title={title}>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-100">
            <tr className="text-slate-700">
              <th className="px-3 py-2 border border-slate-200 text-left">Nama Wali</th>
              <th className="px-3 py-2 border border-slate-200 text-center">Kelas</th>
              <th className="px-3 py-2 border border-slate-200 text-center w-40">Aksi</th>
            </tr>
          </thead>
          <tbody className="text-slate-800">
            {items.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                  Tidak ada data.
                </td>
              </tr>
            ) : (
              items.map((w) => (
                <tr key={w.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 border border-slate-200">{w.nama_wali}</td>
                  <td className="px-3 py-2 border border-slate-200 text-center">
                    <span className={`inline-block rounded-md px-2 py-1 text-xs ${badgeClass}`}>
                      {w.kelas}
                    </span>
                  </td>
                  <td className="px-3 py-2 border border-slate-200 text-center">
                    <div className="inline-flex gap-2">
                      <button
                        onClick={() => openEditModal(w)}
                        className="px-3 py-1.5 rounded-md text-xs font-medium bg-amber-500 text-white hover:bg-amber-600"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handleDelete(w.id)}
                        className="px-3 py-1.5 rounded-md text-xs font-medium bg-rose-600 text-white hover:bg-rose-700"
                      >
                        🗑 Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );

  return (
    <div className="min-h-screen bg-slate-100 py-10 px-6 text-black">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* ======= FORM TAMBAH ======= */}
        <SectionCard title="🧑‍🏫 Tambah Wali Kelas">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              name="nama_wali"
              placeholder="Nama Wali"
              value={formData.nama_wali}
              onChange={handleChangeForm}
              className="border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
            <select
              name="kelas"
              value={formData.kelas}
              onChange={handleChangeForm}
              className="border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              <option value="">Pilih Kelas</option>
              {kelasList.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md px-4 py-2 text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving ? "Menyimpan..." : "Simpan"}
            </button>
          </form>          
        </SectionCard>

        {/* ======= TABEL BANIN & BANAT ======= */}
        <div className="grid lg:grid-cols-2 gap-8">
          <TabelWali title="📘 Wali Kelas Banin (A)" items={waliBanin} />
          <TabelWali
            title="📗 Wali Kelas Banat (B)"
            items={waliBanat}
            badgeClass="bg-emerald-50 text-emerald-700"
          />
        </div>
      </div>

      {/* ======= MODAL EDIT ======= */}
      <Modal open={modalOpen} title="✏️ Edit Wali Kelas" onClose={closeEditModal}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm text-slate-700 mb-1">Nama Wali</label>
            <input
              type="text"
              value={editDraft.nama_wali}
              onChange={(e) => setEditDraft((p) => ({ ...p, nama_wali: e.target.value }))}
              className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm text-slate-700 mb-1">Kelas</label>
            <select
              value={editDraft.kelas}
              onChange={(e) => setEditDraft((p) => ({ ...p, kelas: e.target.value }))}
              className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              <option value="">Pilih Kelas</option>
              {kelasList.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            onClick={closeEditModal}
            className="rounded-md px-4 py-2 text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-100"
          >
            Batal
          </button>
          <button
            onClick={saveEdit}
            disabled={editSaving}
            className="rounded-md px-4 py-2 text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {editSaving ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

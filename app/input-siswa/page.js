"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  collection,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";

/* ============== UI helpers (serasi dengan page Input Wali) ============== */
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

/* ============== Helpers ============== */
const normalize = (v) => (v == null ? "" : String(v).trim());
const required = (o, keys) => keys.every((k) => normalize(o[k]) !== "");

/* Dropdown kelas yang memastikan value sekarang tetap ada meski belum di kelasSet */
function SelectKelas({ value, onChange, options }) {
  const safeOptions = useMemo(() => {
    const set = new Set(options.filter(Boolean).map((x) => x));
    if (value && !set.has(value)) set.add(value);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "id"));
  }, [options, value]);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
      required
    >
      <option value="" disabled>
        Pilih kelas
      </option>
      {safeOptions.map((k) => (
        <option key={k} value={k}>
          {k}
        </option>
      ))}
    </select>
  );
}

/* ============== Page ============== */
export default function InputSiswaPage() {
  /* ---- form tambah ---- */
  const [formData, setFormData] = useState({
    nisn: "",
    nama_siswa: "",
    nama_ar: "",
    kelas: "",
  });
  const [saving, setSaving] = useState(false);

  /* ---- data siswa ---- */
  const [siswaList, setSiswaList] = useState([]);
  const [loading, setLoading] = useState(true);

  /* ---- filter kelas global & batas tampilan ---- */
  const [selectedKelas, setSelectedKelas] = useState("");
  const PAGE_LIMIT = 50;

  /* ---- upload excel (preview buffer) ---- */
  const [rowsPreview, setRowsPreview] = useState([]);

  /* ---- modal edit ---- */
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editDraft, setEditDraft] = useState({
    nisn: "",
    nama_siswa: "",
    nama_ar: "",
    kelas: "",
  });
  const [editSaving, setEditSaving] = useState(false);

  /* -------- Fetch siswa -------- */
  const fetchSiswa = async () => {
    setLoading(true);
    try {
      // urutkan berdasar kelas lalu nama_siswa
      const qS = query(collection(db, "siswa"), orderBy("kelas", "asc"));
      const snap = await getDocs(qS);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort(
        (a, b) =>
          normalize(a.kelas).localeCompare(normalize(b.kelas), "id") ||
          normalize(a.nama_siswa).localeCompare(
            normalize(b.nama_siswa),
            "id"
          )
      );
      setSiswaList(list);
    } catch (e) {
      console.error("Gagal ambil siswa:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSiswa();
  }, []);

  /* -------- Hapus siswa -------- */
  const handleDelete = async (id) => {
    const target = siswaList.find((s) => s.id === id);
    if (!target) return;

    const ok = window.confirm(
      `Yakin ingin menghapus data siswa:\n${target.nama_siswa} (${target.nisn})?\n\nTindakan ini tidak bisa dibatalkan.`
    );
    if (!ok) return;

    try {
      // Hapus dok utama siswa
      await deleteDoc(doc(db, "siswa", String(id)));

      // ==== JIKA MAU HAPUS DI SISTEM LAIN JUGA, CONTOH: ====
      // await deleteDoc(doc(db, "raport", String(id)));
      // await deleteDoc(doc(db, "nilai", String(id)));
      // (sesuaikan nama koleksi dengan struktur punyamu)

      await fetchSiswa();
      alert("🗑 Data siswa berhasil dihapus.");
    } catch (e) {
      console.error(e);
      alert("⚠️ Gagal menghapus data siswa.");
    }
  };

  /* -------- Derivasi daftar kelas (dataset kelas) -------- */
  const kelasSet = useMemo(() => {
    const s = new Set(
      siswaList.map((x) => normalize(x.kelas)).filter(Boolean)
    );
    return Array.from(s).sort((a, b) => a.localeCompare(b, "id"));
  }, [siswaList]);

   // Jika belum ada kelas terpilih, pilih otomatis kelas pertama
  useEffect(() => {
    if (!selectedKelas && kelasSet.length > 0) {
      setSelectedKelas(kelasSet[0]);
    }
  }, [kelasSet, selectedKelas]);

    /* -------- Derivasi filter + limit 50 -------- */
  const filtered = useMemo(
    () =>
      siswaList.filter((x) =>
        !selectedKelas
          ? false // kalau belum pilih kelas, jangan tampilkan apa-apa
          : normalize(x.kelas) === normalize(selectedKelas)
      ),
    [siswaList, selectedKelas]
  );
  const visible = useMemo(() => filtered.slice(0, PAGE_LIMIT), [filtered]);

  /* -------- Form handlers -------- */
  const handleChangeForm = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    const payload = {
      nisn: normalize(formData.nisn),
      nama_siswa: normalize(formData.nama_siswa),
      nama_ar: normalize(formData.nama_ar),
      kelas: normalize(formData.kelas),
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    };
    if (!required(payload, ["nisn", "nama_siswa", "kelas"])) {
      alert("❌ NISN, Nama, dan Kelas wajib diisi");
      return;
    }
    try {
      setSaving(true);
      // idempotent: doc id = nisn
      await setDoc(doc(collection(db, "siswa"), payload.nisn), payload, {
        merge: true,
      });
      setFormData({ nisn: "", nama_siswa: "", nama_ar: "", kelas: "" });
      await fetchSiswa();
      alert("✅ Data siswa disimpan");
    } catch (e) {
      console.error(e);
      alert("⚠️ Gagal menyimpan data siswa");
    } finally {
      setSaving(false);
    }
  };

  /* -------- Upload Excel --------
     Header yang diharapkan:
     No | NISN | Nama | Nama Arab | Kelas
  --------------------------------------- */
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const parsed = XLSX.utils.sheet_to_json(ws, { defval: "" });
      setRowsPreview(parsed);
    };
    reader.readAsArrayBuffer(file);
  };

  const saveExcelToFirestore = async () => {
    if (!rowsPreview.length) return alert("❌ Tidak ada data yang diupload");
    try {
      let ok = 0;
      for (let i = 0; i < rowsPreview.length; i++) {
        const row = rowsPreview[i] || {};
        // toleransi nama kolom (case-sensitive sesuai contoh)
        const nisn = normalize(row.NISN);
        const nama = normalize(row.Nama);
        const nama_ar = normalize(row["Nama Arab"]);
        const kelas = normalize(row.Kelas);
        if (!nisn || !nama || !kelas) continue;

        await setDoc(
          doc(collection(db, "siswa"), nisn),
          {
            nisn,
            nama_siswa: nama,
            nama_ar,
            kelas,
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );
        ok++;
      }
      setRowsPreview([]);
      await fetchSiswa();
      alert(`✅ ${ok} baris berhasil disimpan ke Firestore`);
    } catch (e) {
      console.error(e);
      alert("⚠️ Gagal menyimpan data dari Excel");
    }
  };

  /* -------- Download Template Excel -------- */
  const downloadTemplate = () => {
    const header = [["No", "NISN", "Nama", "Nama Arab", "Kelas"]];
    const sample = [
      [1, "0092091253", "WA ODE NUR ALAM", "وا أودي نور علام", "9A"],
      [2, "", "", "", ""],
      [3, "", "", "", ""],
    ];
    const ws = XLSX.utils.aoa_to_sheet([...header, ...sample]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Siswa");
    XLSX.writeFile(wb, "template_siswa.xlsx");
  };

  /* -------- Download Data saat ini -------- */
  const downloadDataNow = () => {
    const header = [["No", "NISN", "Nama", "Nama Arab", "Kelas"]];
    const body = siswaList.map((s, i) => [
      i + 1,
      s.nisn || "",
      s.nama_siswa || "",
      s.nama_ar || "",
      s.kelas || "",
    ]);
    const ws = XLSX.utils.aoa_to_sheet([...header, ...body]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data Siswa");
    XLSX.writeFile(wb, "data_siswa.xlsx");
  };

  /* -------- Edit modal -------- */
  const openEdit = (row) => {
    setEditId(row.id);
    setEditDraft({
      nisn: row.nisn || "",
      nama_siswa: row.nama_siswa || "",
      nama_ar: row.nama_ar || "",
      kelas: normalize(row.kelas) || "",
    });
    setModalOpen(true);
  };
  const closeEdit = () => {
    setModalOpen(false);
    setEditId(null);
    setEditDraft({ nisn: "", nama_siswa: "", nama_ar: "", kelas: "" });
  };
  const saveEdit = async () => {
    const { nisn, nama_siswa, nama_ar, kelas } = editDraft;
    if (!normalize(nisn) || !normalize(nama_siswa) || !normalize(kelas)) {
      alert("❌ NISN, Nama, dan Kelas wajib diisi");
      return;
    }
    try {
      setEditSaving(true);
      await updateDoc(doc(db, "siswa", String(nisn)), {
        nama_siswa: normalize(nama_siswa),
        nama_ar: normalize(nama_ar),
        kelas: normalize(kelas),
        updatedAt: serverTimestamp(),
      });
      await fetchSiswa();
      closeEdit();
      alert("✏️ Perubahan disimpan");
    } catch (e) {
      console.error(e);
      alert("⚠️ Gagal menyimpan perubahan");
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 py-10 px-6 text-black">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* ======= HEADER ======= */}
        <div className="text-center">
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900">
            👨‍🎓 Input & Upload Data Siswa
          </h1>
          <p className="text-slate-600 mt-1">
            Tambah manual, unggah Excel, dan filter per kelas. Tampilan
            dibatasi maksimal 50 baris.
          </p>
        </div>

        {/* ======= FORM TAMBAH (kelas dari dataset) ======= */}
        <SectionCard title="➕ Tambah Siswa (Form)">
          <form
            onSubmit={handleSubmitForm}
            className="grid grid-cols-1 md:grid-cols-5 gap-4"
          >
            <input
              type="text"
              name="nisn"
              placeholder="NISN"
              value={formData.nisn}
              onChange={handleChangeForm}
              className="border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
              required
            />
            <input
              type="text"
              name="nama_siswa"
              placeholder="Nama"
              value={formData.nama_siswa}
              onChange={handleChangeForm}
              className="border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
              required
            />
            <input
              type="text"
              name="nama_ar"
              placeholder="Nama Arab (wajib)"
              value={formData.nama_ar}
              onChange={handleChangeForm}
              className="border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />

            {/* kelas dari dataset */}
            <div className="md:col-span-1">
              <SelectKelas
                value={formData.kelas}
                onChange={(v) =>
                  setFormData((p) => ({
                    ...p,
                    kelas: v,
                  }))
                }
                options={kelasSet}
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="rounded-md px-4 py-2 text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving ? "Menyimpan..." : "💾 Simpan"}
            </button>
          </form>
        </SectionCard>

        {/* ======= UPLOAD & TEMPLATE ======= */}
        <SectionCard title="📂 Upload Excel & Template">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="text-slate-900"
            />
            <button
              onClick={saveExcelToFirestore}
              disabled={!rowsPreview.length}
              className="rounded-md px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
            >
              🚀 Simpan dari Excel
            </button>
            <div className="flex-1" />
            <button
              onClick={downloadTemplate}
              className="rounded-md px-4 py-2 text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-100"
            >
              ⬇️ Download Template (.xlsx)
            </button>
            <button
              onClick={downloadDataNow}
              className="rounded-md px-4 py-2 text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-100"
            >
              ⬇️ Download Data Siswa
            </button>
          </div>

          {/* Preview upload */}
          {rowsPreview.length > 0 && (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm mt-4">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-slate-100">
                  <tr className="text-slate-700">
                    {Object.keys(rowsPreview[0]).map((k) => (
                      <th
                        key={k}
                        className="px-3 py-2 border border-slate-200 text-left"
                      >
                        {k}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-slate-800">
                  {rowsPreview.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      {Object.values(row).map((v, j) => (
                        <td
                          key={j}
                          className="px-3 py-2 border border-slate-200"
                        >
                          {String(v)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-slate-500 px-2 py-2">
                Menampilkan {rowsPreview.length} baris dari file Excel.
                Pastikan header: <b>No, NISN, Nama, Nama Arab, Kelas</b>.
              </p>
            </div>
          )}
        </SectionCard>

        {/* ======= FILTER & TABEL SISWA (limit 50) ======= */}
        <SectionCard title="📋 Data Siswa">
          {/* Filter kelas */}
          <div className="mb-3 flex flex-col md:flex-row gap-3 items-start md:items-center">
            <div>
              <label className="block text-sm text-slate-700 mb-1">
                Filter Kelas
              </label>
              <select
  value={selectedKelas}
  onChange={(e) => setSelectedKelas(e.target.value)}
  className="border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
>
  {kelasSet.length === 0 ? (
    <option value="">Belum ada kelas</option>
  ) : (
    kelasSet.map((k) => (
      <option key={k} value={k}>
        {k}
      </option>
    ))
  )}
</select>
            </div>
            <div className="text-sm text-slate-600">
              Menampilkan <b>{visible.length}</b> dari{" "}
              <b>{filtered.length}</b> data (maks 50).
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-slate-100">
                <tr className="text-slate-700">
                  <th className="px-3 py-2 border border-slate-200 text-center w-14">
                    No
                  </th>
                  <th className="px-3 py-2 border border-slate-200">NISN</th>
                  <th className="px-3 py-2 border border-slate-200">Nama</th>
                  <th
                    className="px-3 py-2 border border-slate-200 text-right"
                    dir="rtl"
                  >
                    الاسم العربي
                  </th>
                  <th className="px-3 py-2 border border-slate-200 text-center w-24">
                    Kelas
                  </th>
                  <th className="px-3 py-2 border border-slate-200 text-center w-40">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="text-slate-800">
                {loading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-6 text-center text-slate-500"
                    >
                      Memuat…
                    </td>
                  </tr>
                ) : visible.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-6 text-center text-slate-500"
                    >
                      Tidak ada data untuk filter ini.
                    </td>
                  </tr>
                ) : (
                  visible.map((s, i) => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 border border-slate-200 text-center">
                        {i + 1}
                      </td>
                      <td className="px-3 py-2 border border-slate-200">
                        {s.nisn}
                      </td>
                      <td className="px-3 py-2 border border-slate-200">
                        {s.nama_siswa}
                      </td>
                      <td
                        className="px-3 py-2 border border-slate-200 text-right"
                        dir="rtl"
                      >
                        {s.nama_ar || ""}
                      </td>
                      <td className="px-3 py-2 border border-slate-200 text-center">
                        <span className="inline-block rounded-md px-2 py-1 text-xs bg-slate-100 text-slate-700">
                          {s.kelas}
                        </span>
                      </td>
                      <td className="px-3 py-2 border border-slate-200 text-center">
                        <div className="inline-flex gap-2">
                          <button
                            onClick={() => openEdit(s)}
                            className="px-3 py-1.5 rounded-md text-xs font-medium bg-amber-500 text-white hover:bg-amber-600"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => handleDelete(s.id)}
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
      </div>

      {/* ======= MODAL EDIT ======= */}
      <Modal open={modalOpen} title="✏️ Edit Siswa" onClose={closeEdit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm text-slate-700 mb-1">
              NISN (ID Dokumen)
            </label>
            <input
              type="text"
              value={editDraft.nisn}
              disabled
              className="w-full border border-slate-300 rounded-md px-3 py-2 bg-slate-50 text-slate-600"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-700 mb-1">Nama</label>
            <input
              type="text"
              value={editDraft.nama_siswa}
              onChange={(e) =>
                setEditDraft((p) => ({
                  ...p,
                  nama_siswa: e.target.value,
                }))
              }
              className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-700 mb-1">
              Nama Arab
            </label>
            <input
              type="text"
              value={editDraft.nama_ar}
              onChange={(e) =>
                setEditDraft((p) => ({
                  ...p,
                  nama_ar: e.target.value,
                }))
              }
              className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm text-slate-700 mb-1">Kelas </label>
            <SelectKelas
              value={editDraft.kelas}
              onChange={(v) =>
                setEditDraft((p) => ({
                  ...p,
                  kelas: v,
                }))
              }
              options={kelasSet}
            />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            onClick={closeEdit}
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

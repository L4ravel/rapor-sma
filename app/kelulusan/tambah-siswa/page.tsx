/* Halaman master siswa kelulusan dengan tambah/edit siswa, filter jurusan, import Excel, export Excel, dan validasi NISN unik. */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import * as XLSX from "xlsx";
import { db } from "@/lib/firebaseConfig";

type JurusanItem = {
  id: string;
  nama: string;
};

type MapelItem = {
  id: string;
  nama: string;
  jurusanId: string;
  jurusanNama: string;
};

type SiswaItem = {
  id: string;
  nisn: string;
  nama: string;
  ttl: string;
  orangTua: string;
  npsn: string;
  programJurusanId: string;
  programJurusanNama: string;
  mapelSnapshot: Array<{ mapelId: string; nama: string }>;
  nilaiByMapelId: Record<string, string>;
};

type FormState = {
  nisn: string;
  nama: string;
  ttl: string;
  orangTua: string;
  npsn: string;
  programJurusanId: string;
};

function Blob({ from = "#334155", to = "#111827" }) {
  const id = `g${from.replace("#", "")}${to.replace("#", "")}`;

  return (
    <svg viewBox="0 0 300 220" className="h-28 w-40 opacity-90 md:h-32 md:w-48">
      <defs>
        <linearGradient id={id} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>
      <path
        d="M204.6 32.2c25.7 17.3 45 36.4 43.7 63.3-1.2 26.8-23.1 61.4-50.4 74.7-27.3 13.2-60 5.2-86.6-10.3-26.6-15.6-47.3-39.5-44.7-62.2 2.6-22.6 30.4-43.9 58.4-58.1 28.1-14.1 57.9-24.7 79.6-7.4Z"
        fill={`url(#${id})`}
        className="drop-shadow-md"
      />
    </svg>
  );
}

function emptyForm(): FormState {
  return {
    nisn: "",
    nama: "",
    ttl: "",
    orangTua: "",
    npsn: "",
    programJurusanId: "",
  };
}

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function normalizeKey(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[./_-]/g, " ");
}

function getExcelValue(row: Record<string, unknown>, keys: string[]) {
  const entries = Object.entries(row);

  for (const key of keys) {
    const found = entries.find(([rowKey]) => normalizeKey(rowKey) === normalizeKey(key));
    if (found) return normalizeText(found[1]);
  }

  return "";
}

export default function TambahSiswaKelulusanPage() {
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  const [jurusanList, setJurusanList] = useState<JurusanItem[]>([]);
  const [siswaList, setSiswaList] = useState<SiswaItem[]>([]);

  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState<FormState>(emptyForm());
  const [keyword, setKeyword] = useState("");
  const [filterJurusanId, setFilterJurusanId] = useState("");

  const jurusanCol = collection(db, "kelulusan_program_jurusan");
  const mapelCol = collection(db, "kelulusan_mapel");
  const siswaCol = collection(db, "kelulusan_siswa");

  async function loadJurusan() {
    const snap = await getDocs(jurusanCol);
    const rows = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<JurusanItem, "id">) }))
      .sort((a, b) => (a.nama || "").localeCompare(b.nama || "", "id"));

    setJurusanList(rows);
    return rows;
  }

  async function loadSiswa() {
    const snap = await getDocs(siswaCol);
    const rows = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<SiswaItem, "id">) }))
      .sort((a, b) => (a.nama || "").localeCompare(b.nama || "", "id"));

    setSiswaList(rows);
    return rows;
  }

  async function loadAll() {
    try {
      setLoading(true);
      await Promise.all([loadJurusan(), loadSiswa()]);
    } catch (e) {
      console.error(e);
      alert("⚠️ Gagal memuat data siswa kelulusan");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const selectedJurusan = useMemo(
    () => jurusanList.find((j) => j.id === form.programJurusanId) || null,
    [jurusanList, form.programJurusanId]
  );

  const filteredSiswa = useMemo(() => {
    const q = keyword.trim().toLowerCase();

    return siswaList.filter((item) => {
      const matchJurusan = filterJurusanId
        ? item.programJurusanId === filterJurusanId
        : true;

      const matchKeyword = q
        ? [
            item.nisn,
            item.nama,
            item.ttl,
            item.orangTua,
            item.npsn,
            item.programJurusanNama,
          ]
            .join(" ")
            .toLowerCase()
            .includes(q)
        : true;

      return matchJurusan && matchKeyword;
    });
  }, [keyword, filterJurusanId, siswaList]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function getMapelSnapshotByJurusan(jurusanId: string) {
    if (!jurusanId) return [];

    const snap = await getDocs(query(mapelCol, where("jurusanId", "==", jurusanId)));

    return snap.docs
      .map((d) => ({
        id: d.id,
        ...(d.data() as Omit<MapelItem, "id">),
      }))
      .sort((a, b) => (a.nama || "").localeCompare(b.nama || "", "id"))
      .map((item) => ({
        mapelId: item.id,
        nama: item.nama,
      }));
  }

  async function isNisnExists(nisn: string, ignoredId = "") {
    const cleanNisn = nisn.trim();
    if (!cleanNisn) return false;

    const snap = await getDocs(
      query(siswaCol, where("nisn", "==", cleanNisn), limit(1))
    );

    if (snap.empty) return false;

    const foundDoc = snap.docs[0];
    return foundDoc.id !== ignoredId;
  }

  async function saveSiswa(e: React.FormEvent) {
    e.preventDefault();

    if (!form.nisn.trim()) return alert("❌ NISN wajib diisi");
    if (!form.nama.trim()) return alert("❌ Nama siswa wajib diisi");
    if (!form.ttl.trim()) return alert("❌ Tempat dan Tanggal Lahir wajib diisi");
    if (!form.orangTua.trim()) return alert("❌ Nama Orang Tua/Wali wajib diisi");
    if (!form.programJurusanId) return alert("❌ Program jurusan wajib dipilih");

    const jurusan = jurusanList.find((j) => j.id === form.programJurusanId);
    if (!jurusan) return alert("❌ Program jurusan tidak ditemukan");

    try {
      setSaving(true);

      const nisnSudahAda = await isNisnExists(form.nisn, editingId);
      if (nisnSudahAda) {
        alert("❌ NISN sudah terdaftar. Gunakan NISN lain.");
        return;
      }

      const snapshot = await getMapelSnapshotByJurusan(form.programJurusanId);
      const nilaiByMapelId = Object.fromEntries(snapshot.map((m) => [m.mapelId, ""]));

      const payload = {
        nisn: form.nisn.trim(),
        nama: form.nama.trim(),
        ttl: form.ttl.trim(),
        orangTua: form.orangTua.trim(),
        npsn: form.npsn.trim(),
        programJurusanId: jurusan.id,
        programJurusanNama: jurusan.nama,
        mapelSnapshot: snapshot,
        nilaiByMapelId,
        updatedAt: serverTimestamp(),
      };

      if (editingId) {
        await updateDoc(doc(db, "kelulusan_siswa", editingId), payload);
      } else {
        await addDoc(siswaCol, {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }

      setForm(emptyForm());
      setEditingId("");
      await loadSiswa();
    } catch (e) {
      console.error(e);
      alert("⚠️ Gagal menyimpan data siswa");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(item: SiswaItem) {
    setEditingId(item.id);
    setForm({
      nisn: item.nisn || "",
      nama: item.nama || "",
      ttl: item.ttl || "",
      orangTua: item.orangTua || "",
      npsn: item.npsn || "",
      programJurusanId: item.programJurusanId || "",
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function removeSiswa(item: SiswaItem) {
    const ok = confirm(`Hapus siswa "${item.nama}"?`);
    if (!ok) return;

    try {
      await deleteDoc(doc(db, "kelulusan_siswa", item.id));
      await loadSiswa();
    } catch (e) {
      console.error(e);
      alert("⚠️ Gagal menghapus siswa");
    }
  }

  function exportExcel() {
    const data = filteredSiswa.map((item, index) => ({
      No: index + 1,
      NISN: item.nisn || "",
      Nama: item.nama || "",
      TTL: item.ttl || "",
      "Orang Tua / Wali": item.orangTua || "",
      Jurusan: item.programJurusanNama || "",
      NPSN: item.npsn || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Siswa Kelulusan");
    XLSX.writeFile(workbook, "daftar-siswa-kelulusan.xlsx");
  }

  async function importExcel(file: File) {
    try {
      setImporting(true);

      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];

      if (!sheetName) {
        alert("❌ File Excel tidak memiliki sheet");
        return;
      }

      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
        defval: "",
      });

      if (rows.length === 0) {
        alert("❌ File Excel kosong");
        return;
      }

      let successCount = 0;
      const failedRows: string[] = [];
      const nisnInFile = new Set<string>();

      for (let index = 0; index < rows.length; index++) {
        const row = rows[index];

        const nisn = getExcelValue(row, ["NISN"]);
        const nama = getExcelValue(row, ["Nama", "Nama Siswa"]);
        const ttl = getExcelValue(row, ["TTL", "Tempat dan Tanggal Lahir"]);
        const orangTua = getExcelValue(row, [
          "Orang Tua / Wali",
          "Orang Tua",
          "Nama Orang Tua",
          "Wali",
        ]);
        const npsn = getExcelValue(row, ["NPSN"]);
        const jurusanValue = getExcelValue(row, [
          "Jurusan",
          "Program Jurusan",
          "Program",
          "Program Keahlian",
        ]);

        if (!nisn || !nama || !ttl || !orangTua || !jurusanValue) {
          failedRows.push(`Baris ${index + 2}: data wajib belum lengkap`);
          continue;
        }

        if (nisnInFile.has(nisn)) {
          failedRows.push(
  `Baris ${index + 2}: ${nama || "Tanpa Nama"} - NISN "${nisn}" duplikat di file Excel`
);
          continue;
        }

        nisnInFile.add(nisn);

        const nisnSudahAda = await isNisnExists(nisn);
        if (nisnSudahAda) {
          failedRows.push(
  `Baris ${index + 2}: ${nama || "Tanpa Nama"} - NISN "${nisn}" sudah terdaftar`
);
          continue;
        }

        const jurusan = jurusanList.find(
          (item) =>
            item.id === jurusanValue ||
            normalizeKey(item.nama) === normalizeKey(jurusanValue)
        );

        if (!jurusan) {
        failedRows.push(
  `Baris ${index + 2}: ${nama || "Tanpa Nama"} - jurusan "${jurusanValue}" tidak ditemukan`
);
          continue;
        }

        const snapshot = await getMapelSnapshotByJurusan(jurusan.id);
        const nilaiByMapelId = Object.fromEntries(snapshot.map((m) => [m.mapelId, ""]));

        await addDoc(siswaCol, {
          nisn,
          nama,
          ttl,
          orangTua,
          npsn,
          programJurusanId: jurusan.id,
          programJurusanNama: jurusan.nama,
          mapelSnapshot: snapshot,
          nilaiByMapelId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        successCount++;
      }

      await loadSiswa();

      if (failedRows.length > 0) {
        alert(
          `✅ Berhasil import ${successCount} siswa.\n\n⚠️ Gagal:\n${failedRows
            .slice(0, 10)
            .join("\n")}${failedRows.length > 10 ? "\n..." : ""}`
        );
      } else {
        alert(`✅ Berhasil import ${successCount} siswa`);
      }
    } catch (e) {
      console.error(e);
      alert("⚠️ Gagal import file Excel");
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  function downloadTemplateExcel() {
    const data = [
      {
        NISN: "1234567890",
        Nama: "Nama Siswa",
        TTL: "Lombok, 12 Januari 2006",
        "Orang Tua / Wali": "Nama Wali",
        Jurusan: jurusanList[0]?.nama || "Nama Jurusan",
        NPSN: "50200000",
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Template Siswa");
    XLSX.writeFile(workbook, "template-import-siswa-kelulusan.xlsx");
  }

  return (
    <div className="min-h-screen bg-slate-100 px-6 py-10 text-black">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white/95 shadow-md transition hover:border-slate-300 hover:shadow-2xl">
          <div className="w-full rounded-t-3xl bg-slate-900 px-6 py-3 text-sm font-semibold tracking-wide text-white md:text-base">
            Tambah Siswa Kelulusan
          </div>

          <div className="flex items-center gap-4 px-6 pt-5">
            <Blob from="#2563EB" to="#0F172A" />
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500">
                Kelulusan
              </div>
              <div className="text-xl font-black text-slate-800 md:text-2xl">
                👨‍🎓 Master Siswa
              </div>
              <div className="mt-1 text-slate-600">
                Total: <b>{siswaList.length}</b> siswa
              </div>
            </div>
          </div>

          <div className="px-6 pb-6 pt-4">
            <form onSubmit={saveSiswa} className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-slate-700">NISN</label>
                <input
                  value={form.nisn}
                  onChange={(e) => setField("nisn", e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="Nomor Induk Siswa Nasional"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-700">Nama</label>
                <input
                  value={form.nama}
                  onChange={(e) => setField("nama", e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="Nama siswa"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-700">
                  Tempat dan Tanggal Lahir
                </label>
                <input
                  value={form.ttl}
                  onChange={(e) => setField("ttl", e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="Contoh: Lombok, 12 Januari 2006"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-700">
                  Nama Orang Tua / Wali
                </label>
                <input
                  value={form.orangTua}
                  onChange={(e) => setField("orangTua", e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="Nama orang tua / wali"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-700">NPSN</label>
                <input
                  value={form.npsn}
                  onChange={(e) => setField("npsn", e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="Nomor Pokok Sekolah Nasional"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-700">
                  Program Jurusan
                </label>
                <select
                  value={form.programJurusanId}
                  onChange={(e) => setField("programJurusanId", e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
                >
                  <option value="">— Pilih Program Jurusan —</option>
                  {jurusanList.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nama}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-700">
                  Preview mapel dari jurusan terpilih
                </div>
                {!selectedJurusan ? (
                  <p className="mt-2 text-sm text-slate-500">Belum memilih jurusan.</p>
                ) : (
                  <PreviewMapel jurusanId={selectedJurusan.id} />
                )}
              </div>

              <div className="md:col-span-2 flex flex-wrap justify-end gap-3">
                {editingId ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId("");
                      setForm(emptyForm());
                    }}
                    className="rounded-md bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300"
                  >
                    Batal Edit
                  </button>
                ) : null}

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Tambah Siswa"}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white/95 shadow-md transition hover:border-slate-300 hover:shadow-2xl">
          <div className="w-full rounded-t-3xl bg-slate-900 px-6 py-3 text-sm font-semibold tracking-wide text-white md:text-base">
            Daftar Siswa Kelulusan
          </div>

          <div className="px-6 pb-6 pt-5">
            <input
              ref={importInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) importExcel(file);
              }}
              className="hidden"
            />

            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2">
                <input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Cari NISN, nama, wali, TTL, NPSN, atau jurusan..."
                  className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
                />

                <select
                  value={filterJurusanId}
                  onChange={(e) => setFilterJurusanId(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
                >
                  <option value="">Semua Jurusan</option>
                  {jurusanList.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nama}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap gap-2 lg:justify-end">
                <button
                  type="button"
                  onClick={downloadTemplateExcel}
                  className="rounded-md bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300"
                >
                  Template
                </button>

                <button
                  type="button"
                  onClick={() => importInputRef.current?.click()}
                  disabled={importing}
                  className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {importing ? "Import..." : "Import Excel"}
                </button>

                <button
                  type="button"
                  onClick={exportExcel}
                  disabled={filteredSiswa.length === 0}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Export Excel
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px] border-collapse text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="w-12 border p-2 text-center">No</th>
                      <th className="border p-2 text-left">NISN</th>
                      <th className="border p-2 text-left">Nama</th>
                      <th className="border p-2 text-left">TTL</th>
                      <th className="border p-2 text-left">Orang Tua / Wali</th>
                      <th className="border p-2 text-left">Jurusan</th>
                      <th className="border p-2 text-left">NPSN</th>
                      <th className="w-40 border p-2 text-center">Aksi</th>
                    </tr>
                  </thead>

                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="p-4 text-center text-slate-500">
                          Memuat...
                        </td>
                      </tr>
                    ) : filteredSiswa.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-4 text-center text-slate-500">
                          Belum ada siswa kelulusan.
                        </td>
                      </tr>
                    ) : (
                      filteredSiswa.map((item, i) => (
                        <tr key={item.id} className="odd:bg-white even:bg-slate-50">
                          <td className="border p-2 text-center">{i + 1}</td>
                          <td className="border p-2">{item.nisn || "—"}</td>
                          <td className="border p-2 font-medium">{item.nama}</td>
                          <td className="border p-2">{item.ttl}</td>
                          <td className="border p-2">{item.orangTua}</td>
                          <td className="border p-2">{item.programJurusanNama}</td>
                          <td className="border p-2">{item.npsn || "—"}</td>
                          <td className="border p-2 text-center">
                            <div className="flex flex-wrap justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => startEdit(item)}
                                className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600"
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() => removeSiswa(item)}
                                className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700"
                              >
                                Hapus
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="mt-3 text-xs text-slate-500">
              Format import Excel minimal berisi kolom: NISN, Nama, TTL, Orang Tua / Wali,
              Jurusan, dan NPSN. NISN tidak boleh sama, sedangkan NPSN boleh sama.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewMapel({ jurusanId }: { jurusanId: string }) {
  const [mapel, setMapel] = useState<Array<{ id: string; nama: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function run() {
      try {
        setLoading(true);

        const snap = await getDocs(
          query(collection(db, "kelulusan_mapel"), where("jurusanId", "==", jurusanId))
        );

        const rows = snap.docs
          .map((d) => ({
            id: d.id,
            nama: String(d.data()?.nama || ""),
          }))
          .sort((a, b) => a.nama.localeCompare(b.nama, "id"));

        if (active) setMapel(rows);
      } catch (e) {
        console.error(e);
        if (active) setMapel([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    run();

    return () => {
      active = false;
    };
  }, [jurusanId]);

  if (loading) {
    return <p className="mt-2 text-sm text-slate-500">Memuat mapel...</p>;
  }

  if (mapel.length === 0) {
    return (
      <p className="mt-2 text-sm text-slate-500">
        Belum ada mapel pada jurusan ini.
      </p>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {mapel.map((item) => (
        <span
          key={item.id}
          className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200"
        >
          {item.nama}
        </span>
      ))}
    </div>
  );
}
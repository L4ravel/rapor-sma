"use client";

import { useEffect, useState } from "react";
import { db, storage } from "@/lib/firebaseConfig";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

/* ---------- UI helper: Section Card ---------- */
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

export default function BioSekolahPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // data form yang akan disimpan ke Firestore
  const [form, setForm] = useState({
    nama_sekolah: "",
    alamat: "",
    // semester & tahun pelajaran (umum + arab)
    semesterUmum: "",
    semesterArab: "",
    tahunPelajaranUmum: "",
    tahunPelajaranArab: "",
    fase: "",
    kepala_sekolah: "",
    kepala_sekolah_ttd: "", // URL tanda tangan di Storage
    // baru: waktu pembagian raport & kop rapor
    waktuPembagianRaport: "",
    kopRaporUrl: "",
  });

  // data preview tampilan
  const [preview, setPreview] = useState({
    nama_sekolah: "",
    alamat: "",
    semesterUmum: "",
    semesterArab: "",
    tahunPelajaranUmum: "",
    tahunPelajaranArab: "",
    fase: "",
    kepala_sekolah: "",
    kepala_sekolah_ttd: "",
    waktuPembagianRaport: "",
    kopRaporUrl: "",
    updatedAt: null,
  });

  // file tanda tangan yang baru dipilih (belum di-upload)
  const [ttdFile, setTtdFile] = useState(null);
  const [localTTDPreview, setLocalTTDPreview] = useState("");

  // file kop rapor yang baru dipilih (belum di-upload)
  const [kopRaporFile, setKopRaporFile] = useState(null);
  const [localKopRaporPreview, setLocalKopRaporPreview] = useState("");

  const refBio = doc(db, "bio_sekolah", "default"); // single doc pusat

  /* -------- Load data on mount -------- */
  useEffect(() => {
    const run = async () => {
      try {
        const snap = await getDoc(refBio);
        if (snap.exists()) {
          const d = snap.data() || {};
          setForm({
            nama_sekolah: d.nama_sekolah || "",
            alamat: d.alamat || "",
            semesterUmum: d.semesterUmum || "",
            semesterArab: d.semesterArab || "",
            tahunPelajaranUmum: d.tahunPelajaranUmum || "",
            tahunPelajaranArab: d.tahunPelajaranArab || "",
            fase: d.fase || "",
            kepala_sekolah: d.kepala_sekolah || "",
            kepala_sekolah_ttd: d.kepala_sekolah_ttd || "",
            waktuPembagianRaport: d.waktuPembagianRaport || "",
            kopRaporUrl: d.kopRaporUrl || "",
          });
          setPreview({
            nama_sekolah: d.nama_sekolah || "",
            alamat: d.alamat || "",
            semesterUmum: d.semesterUmum || "",
            semesterArab: d.semesterArab || "",
            tahunPelajaranUmum: d.tahunPelajaranUmum || "",
            tahunPelajaranArab: d.tahunPelajaranArab || "",
            fase: d.fase || "",
            kepala_sekolah: d.kepala_sekolah || "",
            kepala_sekolah_ttd: d.kepala_sekolah_ttd || "",
            waktuPembagianRaport: d.waktuPembagianRaport || "",
            kopRaporUrl: d.kopRaporUrl || "",
            updatedAt: d.updatedAt || d.createdAt || null,
          });
        }
      } catch (e) {
        console.error("Gagal memuat bio sekolah:", e);
        alert("⚠️ Gagal memuat data bio sekolah");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  /* -------- Handlers -------- */
  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  // pilih file tanda tangan kepala sekolah
  const onTtdChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setTtdFile(null);
      setLocalTTDPreview("");
      return;
    }

    if (!file.type.startsWith("image/")) {
      alert("❌ File harus berupa gambar (jpg, png, dsb.)");
      return;
    }
    const maxSize = 1024 * 1024; // 1MB
    if (file.size > maxSize) {
      alert("❌ Ukuran gambar tanda tangan maksimal 1MB");
      return;
    }

    setTtdFile(file);

    const url = URL.createObjectURL(file);
    setLocalTTDPreview((prev) => {
      if (prev && prev.startsWith("blob:")) {
        URL.revokeObjectURL(prev);
      }
      return url;
    });
  };

  // pilih file kop rapor (header rapor)
  const onKopRaporChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setKopRaporFile(null);
      setLocalKopRaporPreview("");
      return;
    }

    if (!file.type.startsWith("image/")) {
      alert("❌ File Kop Rapor harus berupa gambar (jpg, png, dsb.)");
      return;
    }
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      alert("❌ Ukuran gambar Kop Rapor maksimal 2MB");
      return;
    }

    setKopRaporFile(file);

    const url = URL.createObjectURL(file);
    setLocalKopRaporPreview((prev) => {
      if (prev && prev.startsWith("blob:")) {
        URL.revokeObjectURL(prev);
      }
      return url;
    });
  };

  const onSave = async (e) => {
    e.preventDefault();
    if (!form.nama_sekolah?.trim() || !form.alamat?.trim()) {
      alert("❌ Nama sekolah & Alamat wajib diisi");
      return;
    }

    try {
      setSaving(true);

      // siapkan URL tanda tangan (pakai yang lama, kecuali user upload baru)
      let ttdUrl = preview.kepala_sekolah_ttd || "";
      // siapkan URL kop rapor (pakai yang lama, kecuali user upload baru)
      let kopRaporUrl = preview.kopRaporUrl || "";

      // kalau ada file baru, upload ke Storage
      if (ttdFile) {
        const ext = ttdFile.name.split(".").pop()?.toLowerCase() || "png";
        const storageRef = ref(
          storage,
          `bio_sekolah/ttd_kepala_sekolah.${ext}`
        );
        await uploadBytes(storageRef, ttdFile);
        ttdUrl = await getDownloadURL(storageRef);
      }

      if (kopRaporFile) {
        const ext = kopRaporFile.name.split(".").pop()?.toLowerCase() || "png";
        const storageRef = ref(
          storage,
          `bio_sekolah/kop_rapor.${ext}`
        );
        await uploadBytes(storageRef, kopRaporFile);
        kopRaporUrl = await getDownloadURL(storageRef);
      }

      const payload = {
        nama_sekolah: form.nama_sekolah.trim(),
        alamat: form.alamat.trim(),
        semesterUmum: form.semesterUmum.trim(),
        semesterArab: form.semesterArab.trim(),
        tahunPelajaranUmum: form.tahunPelajaranUmum.trim(),
        tahunPelajaranArab: form.tahunPelajaranArab.trim(),
        fase: form.fase.trim(),
        kepala_sekolah: form.kepala_sekolah.trim(),
        waktuPembagianRaport: form.waktuPembagianRaport.trim(),
        updatedAt: serverTimestamp(),
      };

      if (ttdUrl) {
        payload.kepala_sekolah_ttd = ttdUrl;
      }
      if (kopRaporUrl) {
        payload.kopRaporUrl = kopRaporUrl;
      }

      // buat createdAt saat pertama kali
      const firstLoad =
        !preview.nama_sekolah &&
        !preview.alamat &&
        !preview.semesterUmum &&
        !preview.tahunPelajaranUmum &&
        !preview.fase &&
        !preview.kepala_sekolah &&
        !preview.kepala_sekolah_ttd;

      await setDoc(
        refBio,
        firstLoad
          ? { ...payload, createdAt: serverTimestamp() }
          : payload,
        { merge: true }
      );

      setPreview((p) => ({
        ...p,
        nama_sekolah: payload.nama_sekolah,
        alamat: payload.alamat,
        semesterUmum: payload.semesterUmum,
        semesterArab: payload.semesterArab,
        tahunPelajaranUmum: payload.tahunPelajaranUmum,
        tahunPelajaranArab: payload.tahunPelajaranArab,
        fase: payload.fase,
        kepala_sekolah: payload.kepala_sekolah,
        waktuPembagianRaport: payload.waktuPembagianRaport,
        kepala_sekolah_ttd: ttdUrl || p.kepala_sekolah_ttd || "",
        kopRaporUrl: kopRaporUrl || p.kopRaporUrl || "",
      }));

      setForm((p) => ({
        ...p,
        kepala_sekolah_ttd: ttdUrl || p.kepala_sekolah_ttd || "",
        kopRaporUrl: kopRaporUrl || p.kopRaporUrl || "",
      }));

      // setelah sukses, reset file lokal
      setTtdFile(null);
      if (localTTDPreview && localTTDPreview.startsWith("blob:")) {
        URL.revokeObjectURL(localTTDPreview);
      }
      setLocalTTDPreview("");

      setKopRaporFile(null);
      if (localKopRaporPreview && localKopRaporPreview.startsWith("blob:")) {
        URL.revokeObjectURL(localKopRaporPreview);
      }
      setLocalKopRaporPreview("");

      alert("✅ Bio sekolah disimpan");
    } catch (e) {
      console.error(e);
      alert("⚠️ Gagal menyimpan bio sekolah");
    } finally {
      setSaving(false);
    }
  };

  // handler untuk menghapus tanda tangan (clear field & state)
  const onDeleteTTD = async () => {
    if (
      !preview.kepala_sekolah_ttd &&
      !form.kepala_sekolah_ttd &&
      !localTTDPreview
    ) {
      return;
    }

    const ok = confirm("Hapus tanda tangan kepala sekolah?");
    if (!ok) return;

    try {
      setSaving(true);

      await setDoc(
        refBio,
        {
          kepala_sekolah_ttd: "",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setPreview((p) => ({ ...p, kepala_sekolah_ttd: "" }));
      setForm((p) => ({ ...p, kepala_sekolah_ttd: "" }));

      if (localTTDPreview && localTTDPreview.startsWith("blob:")) {
        URL.revokeObjectURL(localTTDPreview);
      }
      setLocalTTDPreview("");
      setTtdFile(null);

      alert("✅ Tanda tangan dihapus");
    } catch (e) {
      console.error(e);
      alert("⚠️ Gagal menghapus tanda tangan");
    } finally {
      setSaving(false);
    }
  };

  // handler untuk menghapus kop rapor (clear field & state)
  const onDeleteKopRapor = async () => {
    if (
      !preview.kopRaporUrl &&
      !form.kopRaporUrl &&
      !localKopRaporPreview
    ) {
      return;
    }

    const ok = confirm("Hapus gambar Kop Rapor?");
    if (!ok) return;

    try {
      setSaving(true);

      await setDoc(
        refBio,
        {
          kopRaporUrl: "",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setPreview((p) => ({ ...p, kopRaporUrl: "" }));
      setForm((p) => ({ ...p, kopRaporUrl: "" }));

      if (localKopRaporPreview && localKopRaporPreview.startsWith("blob:")) {
        URL.revokeObjectURL(localKopRaporPreview);
      }
      setLocalKopRaporPreview("");
      setKopRaporFile(null);

      alert("✅ Kop Rapor dihapus");
    } catch (e) {
      console.error(e);
      alert("⚠️ Gagal menghapus Kop Rapor");
    } finally {
      setSaving(false);
    }
  };

  const ttdPreviewUrl = localTTDPreview || preview.kepala_sekolah_ttd || "";
  const kopRaporPreviewUrl = localKopRaporPreview || preview.kopRaporUrl || "";

  // helper gabung Umum / Arab
  const joinUmumArab = (umum, arab) => {
    if (!umum && !arab) return "—";
    if (umum && arab) return `${umum} / ${arab}`;
    return umum || arab || "—";
  };

  return (
    <div className="min-h-screen bg-slate-100 py-10 px-6 text-black">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* ======= FORM ======= */}
        <SectionCard title="🏫 Bio Sekolah">
          {loading ? (
            <p className="text-center text-slate-600">⏳ Memuat...</p>
          ) : (
            <form
              onSubmit={onSave}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              <div className="md:col-span-2">
                <label className="block text-sm text-slate-700 mb-1">
                  Nama Sekolah
                </label>
                <input
                  type="text"
                  name="nama_sekolah"
                  value={form.nama_sekolah}
                  onChange={onChange}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="SMAS ISLAM ASSUNNAH BAGEK NYAKA"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm text-slate-700 mb-1">
                  Alamat
                </label>
                <textarea
                  name="alamat"
                  rows={3}
                  value={form.alamat}
                  onChange={onChange}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300 resize-y"
                  placeholder="Jln. Raya Lab. Lombok Km.55 ..."
                />
              </div>

              {/* Semester & Tahun Pelajaran (Umum) */}
              <div>
                <label className="block text-sm text-slate-700 mb-1">
                  Semester (Umum)
                </label>
                <input
                  type="text"
                  name="semesterUmum"
                  value={form.semesterUmum}
                  onChange={onChange}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-700 mb-1">
                  Tahun Pelajaran (Umum)
                </label>
                <input
                  type="text"
                  name="tahunPelajaranUmum"
                  value={form.tahunPelajaranUmum}
                  onChange={onChange}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>

              {/* Semester & Tahun Pelajaran (Arab) */}
              <div>
                <label className="block text-sm text-slate-700 mb-1">
                  Semester (Arab)
                </label>
                <input
                  type="text"
                  name="semesterArab"
                  value={form.semesterArab}
                  onChange={onChange}
                  dir="rtl"
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-right focus:outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="اكتب هنا الفصل بالعربية"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-700 mb-1">
                  Tahun Pelajaran (Arab)
                </label>
                <input
                  type="text"
                  name="tahunPelajaranArab"
                  value={form.tahunPelajaranArab}
                  onChange={onChange}
                  dir="rtl"
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-right focus:outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="اكتب هنا السنة الدراسية"
                />
              </div>

              {/* Fase & Kepala Sekolah */}
              <div>
                <label className="block text-sm text-slate-700 mb-1">
                  Fase
                </label>
                <input
                  type="text"
                  name="fase"
                  value={form.fase}
                  onChange={onChange}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="Contoh: Fase F (SMA)"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-700 mb-1">
                  Nama Kepala Sekolah
                </label>
                <input
                  type="text"
                  name="kepala_sekolah"
                  value={form.kepala_sekolah}
                  onChange={onChange}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="Nama Kepala Sekolah"
                />
              </div>

              {/* Waktu Pembagian Raport */}
              <div className="md:col-span-2">
                <label className="block text-sm text-slate-700 mb-1">
                  Waktu Pembagian Raport
                </label>
                <input
                  type="text"
                  name="waktuPembagianRaport"
                  value={form.waktuPembagianRaport}
                  onChange={onChange}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder='Contoh: Bagek Nyaka, 1 Oktober 2025'
                />
                <p className="mt-1 text-xs text-slate-500">
                  Teks ini nanti akan dipanggil di bagian bawah kop saat cetak rapor.
                </p>
              </div>

              {/* Upload Kop Rapor */}
              <div className="md:col-span-2">
                <label className="block text-sm text-slate-700 mb-1">
                  Kop Rapor (Gambar)
                </label>
                <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={onKopRaporChange}
                    className="text-sm"
                  />
                  {kopRaporPreviewUrl && (
                    <div className="flex items-center gap-2">
                      <img
                        src={kopRaporPreviewUrl}
                        alt="Kop Rapor"
                        className="h-20 w-40 object-contain rounded-md border border-slate-300 bg-white"
                      />
                      <span className="text-xs text-slate-500">
                        Pratinjau Kop Rapor
                      </span>
                    </div>
                  )}
                </div>
                <div className="mt-2 flex justify-between items-center gap-2">
                  <button
                    type="button"
                    onClick={onDeleteKopRapor}
                    disabled={
                      saving ||
                      (!preview.kopRaporUrl &&
                        !form.kopRaporUrl &&
                        !localKopRaporPreview)
                    }
                    className="rounded-md px-3 py-1.5 text-xs md:text-sm border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Hapus Kop Rapor
                  </button>
                  <span className="text-[11px] text-slate-500">
                    Gunakan gambar header rapor siap-cetak (format JPG/PNG).
                  </span>
                </div>
              </div>

              {/* Upload tanda tangan kepala sekolah */}
              <div className="md:col-span-2">
                <label className="block text-sm text-slate-700 mb-1">
                  Tanda Tangan Kepala Sekolah
                </label>
                <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={onTtdChange}
                    className="text-sm"
                  />
                  {ttdPreviewUrl && (
                    <div className="flex items-center gap-2">
                      <img
                        src={ttdPreviewUrl}
                        alt="Tanda tangan Kepala Sekolah"
                        className="h-20 w-32 object-contain rounded-md border border-slate-300 bg-white"
                      />
                      <span className="text-xs text-slate-500">
                        Pratinjau tanda tangan
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="md:col-span-2 flex items-center justify-between gap-2 mt-2">
                <button
                  type="button"
                  onClick={onDeleteTTD}
                  disabled={
                    saving ||
                    (!preview.kepala_sekolah_ttd &&
                      !form.kepala_sekolah_ttd &&
                      !localTTDPreview)
                  }
                  className="rounded-md px-4 py-2 text-xs md:text-sm border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  Hapus Tanda Tangan
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md px-5 py-2 text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {saving ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          )}
        </SectionCard>

        {/* ======= PRATINJAU ======= */}
        <SectionCard title="🧾 Pratinjau">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Tabel info */}
            <div className="flex-1">
              <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
                <table className="w-full border-collapse text-sm">
                  <tbody className="text-slate-800">
                    <tr className="bg-slate-50">
                      <td className="px-4 py-2 border border-slate-200 w-48">
                        Nama Sekolah
                      </td>
                      <td className="px-4 py-2 border border-slate-200">
                        {preview.nama_sekolah || "—"}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 border border-slate-200">
                        Alamat
                      </td>
                      <td className="px-4 py-2 border border-slate-200 whitespace-pre-wrap break-words">
                        {preview.alamat || "—"}
                      </td>
                    </tr>
                    <tr className="bg-slate-50">
                      <td className="px-4 py-2 border border-slate-200">
                        Semester
                      </td>
                      <td className="px-4 py-2 border border-slate-200">
                        {joinUmumArab(
                          preview.semesterUmum,
                          preview.semesterArab
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 border border-slate-200">
                        Tahun Pelajaran
                      </td>
                      <td className="px-4 py-2 border border-slate-200">
                        {joinUmumArab(
                          preview.tahunPelajaranUmum,
                          preview.tahunPelajaranArab
                        )}
                      </td>
                    </tr>
                    <tr className="bg-slate-50">
                      <td className="px-4 py-2 border border-slate-200">
                        Fase
                      </td>
                      <td className="px-4 py-2 border border-slate-200">
                        {preview.fase || "—"}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 border border-slate-200">
                        Kepala Sekolah
                      </td>
                      <td className="px-4 py-2 border border-slate-200">
                        {preview.kepala_sekolah || "—"}
                      </td>
                    </tr>
                    <tr className="bg-slate-50">
                      <td className="px-4 py-2 border border-slate-200">
                        Waktu Pembagian Raport
                      </td>
                      <td className="px-4 py-2 border border-slate-200">
                        {preview.waktuPembagianRaport || "—"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {preview.updatedAt && (
                <p className="mt-3 text-xs text-slate-500">
                  Terakhir diperbarui.
                </p>
              )}
            </div>

            {/* Preview tanda tangan & kop rapor di panel kanan */}
            <div className="w-full md:w-56 flex flex-col items-center gap-4">
              <div className="w-full flex flex-col items-center gap-2">
                <div className="h-28 w-full border border-slate-300 rounded-md overflow-hidden bg-white flex items-center justify-center">
                  {preview.kepala_sekolah_ttd ? (
                    <img
                      src={preview.kepala_sekolah_ttd}
                      alt="Tanda tangan Kepala Sekolah"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <span className="text-[11px] text-slate-400 text-center px-2">
                      Belum ada tanda tangan kepala sekolah
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-500">
                  Tanda tangan resmi Kepala Sekolah
                </span>
              </div>

              <div className="w-full flex flex-col items-center gap-2">
                <div className="h-24 w-full border border-slate-300 rounded-md overflow-hidden bg-white flex items-center justify-center">
                  {preview.kopRaporUrl ? (
                    <img
                      src={preview.kopRaporUrl}
                      alt="Kop Rapor"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <span className="text-[11px] text-slate-400 text-center px-2">
                      Belum ada gambar Kop Rapor
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-500">
                  Pratinjau Kop Rapor (header cetak)
                </span>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

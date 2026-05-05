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
    <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white/95 shadow-md">
      <div className="w-full rounded-t-3xl bg-slate-900 px-6 py-3 text-sm font-semibold tracking-wide text-white md:text-base">
        {title}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

export default function BioSekolahPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
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
    kopKelulusanUrl: "",
    ttdKelulusanUrl: "",
  });

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
    kopKelulusanUrl: "",
    ttdKelulusanUrl: "",
    updatedAt: null,
  });

  const [ttdFile, setTtdFile] = useState(null);
  const [localTTDPreview, setLocalTTDPreview] = useState("");

  const [kopRaporFile, setKopRaporFile] = useState(null);
  const [localKopRaporPreview, setLocalKopRaporPreview] = useState("");

  const [kopKelulusanFile, setKopKelulusanFile] = useState(null);
  const [localKopKelulusanPreview, setLocalKopKelulusanPreview] = useState("");

  const [ttdKelulusanFile, setTtdKelulusanFile] = useState(null);
  const [localTTDKelulusanPreview, setLocalTTDKelulusanPreview] = useState("");

  const refBio = doc(db, "bio_sekolah", "default");

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
            kopKelulusanUrl: d.kopKelulusanUrl || "",
            ttdKelulusanUrl: d.ttdKelulusanUrl || "",
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
            kopKelulusanUrl: d.kopKelulusanUrl || "",
            ttdKelulusanUrl: d.ttdKelulusanUrl || "",
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

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const handleImageSelect = ({
    event,
    setFile,
    setPreviewUrl,
    maxSizeMb,
    errorLabel,
  }) => {
    const file = event.target.files?.[0];
    if (!file) {
      setFile(null);
      setPreviewUrl("");
      return;
    }

    if (!file.type.startsWith("image/")) {
      alert(`❌ File ${errorLabel} harus berupa gambar (jpg, png, dsb.)`);
      return;
    }

    const maxSize = maxSizeMb * 1024 * 1024;
    if (file.size > maxSize) {
      alert(`❌ Ukuran gambar ${errorLabel} maksimal ${maxSizeMb}MB`);
      return;
    }

    setFile(file);

    const url = URL.createObjectURL(file);
    setPreviewUrl((prev) => {
      if (prev && prev.startsWith("blob:")) {
        URL.revokeObjectURL(prev);
      }
      return url;
    });
  };

  const onTtdChange = (e) => {
    handleImageSelect({
      event: e,
      setFile: setTtdFile,
      setPreviewUrl: setLocalTTDPreview,
      maxSizeMb: 1,
      errorLabel: "tanda tangan",
    });
  };

  const onKopRaporChange = (e) => {
    handleImageSelect({
      event: e,
      setFile: setKopRaporFile,
      setPreviewUrl: setLocalKopRaporPreview,
      maxSizeMb: 2,
      errorLabel: "Kop Rapor",
    });
  };

  const onKopKelulusanChange = (e) => {
    handleImageSelect({
      event: e,
      setFile: setKopKelulusanFile,
      setPreviewUrl: setLocalKopKelulusanPreview,
      maxSizeMb: 2,
      errorLabel: "Kop Kelulusan",
    });
  };

  const onTtdKelulusanChange = (e) => {
    handleImageSelect({
      event: e,
      setFile: setTtdKelulusanFile,
      setPreviewUrl: setLocalTTDKelulusanPreview,
      maxSizeMb: 1,
      errorLabel: "Tanda Tangan Kelulusan",
    });
  };

  const clearBlobPreview = (url, setter) => {
    if (url && url.startsWith("blob:")) {
      URL.revokeObjectURL(url);
    }
    setter("");
  };

  const onSave = async (e) => {
    e.preventDefault();

    if (!form.nama_sekolah?.trim() || !form.alamat?.trim()) {
      alert("❌ Nama sekolah & Alamat wajib diisi");
      return;
    }

    try {
      setSaving(true);

      let ttdUrl = preview.kepala_sekolah_ttd || "";
      let kopRaporUrl = preview.kopRaporUrl || "";
      let kopKelulusanUrl = preview.kopKelulusanUrl || "";
      let ttdKelulusanUrl = preview.ttdKelulusanUrl || "";

      if (ttdFile) {
        const ext = ttdFile.name.split(".").pop()?.toLowerCase() || "png";
        const storageRef = ref(storage, `bio_sekolah/ttd_kepala_sekolah.${ext}`);
        await uploadBytes(storageRef, ttdFile);
        ttdUrl = await getDownloadURL(storageRef);
      }

      if (kopRaporFile) {
        const ext = kopRaporFile.name.split(".").pop()?.toLowerCase() || "png";
        const storageRef = ref(storage, `bio_sekolah/kop_rapor.${ext}`);
        await uploadBytes(storageRef, kopRaporFile);
        kopRaporUrl = await getDownloadURL(storageRef);
      }

      if (kopKelulusanFile) {
        const ext = kopKelulusanFile.name.split(".").pop()?.toLowerCase() || "png";
        const storageRef = ref(storage, `bio_sekolah/kop_kelulusan.${ext}`);
        await uploadBytes(storageRef, kopKelulusanFile);
        kopKelulusanUrl = await getDownloadURL(storageRef);
      }

      if (ttdKelulusanFile) {
        const ext = ttdKelulusanFile.name.split(".").pop()?.toLowerCase() || "png";
        const storageRef = ref(storage, `bio_sekolah/ttd_kelulusan.${ext}`);
        await uploadBytes(storageRef, ttdKelulusanFile);
        ttdKelulusanUrl = await getDownloadURL(storageRef);
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

      if (ttdUrl) payload.kepala_sekolah_ttd = ttdUrl;
      if (kopRaporUrl) payload.kopRaporUrl = kopRaporUrl;
      if (kopKelulusanUrl) payload.kopKelulusanUrl = kopKelulusanUrl;
      if (ttdKelulusanUrl) payload.ttdKelulusanUrl = ttdKelulusanUrl;

      const firstLoad =
        !preview.nama_sekolah &&
        !preview.alamat &&
        !preview.semesterUmum &&
        !preview.tahunPelajaranUmum &&
        !preview.fase &&
        !preview.kepala_sekolah &&
        !preview.kepala_sekolah_ttd &&
        !preview.kopRaporUrl &&
        !preview.kopKelulusanUrl &&
        !preview.ttdKelulusanUrl;

      await setDoc(
        refBio,
        firstLoad ? { ...payload, createdAt: serverTimestamp() } : payload,
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
        kopKelulusanUrl: kopKelulusanUrl || p.kopKelulusanUrl || "",
        ttdKelulusanUrl: ttdKelulusanUrl || p.ttdKelulusanUrl || "",
      }));

      setForm((p) => ({
        ...p,
        kepala_sekolah_ttd: ttdUrl || p.kepala_sekolah_ttd || "",
        kopRaporUrl: kopRaporUrl || p.kopRaporUrl || "",
        kopKelulusanUrl: kopKelulusanUrl || p.kopKelulusanUrl || "",
        ttdKelulusanUrl: ttdKelulusanUrl || p.ttdKelulusanUrl || "",
      }));

      setTtdFile(null);
      clearBlobPreview(localTTDPreview, setLocalTTDPreview);

      setKopRaporFile(null);
      clearBlobPreview(localKopRaporPreview, setLocalKopRaporPreview);

      setKopKelulusanFile(null);
      clearBlobPreview(localKopKelulusanPreview, setLocalKopKelulusanPreview);

      setTtdKelulusanFile(null);
      clearBlobPreview(localTTDKelulusanPreview, setLocalTTDKelulusanPreview);

      alert("✅ Bio sekolah disimpan");
    } catch (e) {
      console.error(e);
      alert("⚠️ Gagal menyimpan bio sekolah");
    } finally {
      setSaving(false);
    }
  };

  const onDeleteTTD = async () => {
    if (!preview.kepala_sekolah_ttd && !form.kepala_sekolah_ttd && !localTTDPreview) {
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
      clearBlobPreview(localTTDPreview, setLocalTTDPreview);
      setTtdFile(null);

      alert("✅ Tanda tangan dihapus");
    } catch (e) {
      console.error(e);
      alert("⚠️ Gagal menghapus tanda tangan");
    } finally {
      setSaving(false);
    }
  };

  const onDeleteKopRapor = async () => {
    if (!preview.kopRaporUrl && !form.kopRaporUrl && !localKopRaporPreview) {
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
      clearBlobPreview(localKopRaporPreview, setLocalKopRaporPreview);
      setKopRaporFile(null);

      alert("✅ Kop Rapor dihapus");
    } catch (e) {
      console.error(e);
      alert("⚠️ Gagal menghapus Kop Rapor");
    } finally {
      setSaving(false);
    }
  };

  const onDeleteKopKelulusan = async () => {
    if (!preview.kopKelulusanUrl && !form.kopKelulusanUrl && !localKopKelulusanPreview) {
      return;
    }

    const ok = confirm("Hapus gambar Kop Kelulusan?");
    if (!ok) return;

    try {
      setSaving(true);

      await setDoc(
        refBio,
        {
          kopKelulusanUrl: "",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setPreview((p) => ({ ...p, kopKelulusanUrl: "" }));
      setForm((p) => ({ ...p, kopKelulusanUrl: "" }));
      clearBlobPreview(localKopKelulusanPreview, setLocalKopKelulusanPreview);
      setKopKelulusanFile(null);

      alert("✅ Kop Kelulusan dihapus");
    } catch (e) {
      console.error(e);
      alert("⚠️ Gagal menghapus Kop Kelulusan");
    } finally {
      setSaving(false);
    }
  };

  const onDeleteTTDKelulusan = async () => {
    if (!preview.ttdKelulusanUrl && !form.ttdKelulusanUrl && !localTTDKelulusanPreview) {
      return;
    }

    const ok = confirm("Hapus Tanda Tangan Kelulusan?");
    if (!ok) return;

    try {
      setSaving(true);

      await setDoc(
        refBio,
        {
          ttdKelulusanUrl: "",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setPreview((p) => ({ ...p, ttdKelulusanUrl: "" }));
      setForm((p) => ({ ...p, ttdKelulusanUrl: "" }));
      clearBlobPreview(localTTDKelulusanPreview, setLocalTTDKelulusanPreview);
      setTtdKelulusanFile(null);

      alert("✅ Tanda Tangan Kelulusan dihapus");
    } catch (e) {
      console.error(e);
      alert("⚠️ Gagal menghapus Tanda Tangan Kelulusan");
    } finally {
      setSaving(false);
    }
  };

  const ttdPreviewUrl = localTTDPreview || preview.kepala_sekolah_ttd || "";
  const kopRaporPreviewUrl = localKopRaporPreview || preview.kopRaporUrl || "";
  const kopKelulusanPreviewUrl =
    localKopKelulusanPreview || preview.kopKelulusanUrl || "";
  const ttdKelulusanPreviewUrl =
    localTTDKelulusanPreview || preview.ttdKelulusanUrl || "";

  const joinUmumArab = (umum, arab) => {
    if (!umum && !arab) return "—";
    if (umum && arab) return `${umum} / ${arab}`;
    return umum || arab || "—";
  };

  return (
    <div className="min-h-screen bg-slate-100 px-6 py-10 text-black">
      <div className="mx-auto max-w-5xl space-y-8">
        <SectionCard title="🏫 Bio Sekolah">
          {loading ? (
            <p className="text-center text-slate-600">⏳ Memuat...</p>
          ) : (
            <form onSubmit={onSave} className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm text-slate-700">
                  Nama Sekolah
                </label>
                <input
                  type="text"
                  name="nama_sekolah"
                  value={form.nama_sekolah}
                  onChange={onChange}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="SMAS ISLAM ASSUNNAH BAGEK NYAKA"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm text-slate-700">
                  Alamat
                </label>
                <textarea
                  name="alamat"
                  rows={3}
                  value={form.alamat}
                  onChange={onChange}
                  className="w-full resize-y rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="Jln. Raya Lab. Lombok Km.55 ..."
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-700">
                  Semester (Umum)
                </label>
                <input
                  type="text"
                  name="semesterUmum"
                  value={form.semesterUmum}
                  onChange={onChange}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-700">
                  Tahun Pelajaran (Umum)
                </label>
                <input
                  type="text"
                  name="tahunPelajaranUmum"
                  value={form.tahunPelajaranUmum}
                  onChange={onChange}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-700">
                  Semester (Arab)
                </label>
                <input
                  type="text"
                  name="semesterArab"
                  value={form.semesterArab}
                  onChange={onChange}
                  dir="rtl"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-right focus:outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="اكتب هنا الفصل بالعربية"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-700">
                  Tahun Pelajaran (Arab)
                </label>
                <input
                  type="text"
                  name="tahunPelajaranArab"
                  value={form.tahunPelajaranArab}
                  onChange={onChange}
                  dir="rtl"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-right focus:outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="اكتب هنا السنة الدراسية"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-700">Fase</label>
                <input
                  type="text"
                  name="fase"
                  value={form.fase}
                  onChange={onChange}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="Contoh: Fase F (SMA)"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-700">
                  Nama Kepala Sekolah
                </label>
                <input
                  type="text"
                  name="kepala_sekolah"
                  value={form.kepala_sekolah}
                  onChange={onChange}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="Nama Kepala Sekolah"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm text-slate-700">
                  Waktu Pembagian Raport
                </label>
                <input
                  type="text"
                  name="waktuPembagianRaport"
                  value={form.waktuPembagianRaport}
                  onChange={onChange}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="Contoh: Bagek Nyaka, 1 Oktober 2025"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Teks ini nanti akan dipanggil di bagian bawah kop saat cetak rapor.
                </p>
              </div>

              <div className="md:col-span-2 grid grid-cols-1 gap-6 xl:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="mb-3 text-sm font-bold text-slate-800">Aset Rapor</p>

                  <div className="space-y-4">
                    <div>
                      <label className="mb-1 block text-sm text-slate-700">
                        Kop Rapor (Gambar)
                      </label>
                      <div className="flex flex-col items-start gap-4 md:flex-row md:items-center">
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
                              className="h-20 w-40 rounded-md border border-slate-300 bg-white object-contain"
                            />
                            <span className="text-xs text-slate-500">
                              Pratinjau Kop Rapor
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={onDeleteKopRapor}
                          disabled={
                            saving ||
                            (!preview.kopRaporUrl &&
                              !form.kopRaporUrl &&
                              !localKopRaporPreview)
                          }
                          className="rounded-md border border-red-300 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50 md:text-sm"
                        >
                          Hapus Kop Rapor
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm text-slate-700">
                        Tanda Tangan Kepala Sekolah
                      </label>
                      <div className="flex flex-col items-start gap-4 md:flex-row md:items-center">
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
                              className="h-20 w-32 rounded-md border border-slate-300 bg-white object-contain"
                            />
                            <span className="text-xs text-slate-500">
                              Pratinjau tanda tangan
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={onDeleteTTD}
                          disabled={
                            saving ||
                            (!preview.kepala_sekolah_ttd &&
                              !form.kepala_sekolah_ttd &&
                              !localTTDPreview)
                          }
                          className="rounded-md border border-red-300 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50 md:text-sm"
                        >
                          Hapus Tanda Tangan
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="mb-3 text-sm font-bold text-slate-800">Aset Kelulusan</p>

                  <div className="space-y-4">
                    <div>
                      <label className="mb-1 block text-sm text-slate-700">
                        Kop Kelulusan (Gambar)
                      </label>
                      <div className="flex flex-col items-start gap-4 md:flex-row md:items-center">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={onKopKelulusanChange}
                          className="text-sm"
                        />
                        {kopKelulusanPreviewUrl && (
                          <div className="flex items-center gap-2">
                            <img
                              src={kopKelulusanPreviewUrl}
                              alt="Kop Kelulusan"
                              className="h-20 w-40 rounded-md border border-slate-300 bg-white object-contain"
                            />
                            <span className="text-xs text-slate-500">
                              Pratinjau Kop Kelulusan
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={onDeleteKopKelulusan}
                          disabled={
                            saving ||
                            (!preview.kopKelulusanUrl &&
                              !form.kopKelulusanUrl &&
                              !localKopKelulusanPreview)
                          }
                          className="rounded-md border border-red-300 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50 md:text-sm"
                        >
                          Hapus Kop Kelulusan
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm text-slate-700">
                        Tanda Tangan Kelulusan
                      </label>
                      <div className="flex flex-col items-start gap-4 md:flex-row md:items-center">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={onTtdKelulusanChange}
                          className="text-sm"
                        />
                        {ttdKelulusanPreviewUrl && (
                          <div className="flex items-center gap-2">
                            <img
                              src={ttdKelulusanPreviewUrl}
                              alt="Tanda Tangan Kelulusan"
                              className="h-20 w-32 rounded-md border border-slate-300 bg-white object-contain"
                            />
                            <span className="text-xs text-slate-500">
                              Pratinjau tanda tangan kelulusan
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={onDeleteTTDKelulusan}
                          disabled={
                            saving ||
                            (!preview.ttdKelulusanUrl &&
                              !form.ttdKelulusanUrl &&
                              !localTTDKelulusanPreview)
                          }
                          className="rounded-md border border-red-300 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50 md:text-sm"
                        >
                          Hapus TTD Kelulusan
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-end gap-2 md:col-span-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {saving ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          )}
        </SectionCard>

        <SectionCard title="🧾 Pratinjau">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-6 md:flex-row">
              <div className="flex-1">
                <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
                  <table className="w-full border-collapse text-sm">
                    <tbody className="text-slate-800">
                      <tr className="bg-slate-50">
                        <td className="w-48 border border-slate-200 px-4 py-2">
                          Nama Sekolah
                        </td>
                        <td className="border border-slate-200 px-4 py-2">
                          {preview.nama_sekolah || "—"}
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-slate-200 px-4 py-2">
                          Alamat
                        </td>
                        <td className="whitespace-pre-wrap break-words border border-slate-200 px-4 py-2">
                          {preview.alamat || "—"}
                        </td>
                      </tr>
                      <tr className="bg-slate-50">
                        <td className="border border-slate-200 px-4 py-2">
                          Semester
                        </td>
                        <td className="border border-slate-200 px-4 py-2">
                          {joinUmumArab(preview.semesterUmum, preview.semesterArab)}
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-slate-200 px-4 py-2">
                          Tahun Pelajaran
                        </td>
                        <td className="border border-slate-200 px-4 py-2">
                          {joinUmumArab(
                            preview.tahunPelajaranUmum,
                            preview.tahunPelajaranArab
                          )}
                        </td>
                      </tr>
                      <tr className="bg-slate-50">
                        <td className="border border-slate-200 px-4 py-2">
                          Fase
                        </td>
                        <td className="border border-slate-200 px-4 py-2">
                          {preview.fase || "—"}
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-slate-200 px-4 py-2">
                          Kepala Sekolah
                        </td>
                        <td className="border border-slate-200 px-4 py-2">
                          {preview.kepala_sekolah || "—"}
                        </td>
                      </tr>
                      <tr className="bg-slate-50">
                        <td className="border border-slate-200 px-4 py-2">
                          Waktu Pembagian Raport
                        </td>
                        <td className="border border-slate-200 px-4 py-2">
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
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="mb-4 text-sm font-bold text-slate-800">Pratinjau Aset Rapor</p>
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex h-24 w-full items-center justify-center overflow-hidden rounded-md border border-slate-300 bg-white">
                      {preview.kopRaporUrl ? (
                        <img
                          src={preview.kopRaporUrl}
                          alt="Kop Rapor"
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <span className="px-2 text-center text-[11px] text-slate-400">
                          Belum ada gambar Kop Rapor
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500">
                      Kop Rapor
                    </span>
                  </div>

                  <div className="flex flex-col items-center gap-2">
                    <div className="flex h-28 w-full items-center justify-center overflow-hidden rounded-md border border-slate-300 bg-white">
                      {preview.kepala_sekolah_ttd ? (
                        <img
                          src={preview.kepala_sekolah_ttd}
                          alt="Tanda tangan Kepala Sekolah"
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <span className="px-2 text-center text-[11px] text-slate-400">
                          Belum ada tanda tangan kepala sekolah
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500">
                      Tanda Tangan Kepala Sekolah
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="mb-4 text-sm font-bold text-slate-800">Pratinjau Aset Kelulusan</p>
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex h-24 w-full items-center justify-center overflow-hidden rounded-md border border-slate-300 bg-white">
                      {preview.kopKelulusanUrl ? (
                        <img
                          src={preview.kopKelulusanUrl}
                          alt="Kop Kelulusan"
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <span className="px-2 text-center text-[11px] text-slate-400">
                          Belum ada gambar Kop Kelulusan
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500">
                      Kop Kelulusan
                    </span>
                  </div>

                  <div className="flex flex-col items-center gap-2">
                    <div className="flex h-28 w-full items-center justify-center overflow-hidden rounded-md border border-slate-300 bg-white">
                      {preview.ttdKelulusanUrl ? (
                        <img
                          src={preview.ttdKelulusanUrl}
                          alt="Tanda Tangan Kelulusan"
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <span className="px-2 text-center text-[11px] text-slate-400">
                          Belum ada tanda tangan kelulusan
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500">
                      Tanda Tangan Kelulusan
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
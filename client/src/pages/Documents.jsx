import { useEffect, useState, useRef } from 'react';
import API from '../api';
import SignaturePad from 'signature_pad';
import { Document as PDFDocument, Page, pdfjs } from 'react-pdf';

// Set up react-pdf worker (version from installed package)
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

// ─── Constants ───────────────────────────────────────────────────────────────
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const STATUS_OPTIONS = ['draft', 'under_review', 'signed', 'archived'];
const STATUS_LABELS = { draft: 'Draft', under_review: 'Under Review', signed: 'Signed', archived: 'Archived' };

const STATUS_BADGE = {
  signed:       'bg-emerald-100 text-emerald-800 border-emerald-200',
  under_review: 'bg-amber-100 text-amber-800 border-amber-200',
  archived:     'bg-rose-100 text-rose-800 border-rose-200',
  draft:        'bg-slate-100 text-slate-800 border-slate-200',
};

export default function Documents() {
  const [docs, setDocs] = useState([]);

  // Upload form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  // Modals
  const [signingDocId, setSigningDocId]   = useState(null);
  const [sharingDocId, setSharingDocId]   = useState(null);
  const [shareEmail, setShareEmail]       = useState('');
  const [previewDoc, setPreviewDoc]       = useState(null);

  // react-pdf
  const [numPages, setNumPages]   = useState(null);
  const [pageNumber, setPageNumber] = useState(1);

  // Signature pad
  const canvasRef = useRef(null);
  const sigPadRef = useRef(null);

  // ─── Fetch ──────────────────────────────────────────────────────────────────
  const fetchDocs = async () => {
    try {
      const res = await API.get('/documents/my');
      setDocs(res.data);
    } catch (err) {
      console.error('Error fetching documents:', err);
    }
  };

  useEffect(() => { fetchDocs(); }, []);

  // Initialise SignaturePad when signing modal opens
  useEffect(() => {
    if (signingDocId && canvasRef.current) {
      sigPadRef.current = new SignaturePad(canvasRef.current, {
        backgroundColor: 'rgb(255,255,255)'
      });
    }
    return () => {
      sigPadRef.current?.off();
      sigPadRef.current = null;
    };
  }, [signingDocId]);

  // ─── Client-side file validation ────────────────────────────────────────────
  const validateFile = (f) => {
    if (!f) return '';
    if (!ALLOWED_MIME_TYPES.includes(f.type)) {
      return `File type not allowed. Accepted: PDF, DOCX, PNG, JPG.`;
    }
    if (f.size > MAX_FILE_BYTES) {
      return `File too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`;
    }
    return '';
  };

  const handleFileChange = (f) => {
    setFile(f);
    setFileError(validateFile(f));
  };

  // ─── Upload ─────────────────────────────────────────────────────────────────
  const handleUpload = async (e) => {
    e.preventDefault();
    const err = validateFile(file);
    if (err) { setFileError(err); return; }
    if (!file) return alert('Please select a file.');

    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    formData.append('file', file);
    if (tagsInput) formData.append('tags', tagsInput);

    setUploading(true);
    setUploadProgress(0);

    try {
      await API.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) setUploadProgress(Math.round((e.loaded * 100) / e.total));
        },
      });
      alert('Document uploaded successfully!');
      setTitle(''); setDescription(''); setTagsInput(''); setFile(null);
      setUploadProgress(0);
      fetchDocs();
    } catch (err) {
      alert(err.response?.data?.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  // ─── Share ──────────────────────────────────────────────────────────────────
  const handleShare = async (e) => {
    e.preventDefault();
    try {
      const { data: users } = await API.get(`/users?email=${shareEmail}`);
      if (!users?.length) return alert('No user found with that email.');
      await API.put(`/documents/${sharingDocId}/share`, { userId: users[0]._id });
      alert('Document shared!');
      setSharingDocId(null); setShareEmail('');
      fetchDocs();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to share.');
    }
  };

  // ─── Status dropdown ────────────────────────────────────────────────────────
  const handleStatusChange = async (docId, newStatus) => {
    try {
      await API.put(`/documents/${docId}/status`, { status: newStatus });
      fetchDocs();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update status.');
    }
  };

  // ─── Signature save ─────────────────────────────────────────────────────────
  const saveSignature = async (docId) => {
    if (!sigPadRef.current) return;
    if (sigPadRef.current.isEmpty()) return alert('Please provide a signature.');
    const base64Image = sigPadRef.current.toDataURL('image/png');
    try {
      await API.post(`/documents/${docId}/sign`, { signatureImage: base64Image });
      alert('Document signed!');
      setSigningDocId(null);
      fetchDocs();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save signature.');
    }
  };

  // ─── Download ───────────────────────────────────────────────────────────────
  const handleDownload = async (docId, fileName) => {
    try {
      const res = await API.get(`/documents/${docId}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.setAttribute('download', fileName || 'download');
      document.body.appendChild(a); a.click(); a.remove();
    } catch (err) {
      alert('Download failed.');
    }
  };

  const getFileUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const rawBase = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api').replace('/api', '');
    const cleanBase = rawBase.endsWith('/') ? rawBase.slice(0, -1) : rawBase;
    return `${cleanBase}${url}`;
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">

        <header className="mb-8">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Document Chamber</h1>
          <p className="mt-1 text-sm text-slate-500">Upload, preview, share, and sign deal documents.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ── Upload form ─────────────────────────────────────────────────── */}
          <div className="lg:col-span-1">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm sticky top-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Upload Document</h2>
              <form onSubmit={handleUpload} className="space-y-4">

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Title *</label>
                  <input type="text" value={title} onChange={e => setTitle(e.target.value)} required
                    placeholder="E.g. Pitch Deck Q3 2026"
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Description</label>
                  <textarea value={description} onChange={e => setDescription(e.target.value)} rows="2"
                    placeholder="Brief summary…"
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Tags (comma-separated)</label>
                  <input type="text" value={tagsInput} onChange={e => setTagsInput(e.target.value)}
                    placeholder="Pitch, Terms, Financials"
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>

                {/* Drag-and-drop / file picker */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">File *</label>
                  <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition
                      ${fileError ? 'border-rose-400 bg-rose-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'}`}>
                    <div className="flex flex-col items-center justify-center pt-4 pb-5">
                      <svg className={`w-7 h-7 mb-2 ${fileError ? 'text-rose-400' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="text-xs text-slate-500 font-semibold">
                        {file ? file.name : 'Click to select or drag & drop'}
                      </p>
                      <p className="text-[10px] text-slate-400">PDF, DOCX, PNG, JPG — Max {MAX_FILE_SIZE_MB}MB</p>
                    </div>
                    <input type="file" className="hidden"
                      accept=".pdf,.docx,.png,.jpg,.jpeg"
                      onChange={e => handleFileChange(e.target.files[0])} />
                  </label>
                  {fileError && <p className="mt-1 text-xs text-rose-600">{fileError}</p>}
                </div>

                {/* Upload progress bar */}
                {uploading && (
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                )}
                {uploading && (
                  <p className="text-xs text-slate-500 text-center">{uploadProgress}% uploaded…</p>
                )}

                <button type="submit" disabled={uploading || !!fileError}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium p-2.5 rounded-xl transition text-sm shadow-sm">
                  {uploading ? 'Uploading…' : 'Upload Document'}
                </button>
              </form>
            </div>
          </div>

          {/* ── Document list ────────────────────────────────────────────────── */}
          <div className="lg:col-span-2">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm min-h-[400px]">
              <h2 className="text-lg font-bold text-slate-900 mb-4">My Vault</h2>

              {docs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-sm">No documents yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-600 font-semibold">
                      <tr>
                        <th className="p-3 text-left">Title</th>
                        <th className="p-3 text-left">Status</th>
                        <th className="p-3 text-left">Uploaded By</th>
                        <th className="p-3 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {docs.map(doc => (
                        <tr key={doc._id} className="hover:bg-slate-50/60 transition">
                          <td className="p-3 max-w-[180px]">
                            <p className="font-semibold text-slate-900 truncate">{doc.title}</p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              {doc.fileSize ? ((doc.fileSize) / (1024 * 1024)).toFixed(2) + ' MB' : ''}
                            </p>
                            {doc.tags?.length > 0 && (
                              <div className="flex gap-1 flex-wrap mt-1">
                                {doc.tags.map((t, i) => (
                                  <span key={i} className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[9px]">{t}</span>
                                ))}
                              </div>
                            )}
                          </td>

                          {/* Status dropdown */}
                          <td className="p-3">
                            <select
                              value={doc.status}
                              onChange={e => handleStatusChange(doc._id, e.target.value)}
                              className={`px-2 py-0.5 border text-xs font-semibold rounded-full cursor-pointer focus:outline-none ${STATUS_BADGE[doc.status]}`}
                            >
                              {STATUS_OPTIONS.map(s => (
                                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                              ))}
                            </select>
                          </td>

                          <td className="p-3">
                            <p className="text-xs font-medium text-slate-900">{doc.uploadedBy?.name}</p>
                            <p className="text-[10px] text-slate-400">{doc.uploadedBy?.email}</p>
                          </td>

                          <td className="p-3">
                            <div className="flex flex-wrap gap-2">
                              <button onClick={() => { setPreviewDoc(doc); setPageNumber(1); setNumPages(null); }}
                                className="text-xs text-indigo-600 hover:text-indigo-900 font-medium">Preview</button>
                              <button onClick={() => handleDownload(doc._id, doc.fileName)}
                                className="text-xs text-slate-600 hover:text-slate-900 font-medium">Download</button>
                              <button onClick={() => setSharingDocId(doc._id)}
                                className="text-xs text-slate-600 hover:text-slate-900 font-medium">Share</button>
                              {doc.status !== 'signed' && (
                                <button onClick={() => setSigningDocId(doc._id)}
                                  className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-0.5 rounded font-medium">
                                  Sign
                                </button>
                              )}
                            </div>

                            {/* Signature preview below row */}
                            {doc.signature?.signatureImageUrl && (
                              <div className="mt-2 flex items-center gap-1.5 p-1.5 bg-slate-50 border border-slate-200 rounded w-max">
                                <img src={getFileUrl(doc.signature.signatureImageUrl)} alt="Signature" className="h-6 object-contain" />
                                <span className="text-[9px] text-slate-400 italic">Signed</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Preview Modal ──────────────────────────────────────────────────────── */}
      {previewDoc && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 mb-4">
              <h3 className="font-bold text-slate-900">{previewDoc.title}</h3>
              <button onClick={() => setPreviewDoc(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
            </div>

            <div className="flex-1 flex justify-center items-start">
              {/* PDF viewer using react-pdf */}
              {previewDoc.fileType === 'application/pdf' ? (
                <div className="flex flex-col items-center w-full">
                  <PDFDocument file={getFileUrl(previewDoc.fileUrl)}
                    onLoadSuccess={({ numPages }) => { setNumPages(numPages); setPageNumber(1); }}
                    loading={<p className="text-xs text-slate-500 p-4">Loading PDF…</p>}
                    error={<p className="text-xs text-rose-500 p-4">Failed to render PDF.</p>}
                  >
                    <Page pageNumber={pageNumber} width={480} renderTextLayer={false} renderAnnotationLayer={false} />
                  </PDFDocument>
                  {numPages > 1 && (
                    <div className="flex items-center gap-3 mt-3 text-xs font-semibold">
                      <button disabled={pageNumber <= 1} onClick={() => setPageNumber(p => p - 1)}
                        className="px-3 py-1 bg-slate-100 rounded disabled:opacity-40 hover:bg-slate-200">Prev</button>
                      <span className="text-slate-600 font-mono">{pageNumber} / {numPages}</span>
                      <button disabled={pageNumber >= numPages} onClick={() => setPageNumber(p => p + 1)}
                        className="px-3 py-1 bg-slate-100 rounded disabled:opacity-40 hover:bg-slate-200">Next</button>
                    </div>
                  )}
                </div>
              ) : previewDoc.fileType?.startsWith('image/') ? (
                /* Image preview */
                <img src={getFileUrl(previewDoc.fileUrl)} alt={previewDoc.title}
                  className="max-w-full max-h-[60vh] object-contain rounded border shadow-sm" />
              ) : (
                /* DOCX — download button only */
                <div className="text-center py-10">
                  <p className="text-4xl mb-3">📄</p>
                  <p className="text-sm font-semibold text-slate-700">No inline preview for Word documents</p>
                  <button onClick={() => { handleDownload(previewDoc._id, previewDoc.fileName); setPreviewDoc(null); }}
                    className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-4 py-2 rounded-lg font-semibold">
                    Download File
                  </button>
                </div>
              )}
            </div>

            <div className="pt-4 mt-4 border-t border-slate-200 flex justify-end">
              <button onClick={() => setPreviewDoc(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold px-4 py-2 rounded-lg">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Share Modal ────────────────────────────────────────────────────────── */}
      {sharingDocId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 mb-4">
              <h3 className="font-bold text-slate-900">Share Document</h3>
              <button onClick={() => setSharingDocId(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
            </div>
            <form onSubmit={handleShare} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">User Email</label>
                <input type="email" required value={shareEmail} onChange={e => setShareEmail(e.target.value)}
                  placeholder="partner@example.com"
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-lg">Share</button>
                <button type="button" onClick={() => { setSharingDocId(null); setShareEmail(''); }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold px-4 py-2 rounded-lg">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Signature Modal ────────────────────────────────────────────────────── */}
      {signingDocId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 mb-4">
              <h3 className="font-bold text-slate-900">Apply E-Signature</h3>
              <button onClick={() => setSigningDocId(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
            </div>
            <p className="text-xs text-slate-500 mb-3">Draw your signature below. Use the Clear button to start over.</p>

            {/* Canvas drawable with mouse / touch */}
            <div className="border border-slate-300 rounded-xl overflow-hidden bg-white">
              <canvas ref={canvasRef} width={460} height={200} className="cursor-crosshair w-full" />
            </div>

            <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-200">
              <button onClick={() => sigPadRef.current?.clear()}
                className="text-xs text-rose-600 hover:text-rose-800 font-semibold">Clear</button>
              <div className="flex gap-2">
                <button onClick={() => saveSignature(signingDocId)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition">
                  Save Signature
                </button>
                <button onClick={() => setSigningDocId(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold px-4 py-2 rounded-lg">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

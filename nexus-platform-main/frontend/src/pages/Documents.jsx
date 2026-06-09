import { useEffect, useState } from 'react';
import API from '../api';
import SignatureCanvas from 'react-signature-canvas';

export default function Documents() {
  const [docs, setDocs] = useState([]);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [signingDocId, setSigningDocId] = useState(null);
  let sigPad = null;

  useEffect(() => { API.get('/documents').then(res => setDocs(res.data)); }, []);

  const handleUpload = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('title', title);
    formData.append('file', file);
    await API.post('/documents/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    alert('Uploaded');
    window.location.reload();
  };

  const saveSignature = async (docId) => {
    const signatureData = sigPad.toDataURL();
    await API.post(`/documents/${docId}/sign`, { signatureUrl: signatureData });
    alert('Signed');
    setSigningDocId(null);
    window.location.reload();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold">Document Chamber</h1>
      <form onSubmit={handleUpload} className="border p-4 rounded mt-4">
        <input type="text" placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} className="w-full p-2 border rounded mb-2" required />
        <input type="file" onChange={e => setFile(e.target.files[0])} className="w-full mb-2" required />
        <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded">Upload</button>
      </form>
      <div className="mt-6">
        {docs.map(doc => (
          <div key={doc._id} className="border p-3 rounded mt-2">
            <p><strong>{doc.title}</strong> - {doc.status}</p>
            <a href={`http://localhost:5000${doc.fileUrl}`} target="_blank" rel="noreferrer" className="text-blue-600">Preview</a>
            {doc.status !== 'signed' && (
              <button onClick={() => setSigningDocId(doc._id)} className="ml-4 bg-green-600 text-white px-3 py-1 rounded">Sign</button>
            )}
            {doc.signature && <img src={doc.signature} alt="Signature" className="mt-2 h-12" />}
          </div>
        ))}
      </div>
      {signingDocId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-4 rounded">
            <h3>Sign below</h3>
            <SignatureCanvas ref={ref => (sigPad = ref)} canvasProps={{ width: 400, height: 200, className: 'border' }} />
            <button onClick={() => saveSignature(signingDocId)} className="mt-2 bg-green-600 text-white px-4 py-2 rounded">Save Signature</button>
            <button onClick={() => setSigningDocId(null)} className="mt-2 ml-2 bg-gray-600 text-white px-4 py-2 rounded">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

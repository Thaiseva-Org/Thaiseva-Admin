import {useEffect, useRef, useState} from "react";
import {getFunctions, httpsCallable} from "firebase/functions";
import {app} from "../firebase/firebase.config";

const preview = httpsCallable(getFunctions(app, "asia-east2"), "getIdentityDocument");

export default function PrivateIdentityDocument({path, label}) {
  const [document, setDocument] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const resource = useRef(null);
  const timer = useRef(null);
  const clear = () => {
    if (resource.current) URL.revokeObjectURL(resource.current);
    resource.current = null;
    clearTimeout(timer.current);
  };
  useEffect(() => {
    const requestState = generation;
    setDocument(null); setError(""); setBusy(false);
    return () => { requestState.current++; clear(); };
  }, [path]);
  const open = async () => {
    const request = ++generation.current;
    clear(); setDocument(null); setBusy(true); setError("");
    try {
      const {data} = await preview({path});
      if (request !== generation.current) return;
      const bytes = Uint8Array.from(atob(data.contentBase64), value => value.charCodeAt(0));
      resource.current = URL.createObjectURL(new Blob([bytes], {type: data.contentType}));
      setDocument({url: resource.current, type: data.contentType});
      timer.current = setTimeout(() => {
        clear(); setDocument(null); setError("Preview expired. Open the document again.");
      }, 300000);
    } catch {
      if (request === generation.current) setError("Unable to open this document. Check your access or ask support to review its format.");
    } finally {
      if (request === generation.current) setBusy(false);
    }
  };
  return <div className="space-y-2">
    {document && <a href={document.url} target="_blank" rel="noopener noreferrer">
      {document.type.startsWith("image/") ? <img src={document.url} alt={label} className="w-full h-52 object-contain bg-neutral-50 rounded-lg" /> : "Open PDF document"}
    </a>}
    <button type="button" className="text-primary-700 underline disabled:opacity-50" onClick={open} disabled={busy}>
      {busy ? "Opening document…" : document ? "Refresh private preview" : "Open private document"}
    </button>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </div>;
}

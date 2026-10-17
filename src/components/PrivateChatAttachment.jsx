import { useEffect, useState } from "react";
import { onAuthStateChanged, getAuth } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import PropTypes from "prop-types";

export default function PrivateChatAttachment({ path, audio = false, name = "Download attachment" }) {
  const [media, setMedia] = useState(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let disposed = false, url, timer;
    setMedia(null);setError(false);
    const unsubscribe = onAuthStateChanged(getAuth(), async user => {
      if (url) URL.revokeObjectURL(url);
      clearTimeout(timer);setMedia(null);
      if (!user || !String(path).startsWith("private-chat/")) {setError(true);return;}
      try {
        const read = httpsCallable(getFunctions(undefined, "asia-east2"), "getPrivateChatAttachment");
        const { data } = await read({ path });
        if (disposed || getAuth().currentUser?.uid !== user.uid) return;
        const bytes = Uint8Array.from(atob(data.contentBase64), character => character.charCodeAt(0));
        url = URL.createObjectURL(new Blob([bytes], { type: data.contentType }));
        setMedia({ url, type: data.contentType });
        timer = setTimeout(() => {URL.revokeObjectURL(url);setMedia(null);setError(true);}, Math.min(Number(data.expiresInSeconds) || 300, 300) * 1000);
      } catch {if (!disposed) setError(true);}
    });
    return () => {disposed = true;unsubscribe();clearTimeout(timer);if (url) URL.revokeObjectURL(url);};
  }, [path, attempt]);
  if (!media) return error ? <button type="button" className="text-sm underline" onClick={() => setAttempt(value => value + 1)}>Attachment unavailable — retry</button> : <span className="text-sm">Loading attachment…</span>;
  if (audio || media.type.startsWith("audio/")) return <audio src={media.url} controls className="max-w-xs" />;
  if (media.type.startsWith("image/")) return <img src={media.url} alt="Chat attachment" className="max-w-full rounded-xl" />;
  return <a href={media.url} download={name} className="underline">{name}</a>;
}
PrivateChatAttachment.propTypes = {path: PropTypes.string.isRequired, audio: PropTypes.bool, name: PropTypes.string};

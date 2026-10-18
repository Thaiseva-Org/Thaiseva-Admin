import {useEffect, useState} from "react";
import {customerChatApi, downloadCustomerChatFile} from "../../../../utils/customerChatApi";

export default function SupportAttachment({customerId, attachment, onError}) {
  const [url, setUrl] = useState(null);
  const [preview, setPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!preview) return;
    let alive = true;
    let objectUrl;
    setLoading(true);
    customerChatApi("download", {customerId, attachmentId: attachment.id})
      .then((result) => {
        if (!alive) return;
        const bytes = Uint8Array.from(atob(result.contentBase64), (char) => char.charCodeAt(0));
        objectUrl = URL.createObjectURL(new Blob([bytes], {type: result.contentType}));
        setUrl(objectUrl);
      })
      .catch((error) => {
        if (alive) onError(error);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // onError is a presentation callback and does not affect attachment identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview, customerId, attachment.id]);
  return (
    <div className="mt-2 rounded-lg bg-white border p-2 text-sm">
      <div className="flex gap-3 flex-wrap">
        <span>
          {attachment.name} · {Math.ceil(attachment.size / 1024)} KB
        </span>
        <button
          className="text-blue-700 underline"
          onClick={() => downloadCustomerChatFile(customerId, attachment.id).catch(onError)}
        >
          Download
        </button>
        {attachment.category === "media" && (
          <button
            className="text-blue-700 underline"
            onClick={() => {
              setPreview((value) => !value);
              setUrl(null);
            }}
          >
            {preview ? "Close preview" : "Preview"}
          </button>
        )}
      </div>
      {loading && <p role="status">Loading private preview…</p>}
      {preview && url && attachment.contentType.startsWith("image/") && (
        <img src={url} alt={attachment.name} className="mt-2 max-h-72 rounded object-contain" />
      )}
      {preview && url && attachment.contentType.startsWith("audio/") && (
        <audio src={url} controls className="mt-2 max-w-full" />
      )}
      {preview && url && attachment.contentType.startsWith("video/") && (
        <video src={url} controls className="mt-2 max-h-72 max-w-full">
          <track kind="captions" />
        </video>
      )}
    </div>
  );
}

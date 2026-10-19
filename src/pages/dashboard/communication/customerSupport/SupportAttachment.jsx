import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { customerChatApi, downloadCustomerChatFile } from "../../../../utils/customerChatApi";

const formatSize = (bytes) => {
  if (!bytes) return "0 KB";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.ceil(bytes / 1024)} KB`;
};

export default function SupportAttachment({ customerId, attachment, onError }) {
  const isImage = attachment?.contentType?.startsWith("image/");
  const isVideo = attachment?.contentType?.startsWith("video/");
  const isAudio = attachment?.contentType?.startsWith("audio/");
  const isMedia = isImage || isVideo || isAudio || attachment?.category === "media";

  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Automatically fetch private object URL for media
  useEffect(() => {
    if (!isMedia) return;
    let alive = true;
    let objectUrl;
    setLoading(true);

    customerChatApi("download", { customerId, attachmentId: attachment.id })
      .then((result) => {
        if (!alive) return;
        const bytes = Uint8Array.from(atob(result.contentBase64), (char) => char.charCodeAt(0));
        objectUrl = URL.createObjectURL(new Blob([bytes], { type: result.contentType }));
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
  }, [customerId, attachment.id, isMedia]);

  // Handle ESC key to close lightbox
  useEffect(() => {
    if (!lightboxOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setLightboxOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxOpen]);

  const handleDownload = (e) => {
    e?.stopPropagation();
    downloadCustomerChatFile(customerId, attachment.id).catch(onError);
  };

  // 1. IMAGE: Render directly in the bubble + WhatsApp style full watch popup
  if (isImage) {
    return (
      <div className="mt-2">
        {loading && !url && (
          <div className="w-56 h-44 rounded-xl bg-neutral-100 border border-neutral-200 flex flex-col items-center justify-center gap-2 text-xs text-neutral-400 animate-pulse">
            <div className="w-5 h-5 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" />
            <span>Loading image…</span>
          </div>
        )}

        {url && (
          <div className="relative group max-w-sm rounded-xl overflow-hidden border border-neutral-200/90 bg-neutral-900 shadow-2xs">
            <img
              src={url}
              alt={attachment.name}
              onClick={() => setLightboxOpen(true)}
              className="max-h-72 w-auto object-cover rounded-xl cursor-pointer hover:opacity-95 transition-all duration-200"
            />

            {/* Hover overlay with download button and click-to-expand badge */}
            <div
              onClick={() => setLightboxOpen(true)}
              className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-between p-2.5 cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-white/90 truncate max-w-[180px] drop-shadow-xs">
                  {attachment.name}
                </span>
                <button
                  type="button"
                  title="Download image"
                  onClick={handleDownload}
                  className="p-1.5 rounded-lg bg-black/50 hover:bg-black/80 text-white backdrop-blur-xs transition-colors shadow-2xs"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                  </svg>
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px] text-white/90 drop-shadow-xs">
                <span>{formatSize(attachment.size)}</span>
                <span className="inline-flex items-center gap-1 bg-white/20 backdrop-blur-xs px-2 py-0.5 rounded-md text-[10px] font-semibold">
                  🔍 Click to expand
                </span>
              </div>
            </div>
          </div>
        )}

        {/* WhatsApp-style Full Watch Lightbox Popup */}
        {lightboxOpen &&
          url &&
          createPortal(
            <div
              className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md flex flex-col animate-fade-in"
              onClick={() => setLightboxOpen(false)}
            >
              {/* Top Header Bar */}
              <div
                className="flex items-center justify-between px-5 py-4 bg-black/50 backdrop-blur-xs text-white z-10 shrink-0 border-b border-white/10"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 bg-white/10 rounded-xl text-lg">🖼️</div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate max-w-xs md:max-w-md text-white">
                      {attachment.name}
                    </p>
                    <p className="text-xs text-neutral-400">
                      {formatSize(attachment.size)} · Image
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold backdrop-blur-sm transition-all"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                    </svg>
                    <span>Download</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLightboxOpen(false)}
                    aria-label="Close full preview"
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Main Image Center */}
              <div
                className="flex-1 flex items-center justify-center p-4 md:p-8 overflow-hidden select-none"
                onClick={() => setLightboxOpen(false)}
              >
                <img
                  src={url}
                  alt={attachment.name}
                  onClick={(e) => e.stopPropagation()}
                  className="max-h-[85vh] max-w-[92vw] object-contain rounded-lg shadow-2xl transition-transform duration-200"
                />
              </div>
            </div>,
            document.body,
          )}
      </div>
    );
  }

  // 2. VIDEO: Render directly in bubble with play button + WhatsApp style full watch popup
  if (isVideo) {
    return (
      <div className="mt-2">
        {loading && !url && (
          <div className="w-56 h-40 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col items-center justify-center gap-2 text-xs text-neutral-400 animate-pulse">
            <div className="w-5 h-5 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" />
            <span>Loading video…</span>
          </div>
        )}

        {url && (
          <div className="relative group max-w-sm rounded-xl overflow-hidden border border-neutral-200/90 bg-neutral-950 shadow-2xs">
            <video
              src={url}
              preload="metadata"
              onClick={() => setLightboxOpen(true)}
              className="max-h-72 w-full object-cover rounded-xl cursor-pointer hover:opacity-95 transition-all duration-200"
            >
              <track kind="captions" />
            </video>

            {/* Centered Play Button overlay */}
            <div
              onClick={() => setLightboxOpen(true)}
              className="absolute inset-0 flex items-center justify-center cursor-pointer pointer-events-auto"
            >
              <div className="w-12 h-12 rounded-full bg-black/60 backdrop-blur-xs text-white flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:bg-primary-600 transition-all duration-200">
                <svg className="w-6 h-6 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>

            {/* Hover overlay with download button and watch badge */}
            <div
              onClick={() => setLightboxOpen(true)}
              className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-between p-2.5 cursor-pointer pointer-events-none"
            >
              <div className="flex items-center justify-between pointer-events-auto">
                <span className="text-[11px] font-medium text-white/90 truncate max-w-[180px] drop-shadow-xs">
                  {attachment.name}
                </span>
                <button
                  type="button"
                  title="Download video"
                  onClick={handleDownload}
                  className="p-1.5 rounded-lg bg-black/50 hover:bg-black/80 text-white backdrop-blur-xs transition-colors shadow-2xs"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                  </svg>
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px] text-white/90 drop-shadow-xs pointer-events-auto">
                <span>{formatSize(attachment.size)}</span>
                <span className="inline-flex items-center gap-1 bg-white/20 backdrop-blur-xs px-2 py-0.5 rounded-md text-[10px] font-semibold">
                  ▶️ Click to watch
                </span>
              </div>
            </div>
          </div>
        )}

        {/* WhatsApp-style Full Watch Lightbox Video Popup */}
        {lightboxOpen &&
          url &&
          createPortal(
            <div
              className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md flex flex-col animate-fade-in"
              onClick={() => setLightboxOpen(false)}
            >
              {/* Top Header Bar */}
              <div
                className="flex items-center justify-between px-5 py-4 bg-black/50 backdrop-blur-xs text-white z-10 shrink-0 border-b border-white/10"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 bg-white/10 rounded-xl text-lg">🎥</div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate max-w-xs md:max-w-md text-white">
                      {attachment.name}
                    </p>
                    <p className="text-xs text-neutral-400">
                      {formatSize(attachment.size)} · Video
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold backdrop-blur-sm transition-all"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                    </svg>
                    <span>Download</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLightboxOpen(false)}
                    aria-label="Close full preview"
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Main Video Center */}
              <div
                className="flex-1 flex items-center justify-center p-4 md:p-8 overflow-hidden select-none"
                onClick={() => setLightboxOpen(false)}
              >
                <video
                  src={url}
                  controls
                  autoPlay
                  onClick={(e) => e.stopPropagation()}
                  className="max-h-[85vh] max-w-[92vw] rounded-lg shadow-2xl object-contain outline-none"
                >
                  <track kind="captions" />
                </video>
              </div>
            </div>,
            document.body,
          )}
      </div>
    );
  }

  // 3. AUDIO: Render audio player directly + download
  if (isAudio) {
    return (
      <div className="mt-2 p-2.5 rounded-xl bg-white border border-neutral-200 text-xs space-y-1.5 max-w-xs">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-800 truncate">🎵 {attachment.name}</span>
          <button
            type="button"
            onClick={handleDownload}
            className="text-primary-600 hover:text-primary-800 font-semibold"
          >
            Download ↓
          </button>
        </div>
        {url && <audio src={url} controls className="w-full h-8" />}
      </div>
    );
  }

  // 4. DOCUMENT / OTHER FILE: Clean card with download button
  return (
    <div className="mt-2 rounded-xl bg-white border border-neutral-200 p-2.5 text-xs shadow-2xs flex items-center justify-between gap-3 max-w-sm hover:border-neutral-300 transition-colors">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="p-2 bg-primary-50 text-primary-700 rounded-lg text-base shrink-0">
          📄
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-slate-800 truncate max-w-[180px] md:max-w-[220px]">
            {attachment.name}
          </p>
          <span className="text-[11px] text-neutral-400">
            {formatSize(attachment.size)}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={handleDownload}
        className="inline-flex items-center gap-1 font-semibold text-xs bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-3 py-1.5 rounded-lg transition-colors shrink-0"
      >
        <span>Download</span>
        <span>↓</span>
      </button>
    </div>
  );
}

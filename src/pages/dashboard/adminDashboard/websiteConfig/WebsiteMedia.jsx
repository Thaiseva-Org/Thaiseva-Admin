/**
 * @file WebsiteMedia.jsx
 * @description Centralized administrative media asset management hub.
 *
 * Architecture & Features:
 * - Real-time synchronization with Firestore collection 'image' via {@link subscribeToMedia}
 * - Predefined visual slot catalog (hero banners, service cards, home media, team avatars, QR codes)
 * - Binary asset upload to Firebase Storage with progress tracking ({@link uploadMediaFile})
 * - Direct external CDN URL assignment ({@link setMediaUrlDirect})
 * - Instant live toggle (active vs. disabled) and one-click default asset fallback ({@link revertSlotToDefault})
 * - Dynamic custom slot creation and comprehensive preview lightbox
 *
 * @module AdminDashboard/WebsiteConfig/WebsiteMedia
 */

import { useState, useEffect, useMemo, useRef } from "react";
import {
  Button,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  IconButton,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Select,
  Skeleton,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
} from "@mui/material";
import Swal from "sweetalert2";
import ConfigHeader from "../../../../components/websiteConfig/ConfigHeader";
import {
  WEBSITE_MEDIA_SLOTS,
  MEDIA_CATEGORIES,
} from "../../../../data/websiteMediaSlots";
import {
  subscribeToMedia,
  uploadMediaFile,
  setMediaUrlDirect,
  toggleSlotStatus,
  revertSlotToDefault,
} from "../../../../services/WebsiteMediaService";
import {
  AppsIcon,
  ImageIcon,
  LayersIcon,
  HomeIcon,
  PersonIcon,
  DownloadIcon,
  SearchIcon,
  CloudUploadIcon,
  LinkIcon,
  VisibilityIcon,
  ContentCopyIcon,
  CloseIcon,
  SaveIcon,
  RestartAltIcon,
} from "@icons";

const CATEGORY_ICONS = {
  all: <AppsIcon fontSize="small" />,
  hero_banners: <ImageIcon fontSize="small" />,
  services: <LayersIcon fontSize="small" />,
  home: <HomeIcon fontSize="small" />,
  about: <PersonIcon fontSize="small" />,
  qr_codes: <DownloadIcon fontSize="small" />,
};

/**
 * WebsiteMedia Component.
 *
 * Primary administrative console for managing website imagery, banner slots,
 * marketing graphics, and custom media definitions across the public platform.
 */
const WebsiteMedia = () => {
  // Real-time state from Firestore 'image' collection
  const [mediaMap, setMediaMap] = useState({});
  const [loading, setLoading] = useState(true);

  // Filter & Search state
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // 'all', 'live', 'fallback', 'empty'

  // Modals state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [activeSlotForUpload, setActiveSlotForUpload] = useState(null);
  const [uploadTab, setUploadTab] = useState(0); // 0: file upload, 1: direct URL
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState("");
  const [directUrl, setDirectUrl] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // Lightbox preview modal
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewMediaItem, setPreviewMediaItem] = useState(null);

  // Add custom slot modal
  const [customSlotModalOpen, setCustomSlotModalOpen] = useState(false);
  const [customSlotForm, setCustomSlotForm] = useState({
    id: "",
    title: "",
    category: "hero_banners",
    page: "Custom Page",
    pageUrl: "/",
    mediaType: "image",
    defaultUrl: "",
    description: "",
  });

  // Schema guide modal
  const [guideModalOpen, setGuideModalOpen] = useState(false);

  // =========================================================
  // 1. Subscribe to Firestore Real-Time Updates
  // =========================================================
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToMedia(
      ({ mediaMap: newMap }) => {
        setMediaMap(newMap);
        setLoading(false);
      },
      (error) => {
        console.error("Firestore listener failed:", error);
        setLoading(false);
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // =========================================================
  // 2. Combine Predefined Slots with any Dynamic Firestore Docs
  // =========================================================
  const allSlots = useMemo(() => {
    const predefinedIds = new Set(WEBSITE_MEDIA_SLOTS.map((s) => s.id));
    const combined = [...WEBSITE_MEDIA_SLOTS];

    // Find any extra documents in 'image' collection that are not in default schema
    Object.keys(mediaMap).forEach((docId) => {
      if (docId !== "stats" && !predefinedIds.has(docId)) {
        const item = mediaMap[docId];
        combined.push({
          id: docId,
          title: item.title || item.name || `Custom Slot (${docId})`,
          category: item.category || "hero_banners",
          page: item.page || "Website Page",
          pageUrl: item.pageUrl || "/",
          location: item.location || "Custom Component",
          mediaType: item.mediaType || (item.url?.match(/\.(mp4|webm)$/i) ? "video" : "image"),
          defaultUrl: item.defaultUrl || "",
          description: item.description || "Custom user-defined slot in image collection.",
          aspectRatio: "16:9",
          recommendedSize: "Any standard size",
          aliases: [],
          isCustomCreated: true,
        });
      }
    });

    return combined;
  }, [mediaMap]);

  // =========================================================
  // 3. Filter and Search Logic
  // =========================================================
  const filteredSlots = useMemo(() => {
    return allSlots.filter((slot) => {
      // Category filter
      if (selectedCategory !== "all" && slot.category !== selectedCategory) {
        return false;
      }

      // Status filter
      const customRecord = mediaMap[slot.id];
      const hasCustomUrl = Boolean(customRecord?.url);
      const isCustomActive = customRecord?.status === "active" && customRecord?.isActive !== false;

      if (statusFilter === "live" && (!hasCustomUrl || !isCustomActive)) {
        return false;
      }
      if (statusFilter === "fallback" && (!hasCustomUrl || isCustomActive)) {
        return false;
      }
      if (statusFilter === "empty" && hasCustomUrl) {
        return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesId = slot.id.toLowerCase().includes(query);
        const matchesTitle = slot.title.toLowerCase().includes(query);
        const matchesPage = slot.page.toLowerCase().includes(query);
        const matchesDesc = (slot.description || "").toLowerCase().includes(query);
        const matchesAliases = (slot.aliases || []).some((a) => a.toLowerCase().includes(query));
        return matchesId || matchesTitle || matchesPage || matchesDesc || matchesAliases;
      }

      return true;
    });
  }, [allSlots, selectedCategory, statusFilter, searchTerm, mediaMap]);

  // =========================================================
  // 4. Status Toggle Handler (Real-time active/inactive)
  // =========================================================
  /**
   * Toggles the live visibility status (active vs. inactive) of a media slot in Firestore.
   *
   * @async
   * @param {string} slotId - Unique slot identifier.
   * @param {boolean} currentActive - Current active boolean state.
   * @returns {Promise<void>}
   */
  const handleToggleStatus = async (slotId, currentActive) => {
    const nextStatus = !currentActive;
    try {
      await toggleSlotStatus(slotId, nextStatus);
      const Toast = Swal.mixin({
        toast: true,
        position: "top-end",
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true,
      });
      Toast.fire({
        icon: "success",
        title: nextStatus
          ? `Slot '${slotId}' is now LIVE on website!`
          : `Slot '${slotId}' reverted to default fallback.`,
      });
    } catch (err) {
      console.error("Toggle status error:", err);
      Swal.fire("Error", "Failed to update slot status: " + err.message, "error");
    }
  };

  // =========================================================
  // 5. Revert to Default Handler
  // =========================================================
  /**
   * Reverts a media slot to its built-in fallback asset by setting status to inactive.
   *
   * @param {object} slot - Target media slot definition.
   */
  const handleRevertToDefault = (slot) => {
    Swal.fire({
      title: `Revert '${slot.title}'?`,
      text: "The website will immediately switch back to displaying the built-in fallback asset. Your uploaded asset will remain safely saved in Firestore if you wish to re-enable it later.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#f97316",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Yes, revert to default",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await revertSlotToDefault(slot.id);
          Swal.fire({
            icon: "success",
            title: "Reverted!",
            text: `Slot '${slot.id}' is now using its default asset.`,
            timer: 1500,
            showConfirmButton: false,
          });
        } catch (err) {
          Swal.fire("Error", err.message, "error");
        }
      }
    });
  };

  // =========================================================
  // 6. Modal Openers
  // =========================================================
  /**
   * Opens the media asset assignment modal configured for either binary upload or CDN URL.
   *
   * @param {object} slot - Selected media slot definition.
   * @param {number} [defaultTab=0] - Active modal tab (0: File upload, 1: Direct URL).
   */
  const openUploadModal = (slot, defaultTab = 0) => {
    setActiveSlotForUpload(slot);
    setUploadTab(defaultTab);
    setSelectedFile(null);
    setFilePreview("");
    setDirectUrl(mediaMap[slot.id]?.url || "");
    setUploadProgress(0);
    setUploadModalOpen(true);
  };

  /**
   * Opens the asset inspection modal displaying the live or fallback asset.
   *
   * @param {object} slot - Selected media slot definition.
   */
  const openPreviewModal = (slot) => {
    const record = mediaMap[slot.id];
    const currentActiveUrl =
      record?.status === "active" && record?.url
        ? record.url
        : slot.defaultUrl || record?.url;

    setPreviewMediaItem({
      slot,
      record,
      activeUrl: currentActiveUrl,
      isCustom: Boolean(record?.url && record.status === "active"),
    });
    setPreviewModalOpen(true);
  };

  // =========================================================
  // 7. File Drag & Drop + Upload Logic
  // =========================================================
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = (file) => {
    if (!activeSlotForUpload) return;

    const isVideoSlot = activeSlotForUpload.mediaType === "video";
    if (isVideoSlot) {
      if (!file.type.startsWith("video/")) {
        Swal.fire("Invalid File", "Please select a valid video file (.mp4, .webm)", "warning");
        return;
      }
    } else {
      if (!file.type.startsWith("image/")) {
        Swal.fire("Invalid File", "Please select a valid image file (.png, .jpg, .webp, .svg)", "warning");
        return;
      }
    }

    // Size limit: 20MB for images, 50MB for videos
    const maxBytes = isVideoSlot ? 50 * 1024 * 1024 : 20 * 1024 * 1024;
    if (file.size > maxBytes) {
      Swal.fire(
        "File Too Large",
        `Selected file exceeds maximum allowable size of ${isVideoSlot ? "50MB" : "20MB"}.`,
        "warning"
      );
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setFilePreview(objectUrl);
  };

  const handleSaveUpload = async () => {
    if (!activeSlotForUpload) return;
    setIsSubmitting(true);
    setUploadProgress(0);

    try {
      if (uploadTab === 0) {
        // File upload to Firebase Storage
        if (!selectedFile) {
          Swal.fire("No file", "Please select or drop a file first.", "warning");
          setIsSubmitting(false);
          return;
        }

        await uploadMediaFile(
          activeSlotForUpload.id,
          selectedFile,
          ({ percent }) => {
            setUploadProgress(percent);
          },
          "active"
        );

        Swal.fire({
          icon: "success",
          title: "Uploaded & Live!",
          text: `Slot '${activeSlotForUpload.id}' has been updated and is now live on the website.`,
          timer: 2000,
          showConfirmButton: false,
        });
      } else {
        // Direct URL input
        if (!directUrl.trim()) {
          Swal.fire("Empty URL", "Please enter a valid media URL.", "warning");
          setIsSubmitting(false);
          return;
        }

        await setMediaUrlDirect(activeSlotForUpload.id, directUrl.trim(), "active");

        Swal.fire({
          icon: "success",
          title: "URL Saved!",
          text: `Slot '${activeSlotForUpload.id}' updated with the specified URL.`,
          timer: 2000,
          showConfirmButton: false,
        });
      }

      setUploadModalOpen(false);
      setSelectedFile(null);
      setFilePreview("");
    } catch (err) {
      console.error("Save upload error:", err);
      Swal.fire("Upload Failed", err.message || "Something went wrong.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };


  // =========================================================
  // 9. Add Custom Slot Handler
  // =========================================================
  const handleCreateCustomSlot = async () => {
    const rawId = (customSlotForm.id || "").trim().toLowerCase();
    const cleanId = rawId.replace(/[^a-z0-9_-]/g, "-");

    if (!cleanId) {
      Swal.fire("Validation Error", "Please provide a valid Slot ID (e.g., promo-banner).", "warning");
      return;
    }

    try {
      const initialUrl = (customSlotForm.defaultUrl || "").trim();
      if (initialUrl) {
        await setMediaUrlDirect(cleanId, initialUrl, "active");
      }

      Swal.fire({
        icon: "success",
        title: "Slot Registered!",
        text: `Slot ID '${cleanId}' is now created in the image collection.`,
      });
      setCustomSlotModalOpen(false);
      setCustomSlotForm({
        id: "",
        title: "",
        category: "hero_banners",
        page: "Custom Page",
        pageUrl: "/",
        mediaType: "image",
        defaultUrl: "",
        description: "",
      });
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    }
  };

  // Helper to copy text to clipboard
  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    const Toast = Swal.mixin({
      toast: true,
      position: "top-end",
      showConfirmButton: false,
      timer: 1500,
    });
    Toast.fire({
      icon: "success",
      title: `Copied ${label || text}!`,
    });
  };

  const metrics = useMemo(() => {
    let liveCount = 0;
    let fallbackCount = 0;
    let unconfiguredCount = 0;

    allSlots.forEach((slot) => {
      const record = mediaMap[slot.id];
      const hasUrl = Boolean(record?.url);
      const isActive = record?.status === "active" && record?.isActive !== false;

      if (hasUrl && isActive) {
        liveCount++;
      } else if (hasUrl && !isActive) {
        fallbackCount++;
      } else {
        unconfiguredCount++;
      }
    });

    return { liveCount, fallbackCount, unconfiguredCount };
  }, [allSlots, mediaMap]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">
      {/* =====================================================
          HEADER SECTION
      ===================================================== */}
      <ConfigHeader
        title="Images & Media"
        subtitle="Upload and manage banners, page backgrounds, and media assets across the website."
        showAdd={false}
      />

      {/* =====================================================
          CATEGORY TABS
      ===================================================== */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-2 overflow-x-auto">
        <Tabs
          value={selectedCategory}
          onChange={(_, newVal) => setSelectedCategory(newVal)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            "& .MuiTabs-indicator": {
              backgroundColor: "#f97316",
              height: 3,
              borderRadius: "3px 3px 0 0",
            },
            "& .MuiTab-root": {
              textTransform: "none",
              fontWeight: 600,
              fontSize: "0.925rem",
              color: "#64748b",
              minHeight: 48,
              padding: "10px 18px",
              borderRadius: "8px",
              marginRight: "4px",
              "&.Mui-selected": {
                color: "#f97316",
                backgroundColor: "rgba(249, 115, 22, 0.06)",
              },
            },
          }}
        >
          {MEDIA_CATEGORIES.map((cat) => {
            const count =
              cat.id === "all"
                ? allSlots.length
                : cat.id === "stats"
                ? 8
                : allSlots.filter((s) => s.category === cat.id).length;

            return (
              <Tab
                key={cat.id}
                value={cat.id}
                icon={CATEGORY_ICONS[cat.id]}
                iconPosition="start"
                label={
                  <span className="flex items-center gap-2">
                    {cat.label}
                    <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full font-semibold">
                      {count}
                    </span>
                  </span>
                }
              />
            );
          })}
        </Tabs>
      </div>

      {/* =====================================================
          MEDIA SLOTS GRID
      ===================================================== */}
        <div className="space-y-6">
          {/* SEARCH & FILTER CONTROLS */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="w-full md:w-96">
              <TextField
                fullWidth
                size="small"
                placeholder="Search by title, slot ID, page..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" sx={{ color: "#94a3b8" }} />
                    </InputAdornment>
                  ),
                  endAdornment: searchTerm && (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setSearchTerm("")}>
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Status:
                </span>
                <Select
                  size="small"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  sx={{ minWidth: 160, borderRadius: "10px", fontSize: "0.875rem" }}
                >
                  <MenuItem value="all">All Media ({allSlots.length})</MenuItem>
                  <MenuItem value="live">Live Custom Assets ({metrics.liveCount})</MenuItem>
                  <MenuItem value="fallback">
                    Reverted Fallback ({metrics.fallbackCount})
                  </MenuItem>
                  <MenuItem value="empty">
                    Not Uploaded Yet ({metrics.unconfiguredCount})
                  </MenuItem>
                </Select>
              </div>

              {(searchTerm || statusFilter !== "all") && (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    setSearchTerm("");
                    setStatusFilter("all");
                  }}
                  startIcon={<RestartAltIcon fontSize="small" />}
                  sx={{ textTransform: "none", borderRadius: "8px" }}
                >
                  Reset
                </Button>
              )}
            </div>
          </div>

          {/* LOADING SKELETON */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((k) => (
                <Card key={k} className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                  <Skeleton variant="rectangular" height={200} />
                  <CardContent className="p-4 space-y-2">
                    <Skeleton variant="text" width="60%" height={24} />
                    <Skeleton variant="text" width="40%" height={18} />
                    <Skeleton variant="rectangular" height={36} />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredSlots.length === 0 ? (
            /* EMPTY STATE */
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4">
              <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-2xl mx-auto flex items-center justify-center">
                <ImageIcon fontSize="large" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">No media slots found</h3>
              <p className="text-slate-500 text-sm max-w-md mx-auto">
                No slots match your search query or filter criteria. Try clearing filters or search term.
              </p>
              <Button
                variant="outlined"
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("all");
                  setSelectedCategory("all");
                }}
                sx={{ textTransform: "none", borderRadius: "8px" }}
              >
                Clear All Filters
              </Button>
            </div>
          ) : (
            /* GRID OF MEDIA SLOTS */
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredSlots.map((slot) => {
                const customRecord = mediaMap[slot.id];
                const hasCustomUrl = Boolean(customRecord?.url);
                const isCustomActive =
                  hasCustomUrl &&
                  customRecord.status === "active" &&
                  customRecord.isActive !== false;

                // What URL is the website currently displaying?
                const currentLiveDisplayUrl = isCustomActive
                  ? customRecord.url
                  : slot.defaultUrl || customRecord?.url;

                const isVideo = slot.mediaType === "video";

                return (
                  <Card
                    key={slot.id}
                    className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between group"
                  >
                    <div>
                      {/* CARD TOP BAR */}
                      <div className="p-4 pb-3 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-200/80 text-slate-700">
                            {slot.page}
                          </span>
                          {slot.mediaType === "video" && (
                            <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-100 text-purple-700">
                              Video
                            </span>
                          )}
                        </div>

                        {/* Doc ID Badge with Copy */}
                        <Tooltip title="Click to copy exact Firestore Document ID">
                          <button
                            onClick={() => copyToClipboard(slot.id, `Doc ID '${slot.id}'`)}
                            className="flex items-center gap-1 text-[11px] font-mono font-semibold bg-white border border-slate-200 px-2 py-1 rounded-md text-slate-600 hover:text-orange-600 hover:border-orange-300 transition-colors"
                          >
                            <span>{slot.id}</span>
                            <ContentCopyIcon fontSize="small" sx={{ fontSize: 13 }} />
                          </button>
                        </Tooltip>
                      </div>

                      {/* MEDIA PREVIEW BOX */}
                      <div className="relative bg-slate-900 overflow-hidden h-48 sm:h-52 flex items-center justify-center">
                        {isVideo ? (
                          <div className="w-full h-full relative">
                            {currentLiveDisplayUrl ? (
                              <video
                                src={currentLiveDisplayUrl}
                                controls
                                preload="metadata"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                                <VisibilityIcon fontSize="large" />
                                <span className="text-xs mt-2">No video URL available</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="w-full h-full relative">
                            {currentLiveDisplayUrl ? (
                              <img
                                src={currentLiveDisplayUrl}
                                alt={slot.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.src =
                                    "https://placehold.co/600x400/1e293b/f97316?text=Image+Unavailable";
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                                <ImageIcon fontSize="large" />
                                <span className="text-xs mt-2">No asset preview</span>
                              </div>
                            )}

                            {/* Hover overlay with zoom button */}
                            <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                              <Button
                                size="small"
                                variant="contained"
                                onClick={() => openPreviewModal(slot)}
                                startIcon={<VisibilityIcon fontSize="small" />}
                                sx={{
                                  backgroundColor: "rgba(255,255,255,0.9)",
                                  color: "#0f172a",
                                  fontWeight: 600,
                                  textTransform: "none",
                                  borderRadius: "8px",
                                  "&:hover": { backgroundColor: "#ffffff" },
                                }}
                              >
                                Preview
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* LIVE STATUS WATERMARK BADGE */}
                        <div className="absolute top-3 left-3 pointer-events-none">
                          {isCustomActive ? (
                            <span className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-600/90 text-white backdrop-blur-md shadow-lg border border-emerald-400/30">
                              <span className="w-2 h-2 rounded-full bg-emerald-200 animate-pulse" />
                              Custom Asset (Live)
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-900/80 text-amber-300 backdrop-blur-md shadow-lg border border-amber-500/30">
                              <span className="w-2 h-2 rounded-full bg-amber-400" />
                              Built-in Fallback Active
                            </span>
                          )}
                        </div>

                        {/* ASPECT RATIO HINT */}
                        {slot.aspectRatio && (
                          <div className="absolute bottom-2 right-2 pointer-events-none">
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/60 text-slate-300 backdrop-blur-sm">
                              Ratio: {slot.aspectRatio}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* CARD DETAILS */}
                      <div className="p-4 space-y-2.5">
                        <div>
                          <h3 className="font-bold text-slate-800 text-base leading-snug">
                            {slot.title}
                          </h3>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                            {slot.description}
                          </p>
                        </div>

                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-[11px] text-slate-600 space-y-1">
                          <div className="flex justify-between">
                            <span className="text-slate-400 font-medium">Placement:</span>
                            <span className="font-semibold text-slate-700 truncate max-w-[200px]">
                              {slot.location}
                            </span>
                          </div>
                          {slot.recommendedSize && (
                            <div className="flex justify-between">
                              <span className="text-slate-400 font-medium">Recommended:</span>
                              <span className="font-medium text-slate-700">{slot.recommendedSize}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* CARD FOOTER & CONTROLS */}
                    <div className="p-4 pt-0 space-y-3">
                      <Divider />

                      {/* ACTIVE / INACTIVE SWITCH */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Switch
                            size="small"
                            checked={isCustomActive}
                            disabled={!hasCustomUrl}
                            onChange={() => handleToggleStatus(slot.id, isCustomActive)}
                            color="warning"
                          />
                          <span className="text-xs font-semibold text-slate-700">
                            {isCustomActive ? (
                              <span className="text-emerald-700">Custom Live</span>
                            ) : hasCustomUrl ? (
                              <span className="text-amber-700">Fallback Reverted</span>
                            ) : (
                              <span className="text-slate-400">Default (No custom)</span>
                            )}
                          </span>
                        </div>

                        {hasCustomUrl && isCustomActive && (
                          <Tooltip title="Switch website back to built-in default asset">
                            <button
                              onClick={() => handleRevertToDefault(slot)}
                              className="text-[11px] text-slate-500 hover:text-amber-600 font-medium underline"
                            >
                              Revert
                            </button>
                          </Tooltip>
                        )}
                      </div>

                      {/* ACTION BUTTONS */}
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          fullWidth
                          size="small"
                          variant="contained"
                          onClick={() => openUploadModal(slot, 0)}
                          startIcon={<CloudUploadIcon fontSize="small" />}
                          sx={{
                            backgroundColor: "#f97316",
                            textTransform: "none",
                            fontWeight: 600,
                            fontSize: "0.75rem",
                            borderRadius: "8px",
                            "&:hover": { backgroundColor: "#ea580c" },
                          }}
                        >
                          Upload File
                        </Button>

                        <Button
                          fullWidth
                          size="small"
                          variant="outlined"
                          onClick={() => openUploadModal(slot, 1)}
                          startIcon={<LinkIcon fontSize="small" />}
                          sx={{
                            color: "#475569",
                            borderColor: "#cbd5e1",
                            textTransform: "none",
                            fontWeight: 600,
                            fontSize: "0.75rem",
                            borderRadius: "8px",
                            "&:hover": {
                              borderColor: "#f97316",
                              color: "#f97316",
                              backgroundColor: "rgba(249, 115, 22, 0.04)",
                            },
                          }}
                        >
                          Direct URL
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      {/* =====================================================
          MODAL: UPLOAD / DIRECT URL MODAL
      ===================================================== */}
      <Dialog
        open={uploadModalOpen}
        onClose={() => !isSubmitting && setUploadModalOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: "16px", p: 1 },
        }}
      >
        <DialogTitle className="flex items-center justify-between pb-2">
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              Update Media: {activeSlotForUpload?.title}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Slot ID: <code>{activeSlotForUpload?.id}</code> • Target: {activeSlotForUpload?.page}
            </p>
          </div>
          <IconButton
            size="small"
            disabled={isSubmitting}
            onClick={() => setUploadModalOpen(false)}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers className="space-y-4">
          <Tabs
            value={uploadTab}
            onChange={(_, val) => setUploadTab(val)}
            sx={{
              borderBottom: 1,
              borderColor: "divider",
              mb: 2,
              "& .MuiTabs-indicator": { backgroundColor: "#f97316" },
              "& .MuiTab-root": {
                textTransform: "none",
                fontWeight: 600,
                fontSize: "0.875rem",
                "&.Mui-selected": { color: "#f97316" },
              },
            }}
          >
            <Tab icon={<CloudUploadIcon fontSize="small" />} iconPosition="start" label="File Upload (Storage)" />
            <Tab icon={<LinkIcon fontSize="small" />} iconPosition="start" label="Direct URL (CDN / Web)" />
          </Tabs>

          {/* TAB 0: FILE UPLOAD ZONE */}
          {uploadTab === 0 ? (
            <div className="space-y-4">
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 ${
                  dragActive
                    ? "border-orange-500 bg-orange-50/50 scale-[0.99]"
                    : "border-slate-300 hover:border-orange-400 bg-slate-50/50"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept={
                    activeSlotForUpload?.mediaType === "video"
                      ? "video/mp4,video/webm"
                      : "image/png,image/jpeg,image/webp,image/svg+xml"
                  }
                  onChange={handleFileInputChange}
                />

                <div className="w-14 h-14 mx-auto rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center mb-3">
                  <CloudUploadIcon fontSize="large" />
                </div>

                <p className="font-semibold text-slate-800 text-sm">
                  Click to select file or drag & drop here
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {activeSlotForUpload?.mediaType === "video"
                    ? "Supports MP4, WebM (Max 50MB)"
                    : "Supports PNG, JPG, WebP, SVG (Max 20MB)"}
                </p>
                {activeSlotForUpload?.recommendedSize && (
                  <p className="text-[11px] text-orange-600 font-medium mt-2">
                    Recommended: {activeSlotForUpload.recommendedSize}
                  </p>
                )}
              </div>

              {/* FILE PREVIEW */}
              {selectedFile && (
                <div className="bg-slate-100 rounded-xl p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 overflow-hidden">
                    {filePreview && activeSlotForUpload?.mediaType !== "video" && (
                      <img
                        src={filePreview}
                        alt="Preview"
                        className="w-12 h-12 object-cover rounded-lg border border-slate-300"
                      />
                    )}
                    <div className="overflow-hidden">
                      <p className="text-xs font-semibold text-slate-800 truncate">
                        {selectedFile.name}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>

                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                      setFilePreview("");
                    }}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </div>
              )}

              {/* PROGRESS BAR */}
              {isSubmitting && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-600 font-semibold">
                    <span>Uploading to Firebase Storage...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <LinearProgress
                    variant="determinate"
                    value={uploadProgress}
                    sx={{
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: "#f1f5f9",
                      "& .MuiLinearProgress-bar": { backgroundColor: "#f97316" },
                    }}
                  />
                </div>
              )}
            </div>
          ) : (
            /* TAB 1: DIRECT URL INPUT */
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Public Media URL
                </label>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="https://firebasestorage.googleapis.com/... or https://images.unsplash.com/..."
                  value={directUrl}
                  onChange={(e) => setDirectUrl(e.target.value)}
                  helperText="Paste any direct public image or video link (HTTPS)"
                />
              </div>

              {directUrl.trim() && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <p className="text-xs font-semibold text-slate-600 mb-2">Live URL Preview:</p>
                  <div className="h-44 bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center">
                    {activeSlotForUpload?.mediaType === "video" ? (
                      <video src={directUrl} controls className="w-full h-full object-cover" />
                    ) : (
                      <img
                        src={directUrl}
                        alt="URL Preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src =
                            "https://placehold.co/600x400/1e293b/f97316?text=Invalid+or+Inaccessible+URL";
                        }}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>

        <DialogActions className="p-4 pt-2">
          <Button
            disabled={isSubmitting}
            onClick={() => setUploadModalOpen(false)}
            sx={{ textTransform: "none", color: "#64748b" }}
          >
            Cancel
          </Button>

          <Button
            variant="contained"
            disabled={isSubmitting || (uploadTab === 0 ? !selectedFile : !directUrl.trim())}
            onClick={handleSaveUpload}
            startIcon={<SaveIcon />}
            sx={{
              backgroundColor: "#f97316",
              textTransform: "none",
              fontWeight: 600,
              borderRadius: "8px",
              padding: "8px 20px",
              "&:hover": { backgroundColor: "#ea580c" },
            }}
          >
            {isSubmitting ? "Publishing..." : "Save & Make Live"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* =====================================================
          MODAL: LIGHTBOX / FULLSCREEN PREVIEW
      ===================================================== */}
      <Dialog
        open={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: "16px", p: 1 } }}
      >
        <DialogTitle className="flex items-center justify-between pb-2">
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              {previewMediaItem?.slot.title}
            </h2>
            <p className="text-xs text-slate-500">
              Slot ID: <code>{previewMediaItem?.slot.id}</code> • Status:{" "}
              <strong>{previewMediaItem?.isCustom ? "Custom Upload (Live)" : "Default Fallback"}</strong>
            </p>
          </div>
          <IconButton size="small" onClick={() => setPreviewModalOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers className="space-y-4">
          <div className="bg-slate-950 rounded-xl overflow-hidden max-h-[500px] flex items-center justify-center p-2">
            {previewMediaItem?.slot.mediaType === "video" ? (
              <video
                src={previewMediaItem?.activeUrl}
                controls
                autoPlay
                className="max-h-[460px] w-auto mx-auto rounded"
              />
            ) : (
              <img
                src={previewMediaItem?.activeUrl}
                alt="Full preview"
                className="max-h-[460px] w-auto mx-auto object-contain rounded"
              />
            )}
          </div>

          <div className="bg-slate-50 p-4 rounded-xl space-y-2 text-xs text-slate-600">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-700">Currently Rendering URL:</span>
              <Button
                size="small"
                variant="outlined"
                onClick={() =>
                  copyToClipboard(previewMediaItem?.activeUrl, "URL")
                }
                startIcon={<ContentCopyIcon fontSize="small" />}
                sx={{ textTransform: "none", fontSize: "11px", py: 0.5 }}
              >
                Copy URL
              </Button>
            </div>
            <p className="font-mono text-slate-500 break-all bg-white p-2 rounded border border-slate-200">
              {previewMediaItem?.activeUrl}
            </p>
          </div>
        </DialogContent>

        <DialogActions className="p-4 pt-2">
          <Button onClick={() => setPreviewModalOpen(false)} sx={{ textTransform: "none" }}>
            Close
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              const s = previewMediaItem?.slot;
              setPreviewModalOpen(false);
              if (s) openUploadModal(s, 0);
            }}
            startIcon={<CloudUploadIcon />}
            sx={{
              backgroundColor: "#f97316",
              textTransform: "none",
              fontWeight: 600,
              borderRadius: "8px",
              "&:hover": { backgroundColor: "#ea580c" },
            }}
          >
            Upload New File
          </Button>
        </DialogActions>
      </Dialog>

      {/* =====================================================
          MODAL: ADD CUSTOM SLOT MODAL
      ===================================================== */}
      <Dialog
        open={customSlotModalOpen}
        onClose={() => setCustomSlotModalOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: "16px", p: 1 } }}
      >
        <DialogTitle className="flex items-center justify-between pb-2">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Add Custom Website Media Slot</h2>
            <p className="text-xs text-slate-500">
              Register a new slot in the <code>image</code> collection
            </p>
          </div>
          <IconButton size="small" onClick={() => setCustomSlotModalOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Slot ID (Firestore Document Name) *
            </label>
            <TextField
              fullWidth
              size="small"
              placeholder="e.g. holiday-promo-hero or footer-mobile-banner"
              value={customSlotForm.id}
              onChange={(e) =>
                setCustomSlotForm((p) => ({ ...p, id: e.target.value }))
              }
              helperText="Must be unique, lowercase alphanumeric with dashes/underscores."
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Display Title *</label>
            <TextField
              fullWidth
              size="small"
              placeholder="e.g. Holiday Season Promo Banner"
              value={customSlotForm.title}
              onChange={(e) =>
                setCustomSlotForm((p) => ({ ...p, title: e.target.value }))
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
              <Select
                fullWidth
                size="small"
                value={customSlotForm.category}
                onChange={(e) =>
                  setCustomSlotForm((p) => ({ ...p, category: e.target.value }))
                }
              >
                <MenuItem value="hero_banners">Hero & Banners</MenuItem>
                <MenuItem value="services">Services</MenuItem>
                <MenuItem value="home">Home Page</MenuItem>
                <MenuItem value="about">About Us</MenuItem>
                <MenuItem value="qr_codes">QR Codes</MenuItem>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Media Type</label>
              <Select
                fullWidth
                size="small"
                value={customSlotForm.mediaType}
                onChange={(e) =>
                  setCustomSlotForm((p) => ({ ...p, mediaType: e.target.value }))
                }
              >
                <MenuItem value="image">Image</MenuItem>
                <MenuItem value="video">Video (.mp4, .webm)</MenuItem>
              </Select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Media URL</label>
            <TextField
              fullWidth
              size="small"
              placeholder="https://..."
              value={customSlotForm.defaultUrl}
              onChange={(e) =>
                setCustomSlotForm((p) => ({ ...p, defaultUrl: e.target.value }))
              }
              helperText="Optional initial asset URL. You can also upload a file immediately after registering."
            />
          </div>
        </DialogContent>

        <DialogActions className="p-4 pt-2">
          <Button onClick={() => setCustomSlotModalOpen(false)} sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateCustomSlot}
            sx={{
              backgroundColor: "#f97316",
              textTransform: "none",
              fontWeight: 600,
              borderRadius: "8px",
              "&:hover": { backgroundColor: "#ea580c" },
            }}
          >
            Create Slot
          </Button>
        </DialogActions>
      </Dialog>

      {/* =====================================================
          MODAL: SCHEMA REFERENCE GUIDE
      ===================================================== */}
      <Dialog
        open={guideModalOpen}
        onClose={() => setGuideModalOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: "16px", p: 1 } }}
      >
        <DialogTitle className="flex items-center justify-between pb-2">
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              Firestore Media Schema & Slot Directory
            </h2>
            <p className="text-xs text-slate-500">
              Corresponds 1-to-1 with consumer website real-time listener architecture
            </p>
          </div>
          <IconButton size="small" onClick={() => setGuideModalOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers className="space-y-4">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-2">
            <p className="font-bold text-slate-900">How it works:</p>
            <ul className="list-disc list-inside space-y-1 text-slate-600">
              <li>
                <strong>Single Collection:</strong> All items are stored in collection named{" "}
                <code>image</code>.
              </li>
              <li>
                <strong>Document ID:</strong> Named exactly as the slot ID (e.g. <code>hero</code>,{" "}
                <code>tours-hero-bg</code>, <code>stats</code>).
              </li>
              <li>
                <strong>Instant Real-time Sync:</strong> The live website connects using Firestore{" "}
                <code>onSnapshot</code>. When you upload or toggle here, the site updates live with zero reload.
              </li>
              <li>
                <strong>Status Toggle:</strong> Toggling to <code>inactive</code> reverts to the default built-in
                asset without deleting your upload.
              </li>
            </ul>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <th className="p-2.5">Slot ID (Doc Name)</th>
                  <th className="p-2.5">Target Page</th>
                  <th className="p-2.5">Type</th>
                  <th className="p-2.5">Placement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {WEBSITE_MEDIA_SLOTS.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="p-2.5 font-bold text-orange-600">{s.id}</td>
                    <td className="p-2.5 font-sans text-slate-700">{s.page}</td>
                    <td className="p-2.5 font-sans text-slate-500 uppercase">{s.mediaType}</td>
                    <td className="p-2.5 font-sans text-slate-600">{s.location}</td>
                  </tr>
                ))}
                <tr className="bg-orange-50 font-bold">
                  <td className="p-2.5 text-orange-700">stats</td>
                  <td className="p-2.5 font-sans text-slate-800">Home & About</td>
                  <td className="p-2.5 font-sans text-slate-800">JSON Counters</td>
                  <td className="p-2.5 font-sans text-slate-800">8 Animated Statistics Counters</td>
                </tr>
              </tbody>
            </table>
          </div>
        </DialogContent>

        <DialogActions className="p-4 pt-2">
          <Button onClick={() => setGuideModalOpen(false)} sx={{ textTransform: "none" }}>
            Close Guide
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default WebsiteMedia;

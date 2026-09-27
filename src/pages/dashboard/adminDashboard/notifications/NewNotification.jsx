import { SendRounded, FileUploadRounded, ChangeCircleRounded } from "@icons";
import NotificationCard from "../../../../components/NotificationCard";
import PageHeading from "../../../../components/PageHeading";
import {
  TextField,
  Button,
  DialogContentText,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Switch,
  FormControlLabel,
  Tabs,
  Tab,
  Slider,
  Typography,
} from "@mui/material";
import React, { useState, useCallback, useEffect } from "react";
import { uploadFileUrl } from "../../../../utils/utils";
import Cropper from "react-easy-crop";
import getCroppedImg from "../../../../components/CropImageHelper";
import {
  fetchNotifications,
  addNotification,
} from "../../../../services/Notification";

const NewNotficationsScreen = () => {
  const [notifications, setNotifications] = useState([]);
  const [preview, setPreview] = useState(false);
  const [refetch, setRefetch] = useState(true);
  const [error, setError] = useState({ for: "", text: "" });
  const [loading, setLoading] = useState({ for: "", status: false });

  // Consolidated Form State
  const initialFormState = {
    title: "",
    message: "",
    useExpiry: false,
    expiryDate: ""
  };
  const [formState, setFormState] = useState(initialFormState);
  const { title, message, useExpiry, expiryDate } = formState;

  // Consolidated Image State
  const initialImageState = {
    img: null,
    crop: { x: 0, y: 0 },
    zoom: 1,
    rotation: 0,
    croppedAreaPixels: null,
    croppedImage: null
  };
  const [imageState, setImageState] = useState(initialImageState);
  const { img, crop, zoom, rotation, croppedAreaPixels, croppedImage } = imageState;

  // Shim setters for backward compatibility & easy refactoring
  const updateForm = (field, value) => {
    setFormState(prev => ({ ...prev, [field]: value }));
  };
  const updateImage = (field, value) => {
    setImageState(prev => ({ ...prev, [field]: value }));
  };

  const setTitle = (v) => updateForm('title', v);
  const setMessage = (v) => updateForm('message', v);
  const setUseExpiry = (v) => updateForm('useExpiry', v);
  const setExpiryDate = (v) => updateForm('expiryDate', v);

  const setImg = (v) => updateImage('img', v);
  const setCrop = (v) => updateImage('crop', v);
  const setZoom = (v) => updateImage('zoom', v);
  const setRotation = (v) => updateImage('rotation', v);
  const setCroppedAreaPixels = (v) => updateImage('croppedAreaPixels', v);
  const setCroppedImage = (v) => updateImage('croppedImage', v);

  // Tab State
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  // Derived filtered lists
  const liveNotifications = notifications.filter(n => {
    if (!n.expiryDate) return true; // No expiry = always live
    return new Date(n.expiryDate) > new Date();
  });

  const historyNotifications = notifications.filter(n => {
    if (!n.expiryDate) return false;
    return new Date(n.expiryDate) <= new Date();
  });

  useEffect(() => {
    fetchNotifications(setNotifications);
  }, [refetch]);

  const handleUploadImage = async (e) => {
    const file = e.target.files[0];

    // Simple validation based on extension
    if (!file) return;

    var idxDot = file.name.lastIndexOf(".") + 1;
    var extFile = file.name.substr(idxDot, file.name.length).toLowerCase();
    if (extFile == "jpg" || extFile == "jpeg" || extFile == "png") {
      setError({ for: "", text: "" });
      setLoading({ for: "image", status: true });
      const objectUrl = URL.createObjectURL(file);
      setImg(objectUrl);
      setLoading({ for: "image", status: false });
    } else {
      alert("Only jpg/jpeg and png files are allowed!");
    }
  };

  const onCropChange = (crop) => {
    setCrop(crop);
  };

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleExport = async () => {
    try {
      const croppedImgUrl = await getCroppedImg(img, croppedAreaPixels, rotation);
      const previewUrl = croppedImgUrl;
      // console.log(previewUrl);
      setCroppedImage(previewUrl);
    } catch (e) {
      console.error("Crop failed", e);
    }
  };

  const onZoomChange = (zoom) => {
    setZoom(zoom);
  };

  const onRotationChange = (rotation) => {
    setRotation(rotation);
  };

  const onClosePreview = () => {
    setPreview(false);
  };

  const showPreview = async (e) => {
    e.preventDefault();
    if (title === null || title === "") {
      setError({ for: "title", text: "Title is required" });
      return;
    }
    if (message === null || message === "") {
      setError({ for: "message", text: "Message is required" });
      return;
    }

    if (useExpiry && !expiryDate) {
      setError({ for: "expiry", text: "Expiration date is required" });
      return;
    }

    await handleExport();
    setPreview(true);
    setError({ for: "", text: "" });
  };

  const sendNotification = async (e) => {
    e.preventDefault();
    setLoading({ for: "send", status: true });

    let imageUrl = "";
    if (croppedImage) {
      const imagefile = await uploadFileUrl(croppedImage);
      imageUrl = imagefile.url;
    }

    const finalExpiry = useExpiry && expiryDate ? new Date(expiryDate).toISOString() : null;

    await addNotification(title, message, imageUrl, finalExpiry)
      .then(() => {
        setFormState(initialFormState);
        setImageState(initialImageState);
        setLoading({ for: "", status: false });
        setPreview(false);
        setRefetch((p) => !p);
      })
      .catch((err) => {
        console.log(err);
        setLoading({ for: "send", status: false });
      });
  };

  return (
    <div className="animate-fade-in pb-12">
      <Dialog
        open={preview || (loading.for === "send" && loading.status)}
        onClose={onClosePreview}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          style: {
            borderRadius: "24px",
            padding: "8px",
          },
        }}
      >
        <DialogTitle sx={{ p: 3, pb: 1 }}>
          <div className="text-2xl font-bold text-gray-800">Notification Preview</div>
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <DialogContentText component="div">
            <div className="flex flex-col items-center gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
              <p className="text-sm text-gray-500 mb-2 w-full text-left">This is how your notification will appear:</p>
              <NotificationCard
                notification={{
                  title,
                  message,
                  imageUrl: croppedImage
                    ? (typeof croppedImage === 'string' ? croppedImage : URL.createObjectURL(croppedImage))
                    : "",
                  datetime: new Date().toISOString(),
                  expiryDate: useExpiry ? expiryDate : null
                }}
                length={true}
              />
              {useExpiry && expiryDate && (
                <div className="w-full bg-orange-50 text-orange-700 text-xs px-3 py-2 rounded-lg border border-orange-100 flex items-center justify-between">
                  <span className="font-semibold">Attributes:</span>
                  <span>Auto-removes on {new Date(expiryDate).toLocaleString()}</span>
                </div>
              )}
            </div>
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0, justifyContent: 'space-between' }}>
          <Button
            onClick={onClosePreview}
            sx={{
              borderRadius: "12px",
              textTransform: "none",
              fontWeight: 600,
              color: "gray",
              padding: "8px 24px",
              "&:hover": { bgcolor: "#f3f4f6" },
            }}
          >
            Cancel
          </Button>
          {loading.for === "send" && loading.status ? (
            <div className="flex items-center gap-2 text-blue-600 font-medium px-6">
              <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
              Sending...
            </div>
          ) : (
            <Button
              onClick={sendNotification}
              variant="contained"
              sx={{
                borderRadius: "12px",
                textTransform: "none",
                fontWeight: 600,
                padding: "8px 32px",
                backgroundColor: "var(--form-button-bg-color)",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                "&:hover": {
                  backgroundColor: "var(--form-button-hover-bg-color)",
                },
              }}
            >
              Confirm & Send
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <PageHeading text="Manage Notifications" subtitle="Send and view push notifications" icon="🔔" />

      <div className="flex flex-col gap-8 lg:gap-8 mt-6">
        {/* Send Notification Card */}
        <div className="bg-white rounded-[24px] shadow-sm border border-gray-200 p-6 md:p-8">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <SendRounded />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-800">Compose Notification</h3>
              <p className="text-sm text-gray-500">Create and broadcast a new message to all users</p>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-8">
            {/* Input Section */}
            <div className="flex-1 space-y-6">
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Notification Title</label>
                <TextField
                  value={title}
                  error={error.for === "title"}
                  helperText={error.for === "title" && error.text}
                  placeholder="e.g. Special Offer Inside! 🎉"
                  fullWidth
                  autoComplete="off"
                  onChange={(e) => setTitle(e.target.value)}
                  variant="outlined"
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: "12px",
                      backgroundColor: "#f9fafb",
                      "& fieldset": { borderColor: "#e5e7eb" },
                      "&:hover fieldset": { borderColor: "#d1d5db" },
                      "&.Mui-focused fieldset": { borderColor: "#3b82f6" },
                    },
                    "& .MuiInputBase-input": { fontWeight: 600 }
                  }}
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Message Body</label>
                <TextField
                  value={message}
                  error={error.for === "message"}
                  helperText={error.for === "message" && error.text}
                  placeholder="Type your message content here..."
                  fullWidth
                  multiline
                  rows={4}
                  autoComplete="off"
                  onChange={(e) => setMessage(e.target.value)}
                  variant="outlined"
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: "12px",
                      backgroundColor: "#f9fafb",
                      "& fieldset": { borderColor: "#e5e7eb" },
                      "&:hover fieldset": { borderColor: "#d1d5db" },
                      "&.Mui-focused fieldset": { borderColor: "#3b82f6" },
                    },
                  }}
                />
              </div>

              {/* Expiration Settings */}
              <div className="bg-gray-50 p-4 rounded-xl border border-dashed border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <label className="text-sm font-semibold text-gray-800">Dynamic Removal</label>
                    <p className="text-xs text-gray-500">Automatically remove this notification after a specific time</p>
                  </div>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={useExpiry}
                        onChange={(e) => setUseExpiry(e.target.checked)}
                        color="primary"
                      />
                    }
                    label={useExpiry ? "Enabled" : "Disabled"}
                    labelPlacement="start"
                    sx={{ ml: 0 }}
                  />
                </div>

                {useExpiry && (
                  <div className="animate-fadeIn mt-3">
                    <TextField
                      type="datetime-local"
                      fullWidth
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                      error={error.for === "expiry"}
                      helperText={error.for === "expiry" ? error.text : "Select date and time for removal"}
                      variant="outlined"
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          borderRadius: "12px",
                          backgroundColor: "white",
                        },
                      }}
                      InputLabelProps={{
                        shrink: true,
                      }}
                    />
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center justify-end">
                <Button
                  onClick={showPreview}
                  variant="contained"
                  startIcon={<SendRounded />}
                  sx={{
                    borderRadius: "12px",
                    textTransform: "none",
                    fontWeight: 700,
                    fontSize: "1rem",
                    padding: "10px 32px",
                    backgroundColor: "var(--form-button-bg-color)",
                    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                    "&:hover": {
                      backgroundColor: "var(--form-button-hover-bg-color)",
                      transform: "translateY(-2px)",
                      boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
                    },
                    transition: "all 0.3s ease",
                  }}
                >
                  Preview & Send
                </Button>
              </div>
            </div>

            {/* Image Upload Section */}
            <div className="w-full lg:w-[400px]">
              <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Notification Image (Optional)</label>
              <div className="bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 p-1 w-full relative group hover:border-blue-300 transition-colors h-fit">
                {!img ? (
                  <div className="w-full h-[300px] flex flex-col items-center justify-center text-center p-6 cursor-pointer" onClick={() => document.getElementById('imageUrl').click()}>
                    <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-4 text-blue-500 group-hover:scale-110 transition-transform">
                      <FileUploadRounded sx={{ fontSize: 32 }} />
                    </div>
                    <h4 className="text-gray-900 font-semibold mb-1">Upload Image</h4>
                    <p className="text-sm text-gray-500 mb-4">Click to browse or drag file here</p>
                    <span className="text-xs text-gray-400">JPG, PNG supported</span>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    <div className="relative w-full h-[300px] rounded-t-xl overflow-hidden bg-black/5">
                      <Cropper
                        image={img}
                        crop={crop}
                        zoom={zoom}
                        rotation={rotation}
                        aspect={1}
                        cropShape="rect"
                        showGrid={true}
                        onCropChange={onCropChange}
                        onCropComplete={onCropComplete}
                        onZoomChange={onZoomChange}
                        onRotationChange={onRotationChange}
                      />
                      <div className="absolute bottom-4 left-0 right-0 flex justify-center z-10">
                        <button
                          onClick={(e) => { e.preventDefault(); document.getElementById('imageUrl').click(); }}
                          className="bg-white/90 backdrop-blur-sm text-gray-800 px-4 py-2 rounded-full text-sm font-semibold shadow-lg hover:bg-white transition flex items-center gap-2"
                        >
                          <ChangeCircleRounded fontSize="small" /> Change Image
                        </button>
                      </div>
                    </div>

                    {/* Image Editing Controls */}
                    <div className="p-4 bg-white border-t border-gray-100 rounded-b-xl border-b-2 border-dashed border-gray-200">
                      <div className="mb-4">
                        <div className="flex justify-between items-center mb-1">
                          <Typography variant="caption" className="font-semibold text-gray-600">Zoom</Typography>
                          <Typography variant="caption" className="text-gray-400">{zoom.toFixed(1)}x</Typography>
                        </div>
                        <Slider
                          value={zoom}
                          min={1}
                          max={3}
                          step={0.1}
                          aria-labelledby="Zoom"
                          onChange={(e, zoom) => setZoom(zoom)}
                          size="small"
                          sx={{ color: '#3b82f6' }}
                        />
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <Typography variant="caption" className="font-semibold text-gray-600">Rotation</Typography>
                          <Typography variant="caption" className="text-gray-400">{rotation}°</Typography>
                        </div>
                        <Slider
                          value={rotation}
                          min={0}
                          max={360}
                          step={1}
                          aria-labelledby="Rotation"
                          onChange={(e, rotation) => setRotation(rotation)}
                          size="small"
                          sx={{ color: '#ec4899' }}
                        />
                      </div>
                    </div>
                  </div>
                )}
                <input
                  hidden
                  onChange={handleUploadImage}
                  accept="image/*"
                  type="file"
                  id="imageUrl"
                />
              </div>
              {error && error.for === "image" && (
                <p className="text-sm text-red-500 mt-2 text-center">{error.text}</p>
              )}
              {loading.for === "image" && loading.status && (
                <p className="text-sm text-blue-500 mt-2 text-center animate-pulse">Processing image...</p>
              )}
            </div>
          </div>
        </div>

        {/* Notification History Section */}
        <div className="bg-white rounded-[24px] shadow-sm border border-gray-200 p-6 md:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
            <div>
              <h3 className="text-xl font-bold text-gray-800">Notification History</h3>
              <p className="text-sm text-gray-500">Manage live and past notifications</p>
            </div>

            <Tabs
              value={tabValue}
              onChange={handleTabChange}
              aria-label="notification tabs"
              sx={{
                '& .MuiTabs-indicator': { backgroundColor: '#3b82f6', height: 3, borderRadius: '3px 3px 0 0' },
                '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, fontSize: '0.95rem', minWidth: 100 },
                '& .Mui-selected': { color: '#3b82f6' }
              }}
            >
              <Tab label={`Live (${liveNotifications.length})`} />
              <Tab label={`History (${historyNotifications.length})`} />
            </Tabs>
          </div>

          <div className="min-h-[200px]">
            {tabValue === 0 && (
              <div className="flex flex-wrap gap-6 justify-center sm:justify-start animate-fade-in">
                {liveNotifications.length > 0 ? (
                  liveNotifications.map((notification) => (
                    <NotificationCard
                      key={notification.id}
                      notification={notification}
                      setNotifications={setNotifications}
                    />
                  ))
                ) : (
                  <div className="w-full py-12 flex flex-col items-center justify-center text-gray-400">
                    <div className="w-16 h-16 bg-blue-50 text-blue-400 rounded-full flex items-center justify-center mb-4">
                      <SendRounded sx={{ fontSize: 30 }} />
                    </div>
                    <p className="font-medium text-gray-600">No live notifications active</p>
                    <p className="text-sm mt-1">Notifications without an expiry or with a future expiry will appear here.</p>
                  </div>
                )}
              </div>
            )}

            {tabValue === 1 && (
              <div className="flex flex-wrap gap-6 justify-center sm:justify-start animate-fade-in">
                {historyNotifications.length > 0 ? (
                  historyNotifications.map((notification) => (
                    <NotificationCard
                      key={notification.id}
                      notification={notification}
                      setNotifications={setNotifications}
                    />
                  ))
                ) : (
                  <div className="w-full py-12 flex flex-col items-center justify-center text-gray-400">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                      <SendRounded sx={{ fontSize: 30, opacity: 0.3 }} />
                    </div>
                    <p className="font-medium">No past notifications found</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default NewNotficationsScreen;

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Slider,
  Typography,
  TextField,
} from "@mui/material";
import { doc, setDoc, updateDoc } from "firebase/firestore";
import { useRef, useState, useCallback, useEffect } from "react";
import { settingsCollection } from "../firebase/firebase.config";
import CloseIcon from "@mui/icons-material/Close";
import { v4 as uuid } from "uuid";
import {
  askingForDelete,
  askingForUpdate,
  deleteNotification,
  getFileUrl,
  UpdateNotification,
  uploadFileUrl,
} from "../utils/utils";
import ServiceBox from "./ServiceBox";
import Cropper from "react-easy-crop";
import getCroppedImg from "../components/CropImageHelper";

const CategoriesAndLogo = ({ logo, categories }) => {
  const fileInputRef = useRef(null);
  const [logoData, setLogoData] = useState(logo);
  const [categoriesData, setCategoriesData] = useState(categories);
  const [openModal, setOpenModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [error, setError] = useState({ for: "", text: "" });
  const [isUpdate, setIsUpdate] = useState(false);
  const [category, setCategory] = useState({
    title: "",
    image: "",
    id: "",
    chatScreen: "",
  });

  // Cropper States
  const [img, setImg] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [croppedImage, setCroppedImage] = useState(null);

  const handleOpenModal = () => {
    setCategory({});
    setOpenModal(true);
  };

  const handleUpdateClick = (id) => {
    const category = categoriesData.find((item) => item.id === id);
    setCategory(category);
    setIsUpdate(true);
    setOpenModal(true);
  };

  const handleCloseModal = () => {
    setOpenModal(false);
    setIsUpdate(false);
    setCategory({});
  };

  const handleAddCategory = async () => {
    if (!category.id) category.id = uuid();
    if (category.id) {
      const newArray = [...categoriesData, category];
      await setDoc(doc(settingsCollection, "Service_Categories"), {
        id: "Service_Categories",
        categories: newArray,
      }).then(() => {
        setCategory({
          title: "",
          image: "",
          id: "",
        });
        setOpenModal(false);
        setCategoriesData(newArray);
        alert("The category is added successfully.");
      });
    }
  };

  const handleUpdateCategory = async (id) => {
    const updatedArray = categoriesData.map((item) =>
      item.id === id ? { ...item, ...category } : item
    );
    await updateDoc(doc(settingsCollection, "Service_Categories"), {
      id: "Service_Categories",
      categories: updatedArray,
    }).then(() => {
      setCategory({
        title: "",
        image: "",
        id: "",
      });
      setOpenModal(false);
      setIsUpdate(false);
      setCategoriesData(updatedArray);
      alert("The category is updated successfully.");
    });
  };

  const handleDeleteCategory = async (id) => {
    const remaining = categoriesData.filter((category) => category.id !== id);

    askingForDelete().then(async (result) => {
      if (result.isConfirmed) {
        await updateDoc(doc(settingsCollection, "Service_Categories"), {
          id: "Service_Categories",
          categories: remaining,
        }).then(() => {
          deleteNotification("The category is deleted successfully.");
          setCategoriesData(remaining);
        });
      }
    });
  };

  const handleUploadImage = async (e) => {
    const { files } = e.target;
    setError({ for: "", text: "" });
    const result = await getFileUrl(files);
    if (result.error) {
      setError({ for: "image", text: result.message });
    } else {
      setCategory((p) => ({ ...p, image: result.url }));
    }
  };

  const onCropChange = (crop) => {
    setCrop(crop);
  };

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const onZoomChange = (zoom) => {
    setZoom(zoom);
  };

  const onRotationChange = (rotation) => {
    setRotation(rotation);
  };

  const handleExport = async () => {
    try {
      if (!img || !croppedAreaPixels) return null;
      const croppedImgBlob = await getCroppedImg(img, croppedAreaPixels, rotation);
      return croppedImgBlob;
    } catch (e) {
      console.error("Crop failed", e);
      return null;
    }
  };

  const handleUploadLogo = async () => {
    askingForUpdate("You are changing the logo!").then(async (result) => {
      if (result.isConfirmed) {
        setError({ for: "", text: "" });

        let finalUrl = "";

        // Use the cropped image
        const croppedBlob = await handleExport();

        if (croppedBlob) {
          const imagefile = await uploadFileUrl(croppedBlob);
          finalUrl = imagefile.url;
        } else if (selectedFile) {
          // Fallback to original file if crop fails for some reason (rare)
          const result = await getFileUrl(selectedFile.files);
          if (result.error) {
            setError({ for: "logo", text: result.message });
            return;
          }
          finalUrl = result.url;
        } else {
          setError({ for: "logo", text: "No image selected" });
          return;
        }

        if (finalUrl) {
          await setDoc(doc(settingsCollection, "logo"), {
            id: "logo",
            logo: finalUrl,
          }).then(() => {
            UpdateNotification("The Logo is Updated successfully.");
            setLogoData(finalUrl);
            setImg(null); // Reset cropper
            setZoom(1);
            setRotation(0);
            fileInputRef.current.value = "";
          });
        }
      }
    });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile({ files: [file] });
      const objectUrl = URL.createObjectURL(file);
      setImg(objectUrl);
      setZoom(1);
      setRotation(0);
    } else {
      setSelectedFile(null);
      setImg(null);
    }
  };

  return (
    <>
      <div className="mb-8 rounded-lg">
        <div className="flex lg:flex-row flex-col gap-8 lg:gap-4">
          <div className="flex-1 banner-layout">
            <div className="flex items-center gap-2">
              <h2 className="banner-section-title">Logo</h2>
            </div>
            <div className="w-full">
              <div className="relative border-2 border-dashed border-gray-300 rounded-xl p-1 hover:bg-gray-50 transition-all text-center cursor-pointer min-h-[300px] flex flex-col items-center justify-center bg-white group">
                {!img ? (
                  <div className="w-full h-[300px] flex flex-col items-center justify-center text-center p-6 cursor-pointer" onClick={() => fileInputRef.current.click()}>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileChange}
                      ref={fileInputRef}
                    />
                    {logoData ? (
                      <div className="flex flex-col items-center z-0 mb-4">
                        <img
                          src={logoData}
                          alt="Current Logo"
                          className="h-32 w-auto object-contain mb-3"
                        />
                        <p className="text-sm font-medium text-gray-500">Current Logo</p>
                      </div>
                    ) : (
                      <div className="text-gray-400 flex flex-col items-center z-0 mb-4">
                        <span className="text-4xl mb-2">🖼️</span>
                      </div>
                    )}

                    <p className="text-sm font-semibold text-blue-600 group-hover:underline">Click to upload new logo</p>
                    <p className="text-xs text-gray-400 mt-1">SVG, PNG, JPG supported</p>
                  </div>
                ) : (
                  <div className="flex flex-col w-full h-full">
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
                          onClick={(e) => { e.preventDefault(); fileInputRef.current.click(); }}
                          className="bg-white/90 backdrop-blur-sm text-gray-800 px-4 py-2 rounded-full text-sm font-semibold shadow-lg hover:bg-white transition flex items-center gap-2"
                        >
                          Change Image
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
              </div>

              {img && (
                <div className="flex justify-end gap-3 mt-4">
                  <Button
                    variant="outlined"
                    color="inherit"
                    onClick={(e) => {
                      e.preventDefault();
                      setImg(null);
                      setZoom(1);
                      setRotation(0);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="contained"
                    onClick={handleUploadLogo}
                    sx={{
                      backgroundColor: "var(--form-button-bg-color)",
                      color: "white",
                      "&:hover": { backgroundColor: "var(--form-button-hover-bg-color)" },
                    }}
                  >
                    Save Changes
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 banner-layout">
            <div className="banner-section-title">
              <h2 className="">Service Categories</h2>
              <button onClick={handleOpenModal} className="add-new-btn">
                Add New
              </button>
            </div>
            <div className=" grid md:grid-cols-3 grid-cols-2 gap-4 lg:gap-4 w-full">
              {categoriesData?.length > 0 ? (
                categoriesData?.map((category, i) => (
                  <ServiceBox
                    key={i}
                    category={category}
                    handleDeleteCategory={handleDeleteCategory}
                    handleUpdateCategory={handleUpdateClick}
                  />
                ))
              ) : (
                <span className="md:col-span-3 col-span-2 h-full xl:col-span-4 py-8 text-center light-text">
                  No category available
                </span>
              )}
            </div>
          </div>
        </div>

        {/* add category modal */}
        <Dialog
          open={openModal}
          onClose={handleCloseModal}
          aria-labelledby="responsive-dialog-title"
          maxWidth="sm"
          fullWidth
          PaperProps={{
            style: {
              borderRadius: "24px",
              padding: "8px",
            },
          }}
        >
          <DialogTitle sx={{ m: 0, p: 3, pb: 1 }} id="customized-dialog-title">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-bold text-gray-800">
                  {isUpdate ? "Edit Category" : "New Category"}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {isUpdate ? "Update existing service category details" : "Add a new service category to the platform"}
                </p>
              </div>
              <IconButton
                aria-label="close"
                onClick={handleCloseModal}
                sx={{
                  color: "gray",
                  bgcolor: "#f3f4f6",
                  "&:hover": { bgcolor: "#e5e7eb" },
                }}
              >
                <CloseIcon />
              </IconButton>
            </div>
          </DialogTitle>

          <DialogContent sx={{ p: 3 }}>
            <Grid container spacing={3}>
              {/* Category Title */}
              <Grid item xs={12}>
                <label className="text-sm font-semibold text-gray-700 mb-1 block">Category Name</label>
                <TextField
                  placeholder="e.g. Home Cleaning"
                  autoComplete="off"
                  value={category.title}
                  onChange={(e) => {
                    setCategory((p) => ({
                      ...p,
                      title: e.target.value,
                      chatScreen: e.target.value
                        .split(" ")
                        .join("_")
                        .toLowerCase(),
                    }));
                  }}
                  fullWidth
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
              </Grid>

              {/* Image Upload */}
              <Grid item xs={12}>
                <label className="text-sm font-semibold text-gray-700 mb-1 block">Category Icon</label>
                <div className="relative border-2 border-dashed border-gray-300 rounded-xl p-4 hover:bg-gray-50 transition-all text-center cursor-pointer min-h-[160px] flex flex-col items-center justify-center bg-white group">
                  <input
                    type="file"
                    accept="image/*"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    onChange={handleUploadImage}
                  />

                  {category.image ? (
                    <div className="flex flex-col items-center z-0">
                      <img
                        src={category.image}
                        alt="Category Icon"
                        className="h-20 w-20 object-contain mb-3 p-1 border rounded-lg shadow-sm bg-white"
                      />
                      <p className="text-xs text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full">Image Selected</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center z-0 text-gray-400">
                      <span className="text-3xl mb-2">📤</span>
                      <span className="text-sm font-medium text-gray-500">Click or Drag icon here</span>
                      <span className="text-xs text-gray-400 mt-1">SVG, PNG, JPG supported</span>
                    </div>
                  )}
                </div>
                {error.for === "image" && (
                  <span className="text-sm text-red-500 mt-1 block">{error.text}</span>
                )}
              </Grid>
            </Grid>
          </DialogContent>

          <DialogActions sx={{ p: 3, pt: 1 }}>
            <Button
              onClick={handleCloseModal}
              sx={{
                borderRadius: "12px",
                textTransform: "none",
                fontWeight: 600,
                color: "gray",
                mr: 1,
                padding: "8px 24px",
                "&:hover": { bgcolor: "#f3f4f6" },
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={
                isUpdate
                  ? () => handleUpdateCategory(category.id)
                  : () => handleAddCategory()
              }
              disabled={!category.image || !category.title}
              sx={{
                borderRadius: "12px",
                textTransform: "none",
                fontWeight: 600,
                padding: "8px 32px",
                backgroundColor: "var(--form-button-bg-color)",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                "&:hover": {
                  backgroundColor: "var(--form-button-hover-bg-color)",
                  boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
                },
                "&:disabled": {
                  backgroundColor: "#e5e7eb",
                  color: "#9ca3af",
                }
              }}
            >
              {isUpdate ? "Save Changes" : "Create Category"}
            </Button>
          </DialogActions>
        </Dialog>
      </div>
    </>
  );
};

export default CategoriesAndLogo;

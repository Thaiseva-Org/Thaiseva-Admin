import cropImageFile from "./cropImageFile";
import { useRef, useState } from "react";
import { Box, Typography, Button, IconButton, CircularProgress } from "@mui/material";
import { CloudUploadIcon } from "@icons";
import { DeleteIcon } from "@icons";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "../../firebase/firebase.config";
import Swal from "sweetalert2";

const DragDropImageUploader = ({
    label = "Upload Image",
    image,
    onImageChange,
    folder = "images",
    height = 200,
    cropWidth = 1200,
    cropHeight = 750,
    cropEnabled = true
}) => {
    const [dragActive, setDragActive] = useState(false);
    const [loading, setLoading] = useState(false);
    const inputRef = useRef(null);
    const busyRef = useRef(false);

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
            handleUpload(e.dataTransfer.files[0]);
        }
    };

    const handleChange = (e) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            e.target.value = "";
            handleUpload(file);
        }
    };

    const handleUpload = async (file) => {
        if (busyRef.current) return;
        busyRef.current = true;
        setLoading(true);
        try {
            if (!file.type.startsWith("image/") || file.size > 20 * 1024 * 1024) throw new Error("Choose an image smaller than 20 MB.");
            const cropped = cropEnabled ? await cropImageFile(file, { width: cropWidth, height: cropHeight, title: label }) : file;
            if (!cropped) return;
            const safeFolder = folder.replace(/[^a-zA-Z0-9_-]/g, "_");
            const storageRef = ref(storage, `site-media/${safeFolder}/${crypto.randomUUID()}`);
            const snapshot = await uploadBytesResumable(storageRef, cropped);
            const downloadURL = await getDownloadURL(snapshot.ref);
            onImageChange(downloadURL);
        } catch (error) {
            console.error("Image upload failed:", error);
            Swal.fire("Image upload failed", error.message || "Please try again.", "error");
        } finally {
            busyRef.current = false;
            setLoading(false);
        }
    };

    const handleRemove = () => {
        onImageChange("");
    };

    return (
        <Box className="w-full">
            <Typography variant="subtitle2" className="flex font-semibold text-gray-700 mb-2">
                {label}
            </Typography>

            {image ? (
                <Box
                    className="relative rounded-xl overflow-hidden border border-gray-200 group"
                    sx={{ height: height, backgroundColor: '#f9fafb' }}
                >
                    <img
                        src={image}
                        alt="Preview"
                        className="w-full h-full object-cover"
                    />
                    <Box className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button
                            variant="contained"
                            size="small"
                            disabled={loading}
                            onClick={() => inputRef.current.click()}
                            sx={{
                                bgcolor: 'white',
                                color: 'black',
                                textTransform: 'none',
                                '&:hover': { bgcolor: '#f3f4f6' }
                            }}
                        >
                            Change
                        </Button>
                        <IconButton
                            size="small"
                            disabled={loading}
                            onClick={handleRemove}
                            sx={{ bgcolor: '#fee2e2', color: '#dc2626', '&:hover': { bgcolor: '#fecaca' } }}
                        >
                            <DeleteIcon fontSize="small" />
                        </IconButton>
                    </Box>
                </Box>
            ) : (
                <Box
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => inputRef.current.click()}
                    className={`
            relative rounded-xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center p-6
            ${dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-gray-400"}
          `}
                    sx={{ height: height }}
                >
                    {loading ? (
                        <div className="flex flex-col items-center">
                            <CircularProgress size={24} className="mb-2" />
                            <Typography variant="caption" className="text-gray-500">Uploading...</Typography>
                        </div>
                    ) : (
                        <>
                            <div className={`p-3 rounded-full mb-3 ${dragActive ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                                <CloudUploadIcon fontSize="medium" />
                            </div>
                            <Typography variant="body2" className="font-medium text-gray-700">
                                Click or Drop image here
                            </Typography>
                            <Typography variant="caption" className="text-gray-500 mt-1">
                                {cropEnabled ? `JPG, PNG, WebP - crop to ${cropWidth} x ${cropHeight} px` : "Upload a complete, readable document image"}
                            </Typography>
                        </>
                    )}
                </Box>
            )}
            <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={loading}
                onChange={handleChange}
                className="hidden"
            />
        </Box>
    );
};

export default DragDropImageUploader;

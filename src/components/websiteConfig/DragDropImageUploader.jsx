import React, { useRef, useState } from "react";
import { Box, Typography, Button, IconButton, CircularProgress } from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DeleteIcon from "@mui/icons-material/Delete";
import ImageIcon from "@mui/icons-material/Image";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "../../firebase/firebase.config";
import Swal from "sweetalert2";

const DragDropImageUploader = ({
    label = "Upload Image",
    image,
    onImageChange,
    folder = "uploads",
    height = 200
}) => {
    const [dragActive, setDragActive] = useState(false);
    const [loading, setLoading] = useState(false);
    const inputRef = useRef(null);

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
            handleUpload(e.target.files[0]);
        }
    };

    const handleUpload = async (file) => {
        if (!file.type.startsWith("image/")) {
            Swal.fire("Error", "Please upload an image file", "error");
            return;
        }

        setLoading(true);
        const storageRef = ref(storage, `${folder}/${Date.now()}_${file.name}`);

        try {
            const uploadTask = uploadBytesResumable(storageRef, file);

            uploadTask.on(
                "state_changed",
                null, // Progress can be handled here if needed
                (error) => {
                    console.error("Upload failed:", error);
                    setLoading(false);
                    Swal.fire("Error", "Image upload failed", "error");
                },
                async () => {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    onImageChange(downloadURL); // Pass back the URL
                    setLoading(false);
                }
            );
        } catch (error) {
            console.error("Error uploading image:", error);
            setLoading(false);
            Swal.fire("Error", "Image upload failed", "error");
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
                                Supports JPG, PNG, WEBP
                            </Typography>
                        </>
                    )}
                </Box>
            )}
            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                onChange={handleChange}
                className="hidden"
            />
        </Box>
    );
};

export default DragDropImageUploader;

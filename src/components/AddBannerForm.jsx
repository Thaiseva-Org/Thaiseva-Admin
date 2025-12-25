import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  MenuItem,
  TextField,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

const AddBannerForm = ({
  title,
  type = "Banner",
  error,
  loading,
  openModal,
  handleCloseModal,
  isUpdate,
  banner,
  setBanner,
  handleUploadImage,
  handleAddBanner,
  handleUpdateBanner,
  category = false,
}) => {
  return (
    <Dialog
      open={openModal}
      onClose={handleCloseModal}
      maxWidth="md"
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
            <h3 className="text-2xl font-bold text-gray-800">{title}</h3>
            <p className="text-sm text-gray-500 mt-1">
              {isUpdate ? `Update ${type.toLowerCase()} details` : `Add a new ${type.toLowerCase()}`}
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
          <Grid item xs={12}>
            <label className="text-sm font-semibold text-gray-700 mb-1 block">Title</label>
            <TextField
              placeholder={`Enter ${type.toLowerCase()} title`}
              autoComplete="off"
              value={banner.title}
              onChange={(e) =>
                setBanner((p) => ({ ...p, title: e.target.value }))
              }
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

          <Grid item xs={12}>
            <label className="text-sm font-semibold text-gray-700 mb-1 block">Description</label>
            <TextField
              placeholder="Enter a brief description"
              rows={3}
              multiline
              value={banner.description}
              onChange={(e) =>
                setBanner((p) => ({ ...p, description: e.target.value }))
              }
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

          {category && (
            <Grid item xs={12}>
              <label className="text-sm font-semibold text-gray-700 mb-1 block">Category</label>
              <TextField
                select
                value={banner.category || ""}
                onChange={(e) => {
                  setBanner((p) => ({ ...p, category: e.target.value }));
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
              >
                <MenuItem value="" disabled>
                  Select a category
                </MenuItem>
                {["Food", "Travel", "Hotel", "Local Assistance"].map(
                  (option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  )
                )}
              </TextField>
              <p className="text-xs text-orange-500 mt-1">This category is for admin reference only.</p>
            </Grid>
          )}

          {type === "Offer" && (
            <Grid item xs={12}>
              <label className="text-sm font-semibold text-gray-700 mb-1 block">Offer Type</label>
              <TextField
                select
                value={banner.type || ""}
                onChange={(e) => {
                  setBanner((p) => ({ ...p, type: e.target.value }));
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
              >
                <MenuItem value="" disabled>
                  Select offer type
                </MenuItem>
                {["Food", "Travel", "Hotel"].map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          )}

          <Grid item xs={12}>
            <label className="text-sm font-semibold text-gray-700 mb-1 block">Banner Image</label>
            <div className="relative border-2 border-dashed border-gray-300 rounded-xl p-4 hover:bg-gray-50 transition-all text-center cursor-pointer min-h-[200px] flex flex-col items-center justify-center bg-white group">
              <input
                type="file"
                accept="image/*"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                onChange={handleUploadImage}
              />

              {loading.for === "image" && loading.status === true ? (
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                  <p className="text-sm text-gray-500">Uploading Image...</p>
                </div>
              ) : banner.image ? (
                <div className="flex flex-col items-center z-0 w-full">
                  <img
                    src={banner.image}
                    alt="Banner Preview"
                    className="h-40 w-full object-cover rounded-lg shadow-sm"
                  />
                  <div className="mt-2 flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1 rounded-full">
                    <span className="text-xs font-semibold">Image Uploaded Successfully</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-2 group-hover:text-blue-500 transition-colors">Click or drop to replace</p>
                </div>
              ) : (
                <div className="flex flex-col items-center z-0 text-gray-400">
                  <span className="text-4xl mb-3">🖼️</span>
                  <span className="text-sm font-medium text-gray-600">Click or Drag banner image here</span>
                  <span className="text-xs text-gray-400 mt-1">Supported: JPG, PNG, WEBP</span>
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
          onClick={isUpdate ? handleUpdateBanner : handleAddBanner}
          disabled={
            !banner.image ||
            !banner.title ||
            !banner.description ||
            (category && !banner.category) ||
            (type === "Offer" && !banner.type)
          }
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
          {isUpdate ? "Update" : "Add"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddBannerForm;

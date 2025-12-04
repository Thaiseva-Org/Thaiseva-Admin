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
      aria-labelledby="responsive-dialog-title"
    >
      <Box>
        <DialogTitle sx={{ m: 0, p: 2 }} id="customized-dialog-title">
          {title}
        </DialogTitle>
        <IconButton
          aria-label="close"
          onClick={handleCloseModal}
          sx={{
            position: "absolute",
            right: 0,
            top: 0,
            color: "gray",
          }}
        >
          <CloseIcon />
        </IconButton>

        {/* modal body */}
        <DialogContent dividers sx={{ p: { xs: 2, md: 2 } }}>
          <Grid container spacing={2} sx={{ mb: 2, mt: 0.5 }}>
            {/* banner title */}

            <Grid item xs={12} sm={12}>
              <TextField
                label={`${type} title`}
                type="text"
                autoComplete="off"
                autoCorrect="off"
                placeholder={`Enter a ${type.toLowerCase()} title`}
                value={banner.title}
                onChange={(e) =>
                  setBanner((p) => ({ ...p, title: e.target.value }))
                }
                fullWidth
                // helperText={
                //   <span style={{ color: "var(--form-helper-text-color)" }}>
                //     This title is for admin reference only.
                //   </span>
                // }
              />
            </Grid>
            <Grid item xs={12} sm={12}>
              <TextField
                label={`${type} description`}
                type="text"
                autoComplete="off"
                autoCorrect="off"
                placeholder="Enter a brief description"
                rows={2}
                multiline
                value={banner.description}
                onChange={(e) =>
                  setBanner((p) => ({ ...p, description: e.target.value }))
                }
                fullWidth
                // helperText={
                //   <span style={{ color: "var(--form-helper-text-color)" }}>
                //     This description is for admin reference only.
                //   </span>
                // }
              />
            </Grid>

            {category && (
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <TextField
                    id="outlined-select-currency"
                    select
                    value={banner.category || ""}
                    onChange={(e) => {
                      setBanner((p) => ({ ...p, category: e.target.value }));
                    }}
                    label="Select Category"
                    helperText={
                      <span style={{ color: "var(--form-helper-text-color)" }}>
                        This category is for admin reference only.
                      </span>
                    }
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
                </FormControl>
              </Grid>
            )}

            {type === "Offer" && (
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <TextField
                    id="outlined-select-currency"
                    select
                    value={banner.type || ""}
                    onChange={(e) => {
                      setBanner((p) => ({ ...p, type: e.target.value }));
                    }}
                    label="Select Type"
                  >
                    <MenuItem value="" disabled>
                      Select a offer type
                    </MenuItem>
                    {["Food", "Travel", "Hotel"].map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </TextField>
                </FormControl>
              </Grid>
            )}

            {/* {category ? <p>"Title, description and category are for admin reference not shown to user"</p> : <p></p>} */}

            <Grid item xs={12} sm={12}>
              <TextField
                label={`Select ${type.toLowerCase()} image`}
                type="file"
                placeholder=""
                onChange={handleUploadImage}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
              {error.for === "image" && (
                <span className="text-sm text-red-500">{error.text}</span>
              )}
            </Grid>
            {loading.for === "image" && loading.status === true && (
              <p className="text-sm mx-4 text-orange-400 text-center">
                Uploading Image...
              </p>
            )}
            {banner.image && (
              <Grid item xs={12} sm={12}>
                <img
                  src={banner.image}
                  alt=""
                  className="w-full h-64 rounded-lg"
                />
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            type="submit"
            autoFocus
            sx={{
              backgroundColor: "var(--form-button-bg-color)",
              color: "white",
              "&:hover": {
                backgroundColor: "var(--form-button-hover-bg-color)",
              },
            }}
            onClick={isUpdate ? handleUpdateBanner : handleAddBanner}
            disabled={
              !banner.image ||
              !banner.title ||
              !banner.description ||
              (category && !banner.category) ||
              (type === "Offer" && !banner.type)
            }
          >
            {isUpdate ? "Update" : "Add"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
};

export default AddBannerForm;

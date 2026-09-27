import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  TextField,
} from "@mui/material";
import { useForm, Controller } from "react-hook-form";
import { CloseIcon } from "@icons";
import { ClearRoundedIcon } from "@icons";
import { useRef } from "react";

const SightSeeingForm = ({ openModal, handleCloseModal }) => {
  const includesRef = useRef();

  const {
    register,
    reset,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    control,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: { includes: [], coverPhoto: "", dayWisePlan: [] },
  });
  const includes = watch("includes");
  const coverPhoto = watch("coverPhoto");

  const addInclude = () => {
    const element = includesRef.current.querySelector("input");
    if (element.value.trim()) {
      const newIncludes = [...includes, element.value.trim()];
      setValue("includes", newIncludes);
    }
    element.value = "";
  };

  const removeInclude = (index) => {
    const newIncludes = includes.filter((_, i) => i !== index);
    setValue("includes", newIncludes);
  };

  const getImageUrl = (file) => {
    return new Promise((resolve, reject) => {
      if (!file) return reject("No file selected.");
      const fileExtension = file.name.split(".").pop().toLowerCase();
      if (!["jpg", "jpeg", "png"].includes(fileExtension)) {
        return reject("Only JPG, JPEG, and PNG files are allowed.");
      }

      // Validate file size (e.g., 5MB limit)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        return reject("File size must be less than 5MB.");
      }
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject("Error reading file.", error);
    });
  };

  const handleClose = () => {
    reset();
    handleCloseModal();
  };

  const handleFormSubmit = (data) => {
    // console.log(data);
  };

  return (
    <Dialog
      open={openModal}
      onClose={handleClose}
      aria-labelledby="responsive-dialog-title"
      maxWidth="md"
      fullWidth
    >
      <Box component="form" onSubmit={handleSubmit(handleFormSubmit)}>
        <DialogTitle sx={{ m: 0, p: 2 }} id="customized-dialog-title">
          Add New Package
        </DialogTitle>
        <IconButton
          aria-label="close"
          onClick={handleClose}
          sx={{
            position: "absolute",
            right: 0,
            top: 0,
            color: "gray",
          }}
        >
          <CloseIcon />
        </IconButton>

        <DialogContent dividers sx={{ p: { xs: 2, md: 2 } }}>
          <Grid container spacing={2} sx={{ mb: 2, mt: 0.5 }}>
            {/* ===== Package title field ===== */}
            <Grid item xs={12} sm={6}>
              <TextField
                label="Title"
                type="text"
                placeholder="Enter title for package"
                autoComplete="off"
                autoCorrect="off"
                error={!!errors?.title}
                helperText={
                  <span className="text-red-500">{errors?.title?.message}</span>
                }
                fullWidth
                {...register("title", { required: "title is required" })}
              />
            </Grid>

            {/* ===== Package days field ===== */}
            <Grid item xs={6} sm={3}>
              <TextField
                label="Days"
                type="number"
                placeholder="No of days"
                autoComplete="off"
                autoCorrect="off"
                error={!!errors?.days}
                helperText={
                  errors.days ? (
                    <span className="text-red-500">
                      {errors?.days?.message}
                    </span>
                  ) : (
                    "Provide value between 1 - 100"
                  )
                }
                onInput={(e) => {
                  if (e.target.value) {
                    let value = parseInt(e.target.value, 10);
                    if (isNaN(value)) return;

                    if (value < 1) e.target.value = 1;
                    if (value > 100) e.target.value = 100;
                  }
                }}
                onKeyDown={(e) => {
                  if (
                    e.key === "+" ||
                    e.key === "e" ||
                    e.key === "-" ||
                    e.key === "."
                  ) {
                    e.preventDefault();
                  }
                }}
                onWheel={(e) => e.target.blur()}
                fullWidth
                {...register("days", {
                  required: "no of days required",
                  validate: (value) => {
                    if (
                      watch("nights") &&
                      Math.abs(value - watch("nights")) > 1
                    ) {
                      return "Days & Nights difference cannot be more than 1";
                    }
                    return true;
                  },
                })}
              />
            </Grid>

            {/* ===== Package night field ===== */}
            <Grid item xs={6} sm={3}>
              <TextField
                label="Nights"
                type="number"
                placeholder="No of nights"
                autoComplete="off"
                autoCorrect="off"
                error={!!errors?.nights}
                helperText={
                  errors.nights ? (
                    <span className="text-red-500">
                      {errors?.nights?.message}
                    </span>
                  ) : (
                    "Provide value between 1 - 100"
                  )
                }
                onInput={(e) => {
                  if (e.target.value) {
                    let value = parseInt(e.target.value, 10);
                    if (isNaN(value)) return;

                    if (value < 1) e.target.value = 1;
                    if (value > 100) e.target.value = 100;
                  }
                }}
                onKeyDown={(e) => {
                  if (
                    e.key === "+" ||
                    e.key === "e" ||
                    e.key === "-" ||
                    e.key === "."
                  ) {
                    e.preventDefault();
                  }
                }}
                onWheel={(e) => e.target.blur()}
                fullWidth
                {...register("nights", {
                  required: "no of nights required",
                  validate: (value) => {
                    if (watch("days") && Math.abs(value - watch("days")) > 1) {
                      return "Days & Nights difference cannot be more than 1";
                    }
                    return true;
                  },
                })}
              />
            </Grid>

            {/* ===== Package description field ===== */}
            <Grid item xs={12} sm={12}>
              <TextField
                label="Description"
                type="text"
                multiline
                rows={2}
                placeholder="Enter brief description for package"
                autoComplete="off"
                autoCorrect="off"
                error={!!errors?.description}
                helperText={
                  <span className="text-red-500">
                    {errors?.description?.message}
                  </span>
                }
                fullWidth
                {...register("description", {
                  required: "description is required",
                  validate: (value) => {
                    const wordCount = value.trim().split(/\s+/).length; // Splits by spaces & removes extra spaces
                    if (wordCount < 10) {
                      return "Description must be at least 10 words";
                    }
                    return true;
                  },
                })}
              />
            </Grid>

            {/* ===== Package price field ===== */}
            <Grid item xs={12} sm={6}>
              <TextField
                label="Price"
                type="number"
                placeholder="Enter price for package"
                autoComplete="off"
                autoCorrect="off"
                error={!!errors?.price}
                helperText={
                  <span className="text-red-500">{errors?.price?.message}</span>
                }
                onInput={(e) => {
                  if (e.target.value) {
                    let value = parseInt(e.target.value, 10);
                    if (value < 1) e.target.value = 1;
                  }
                }}
                onKeyDown={(e) => {
                  if (
                    e.key === "+" ||
                    e.key === "e" ||
                    e.key === "-" ||
                    e.key === "."
                  ) {
                    e.preventDefault();
                  }
                }}
                onWheel={(e) => e.target.blur()}
                fullWidth
                {...register("price", {
                  required: "price is required",
                })}
              />
            </Grid>

            {/* ===== Package discount field ===== */}
            <Grid item xs={12} sm={6}>
              <TextField
                label="Discount"
                type="number"
                placeholder="Enter discount"
                autoComplete="off"
                autoCorrect="off"
                error={!!errors?.discount}
                helperText={
                  <span className="text-red-500">
                    {errors?.discount?.message}
                  </span>
                }
                onInput={(e) => {
                  if (e.target.value) {
                    let value = parseInt(e.target.value, 10);
                    if (value < 0) e.target.value = 0;
                    if (value > 100) e.target.value = 100;
                  }
                }}
                onKeyDown={(e) => {
                  if (
                    e.key === "+" ||
                    e.key === "e" ||
                    e.key === "-" ||
                    e.key === "."
                  ) {
                    e.preventDefault();
                  }
                }}
                onWheel={(e) => e.target.blur()}
                fullWidth
                {...register("discount", {
                  required: "Enter 0 if you do not wish to apply a discount.",
                })}
              />
            </Grid>

            {/* ===== Cover image add and what's included add ===== */}
            <Grid item xs={12}>
              <div className="flex md:flex-row flex-col gap-4">
                <div className="flex-1">
                  <Controller
                    name="coverPhoto"
                    control={control}
                    rules={{ required: "Cover Image is required." }}
                    render={({ field }) => (
                      <TextField
                        label={"Select cover photo"}
                        type="file"
                        inputProps={{ accept: "image/*" }}
                        error={!!errors?.coverPhoto}
                        helperText={
                          <span className="text-red-500">
                            {errors?.coverPhoto?.message}
                          </span>
                        }
                        onChange={async (e) => {
                          const file = e.target.files[0];

                          if (file) {
                            try {
                              const imageUrl = await getImageUrl(file);
                              field.onChange(imageUrl);
                              clearErrors("coverPhoto");
                            } catch (error) {
                              setError("coverPhoto", {
                                type: "manual",
                                message: error,
                              });
                            }
                          }
                        }}
                        fullWidth
                        InputLabelProps={{ shrink: true }}
                      />
                    )}
                  />
                </div>
                <div className="flex-1 flex gap-2 items-center">
                  <TextField
                    ref={includesRef}
                    label="What's Included"
                    type="text"
                    placeholder="Add includes"
                    autoComplete="off"
                    autoCorrect="off"
                    fullWidth
                  />
                  <div onClick={addInclude} className="input-add-btn">
                    Add
                  </div>
                </div>
              </div>
            </Grid>

            {/* ===== Cover image preview and what's included preview ===== */}
            {(coverPhoto || includes?.length > 0) && (
              <Grid item xs={12}>
                <div className="flex md:flex-row flex-col">
                  <div className="flex-1">
                    {coverPhoto && (
                      <div className="w-full flex items-center justify-center">
                        <div className="w-[80%] relative">
                          <img
                            src={coverPhoto}
                            alt=""
                            className="w-full m-auto max-h-52 rounded-lg opacity-80 object-cover"
                          />
                          <div
                            className={`absolute top-1 right-1 flex justify-center items-center ${coverPhoto}`}
                          >
                            <ClearRoundedIcon
                              fontSize="medium"
                              className="image-clear-btn"
                              onClick={() => setValue("coverPhoto", "")}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 p-4 ">
                    {includes?.length > 0 ? (
                      <>
                        <h3 className="font-bold text-center">
                          Added Includes
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {includes.map((include, i) => (
                            <Chip
                              label={include}
                              key={i}
                              onDelete={() => removeInclude(i)}
                            />
                          ))}
                        </div>
                      </>
                    ) : (
                      <></>
                    )}
                  </div>
                </div>
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
          >
            Add
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
};

export default SightSeeingForm;

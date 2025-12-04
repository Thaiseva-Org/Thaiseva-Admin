import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  TextField,
} from "@mui/material";
import { doc, setDoc, updateDoc } from "firebase/firestore";
import { useRef, useState } from "react";
import { settingsCollection } from "../firebase/firebase.config";
import CloseIcon from "@mui/icons-material/Close";
import { v4 as uuid } from "uuid";
import {
  askingForDelete,
  askingForUpdate,
  deleteNotification,
  getFileUrl,
  UpdateNotification,
} from "../utils/utils";
import ServiceBox from "./ServiceBox";

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

  const handleUploadLogo = async () => {
    askingForUpdate("You are changing the logo!").then(async (result) => {
      if (result.isConfirmed) {
        const { files } = selectedFile;
        setError({ for: "", text: "" });
        const result = await getFileUrl(files);
        if (result.error) {
          setError({ for: "logo", text: result.message });
        } else {
          await setDoc(doc(settingsCollection, "logo"), {
            id: "logo",
            logo: result.url,
          }).then(() => {
            UpdateNotification("The Logo is Updated successfully.");
            setLogoData(result.url);
            fileInputRef.current.value = "";
            // setRefetch((p) => !p);
          });
        }
      }
    });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile({ files: [file] });
    } else {
      setSelectedFile(null);
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
            <div className="flex gap-8 max-sm:gap-4 w-full">
              <img
                src={logoData}
                loading="lazy"
                alt=""
                className="w-[30%] aspect-square object-cover rounded-md"
              />
              <div className="w-[70%] m-auto flex flex-col items-end gap-6">
                {/* Label for "Select logo" */}
                <TextField
                  label="Select logo"
                  type="file"
                  onChange={handleFileChange}
                  inputRef={fileInputRef}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                  sx={{
                    display: "block",
                  }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      fileInputRef.current.value = "";
                    }}
                    className="add-new-btn"
                    disabled={!selectedFile}
                  >
                    Remove File
                  </button>
                  <button
                    onClick={handleUploadLogo}
                    className="add-new-btn"
                    disabled={!selectedFile}
                  >
                    Change Logo
                  </button>
                </div>
              </div>
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
        >
          <Box>
            <DialogTitle sx={{ m: 0, p: 2 }} id="customized-dialog-title">
              Local Service Category
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
                {/* category title */}

                <Grid item xs={12} sm={12}>
                  <TextField
                    label="Category title"
                    type="text"
                    id="logo_input"
                    placeholder="Provide a category title"
                    autoComplete="off"
                    autoCorrect="off"
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
                  />
                </Grid>

                <Grid item xs={12} sm={12}>
                  <TextField
                    label="Select an icon or logo"
                    type="file"
                    onChange={handleUploadImage}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                  />
                  {error.for === "image" && (
                    <span className="text-sm text-red-500">{error.text}</span>
                  )}
                </Grid>
                {category.image && (
                  <Grid item xs={12} sm={12}>
                    <img
                      loading="lazy"
                      src={category.image}
                      alt=""
                      className="w-20 h-20 rounded-lg"
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
                onClick={
                  isUpdate
                    ? () => handleUpdateCategory(category.id)
                    : () => handleAddCategory()
                }
                disabled={!category.image}
              >
                {isUpdate ? "Update" : "Add"}
              </Button>
            </DialogActions>
          </Box>
        </Dialog>
      </div>
    </>
  );
};

export default CategoriesAndLogo;

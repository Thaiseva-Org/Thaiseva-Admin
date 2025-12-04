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
import CloseIcon from "@mui/icons-material/Close";

import {
  GoogleMap,
  MarkerF,
  StandaloneSearchBox,
} from "@react-google-maps/api";
import "react-toastify/dist/ReactToastify.css";
// import { MdLocationOn } from "react-icons/md";
import { useState } from "react";
import axios from "axios";
import { useRef } from "react";

const center = { lat: 48.8584, lng: 2.2945 };

const AddShopForm = ({
  type = "Shop",
  error,
  loading,
  openModal,
  handleCloseModal,
  isUpdate,
  shop,
  setShop,
  handleUploadImage,
  handleAddBanner,
  handleUpdateBanner,
}) => {
  const [map, setMap] = useState(null);
  const [location, setLocation] = useState(null);
  const [searchBox, setSearchBox] = useState(null);
  const inputRef = useRef(null);
  const [isFocused, setIsFocused] = useState(false);

  /* ========================================================
              Google maps functionalities Started
 ======================================================== */
  const reverseGeocode = async (lat, lon) => {
    try {
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${
          import.meta.env.VITE_Google_Api_Key
        }`
      );
      if (response.data.status === "OK") {
        return response.data.results[0].formatted_address;
      } else {
        return "Unable to get location";
      }
    } catch (error) {
      console.error("Error fetching address: ", error);
      return "Error fetching address";
    }
  };

  const onMapLoad = (map) => {
    setMap(map);
  };

  const onMapClick = async (e) => {
    const address = await reverseGeocode(e.latLng.lat(), e.latLng.lng());
    setShop((p) => ({
      ...p,
      address,
      latitude: e.latLng.lat(),
      longitude: e.latLng.lng(),
    }));

    // setValue("address", address);
    setLocation({
      lat: e.latLng.lat(),
      lng: e.latLng.lng(),
    });
  };

  const onSearchLoad = (searchBox) => {
    setSearchBox(searchBox);
  };

  const onPlacesChanged = async () => {
    const places = searchBox?.getPlaces();

    if (places?.length === 0) return;

    const location = places[0].geometry.location;
    const address = await reverseGeocode(location.lat(), location.lng());
    setLocation({
      lat: location.lat(),
      lng: location.lng(),
    });
    setShop((p) => ({
      ...p,
      address: address,
      latitude: location.lat(),
      longitude: location.lng(),
    }));
    // setValue("address", address);
    map.setCenter(location);
  };

  return (
    <Dialog
      open={openModal}
      onClose={handleCloseModal}
      aria-labelledby="responsive-dialog-title"
      maxWidth="lg"
    >
      <Box>
        <DialogTitle sx={{ m: 0, p: 2 }} id="customized-dialog-title">
          {isUpdate ? "Update" : "Add"} {type}
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
            <Grid item xs={12} sm={12}>
              <TextField
                label={`${type} Name`}
                type="text"
                placeholder={`Provide a ${type.toLowerCase()} name`}
                value={shop.name}
                onChange={(e) =>
                  setShop((p) => ({ ...p, name: e.target.value }))
                }
                autoComplete="off"
                autoCorrect="off"
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={12}>
              <TextField
                label={`${type} Description`}
                type="text"
                multiline
                rows={3}
                placeholder="Provide a brief description"
                value={shop.description}
                autoComplete="off"
                autoCorrect="off"
                onChange={(e) =>
                  setShop((p) => ({ ...p, description: e.target.value }))
                }
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={12}>
              <TextField
                label="Set Location"
                type="text"
                placeholder="Provide a location"
                value={shop.address}
                autoComplete="off"
                autoCorrect="off"
                ref={(e) => {
                  inputRef.current = e;
                }}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                InputLabelProps={{
                  shrink: Boolean(shop.address) || isFocused,
                }}
                onChange={(e) =>
                  setShop((p) => ({ ...p, address: e.target.value }))
                }
                fullWidth
              />
            </Grid>

            <div className="w-[80%] my-2 relative m-auto">
              <GoogleMap
                id="map"
                center={center}
                zoom={15}
                onLoad={onMapLoad}
                onClick={onMapClick}
                mapContainerStyle={{ width: "100%", aspectRatio: "16/9" }}
              >
                <div className="absolute top-2 left-1/3 z-10 ">
                  <StandaloneSearchBox
                    onLoad={onSearchLoad}
                    onPlacesChanged={onPlacesChanged}
                  >
                    <input
                      type="text"
                      placeholder="Search for a location"
                      className="location-input border border-blue-500"
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault(); // Prevent form submission
                          onPlacesChanged(); // Trigger the search logic
                        }
                      }}
                    />
                  </StandaloneSearchBox>
                </div>
                {location && <MarkerF position={location} />}
              </GoogleMap>
            </div>
            {error?.for === "location" && (
              <span className="text-red-500">{error?.text}</span>
            )}

            <Grid item xs={12} sm={12}>
              <TextField
                label={`Select ${type} Image`}
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
            {shop.imageUrl && (
              <Grid item xs={12} sm={12}>
                <img
                  src={shop.imageUrl}
                  alt=""
                  className="w-[70%] aspect-auto rounded-lg m-auto"
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
              !shop.imageUrl || !shop.name || !shop.description || !shop.address
            }
          >
            {isUpdate ? "Update" : "Add"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
};

export default AddShopForm;

import { Autocomplete } from "@react-google-maps/api";
import { useEffect, useRef, useState } from "react";
import PageHeading from "../components/PageHeading";
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { setDoc, doc } from "firebase/firestore";
import { Loader } from "@googlemaps/js-api-loader";
import { db } from "../firebase/firebase.config";
import { Star } from "@mui/icons-material";

const containerStyle = {
  width: "100%",
  height: "400px",
  marginTop: "10px",
};

const initLatLng = {
  lat: -3.745,
  lng: -38.523,
};

const ShoppingMallAdd = () => {
  const [loading, setLoading] = useState(false);
  const [selectedMall, setSelectedMall] = useState(null);
  const [mapEl, setMapEl] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const inputRef = useRef(null);

  const addPlace = async () => {
    if (!selectedMall) return;
    setLoading(true);

    const photos = selectedMall.photos?.map((photo) => photo.getUrl());
    const mallData = {
      id: selectedMall.place_id,
      name: selectedMall.name,
      address: selectedMall.formatted_address,
      lat: selectedMall.geometry?.location.lat(),
      lng: selectedMall.geometry?.location.lng(),
      ratings: selectedMall.rating,
      userRatingsTotal: selectedMall.user_ratings_total,
      url: selectedMall.url,
      photos,
    };

    try {
      await setDoc(doc(db, `shops/${selectedMall.place_id}`), mallData);
      alert("Successfully added Shop", "success");
    } catch (error) {
      console.error("Error adding shop: ", error);
    } finally {
      setLoading(false);
      setShowDialog(false);
    }
  };

  useEffect(() => {
    if (!mapEl) {
      const loader = new Loader({
        apiKey: "AIzaSyDwTBiBiGtJLrlbaiKzVN5BBCj8He1l5Zc",
        version: "weekly",
      });

      loader.load().then(() => {
        const map = new google.maps.Map(document.getElementById("map"), {
          center: initLatLng,
          zoom: 8,
        });
        setMapEl(map);
      });
      return;
    }

    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      types: ["establishment"],
    });

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      const coordinates = place.geometry?.location;

      if (coordinates) {
        new google.maps.Marker({
          position: coordinates,
          map: mapEl,
        });
        mapEl.setCenter(coordinates);
      }

      setSelectedMall(place);
    });
  }, [mapEl]);

  return (
    <div>
      <Dialog open={showDialog} onClose={() => setShowDialog(false)}>
        <DialogTitle>Add this location?</DialogTitle>
        <DialogContent>
          <div
            style={{
              display: "flex",
              overflowX: "auto",
              height: "210px",
              marginBottom: "10px",
            }}
          >
            {selectedMall?.photos?.map((photo, index) => (
              <img
                key={index}
                src={photo.getUrl()}
                alt="Shop"
                style={{ marginRight: "5px", height: "200px" }}
              />
            ))}
          </div>
          <div
            style={{
              fontSize: 17,
              fontWeight: "bold",
              maxWidth: "300px",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {selectedMall?.name}
          </div>
          <div
            style={{
              fontSize: 13,
              color: "gray",
              maxWidth: "300px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              marginBottom: "10px",
            }}
          >
            {selectedMall?.formatted_address}
          </div>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <Star fontSize="medium" sx={{ color: "yellow" }} />
            <div>{selectedMall?.rating}</div>
            <div style={{ fontSize: 12, color: "gray" }}>
              ({selectedMall?.user_ratings_total} Ratings)
            </div>
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDialog(false)}>Cancel</Button>
          <Button disabled={loading} variant="contained" onClick={addPlace}>
            {loading ? "Adding..." : "Add"}
          </Button>
        </DialogActions>
      </Dialog>

      <PageHeading text="Shopping Mall Add" />
      <div
        style={{ display: "flex", alignItems: "center", width: "100%", gap: 8 }}
      >
        <div style={{ width: "100%" }}>
          <Autocomplete>
            <input
              ref={inputRef}
              type="text"
              placeholder="Enter mall name"
              style={{
                width: "100%",
                height: "40px",
                padding: "10px",
                marginTop: "10px",
                marginBottom: "10px",
                border: "1px solid #ccc",
              }}
            />
          </Autocomplete>
        </div>
        <Button
          onClick={() => setShowDialog(true)}
          variant="contained"
          style={{ height: "40px" }}
        >
          Add
        </Button>
      </div>
      <div id="map" style={containerStyle} />
    </div>
  );
};

export default ShoppingMallAdd;

import { GoogleMap, Marker } from "@react-google-maps/api";
import { MarkerF } from "@react-google-maps/api";

import { useEffect, useState } from "react";

const containerStyle = {
  width: "100%",
  height: "100%", // Adjust the height as needed
};

const Map = ({ locationURL }) => {
  const [center, setCenter] = useState({
    lat: 7.910524088260687,
    lng: 98.39749908500492,
  });
  const [isLoaded, setIsLoaded] = useState(true);

  // useEffect(() => {
  //   const url = new URL(locationURL); // Replace with user-provided URL
  //   console.log(url);
  //   const lat = url.searchParams.get("lat");
  //   const lng = url.searchParams.get("lng");
  //   console.log(lat, lng);
  //   if (lat && lng) {
  //     setCenter({ lat: parseFloat(lat), lng: parseFloat(lng) });
  //     setIsLoaded(true);
  //   }
  // }, [locationURL]);

  return (
    <>
      {isLoaded ? (
        <GoogleMap
          id="map"
          center={center}
          zoom={13}
          mapContainerStyle={{ width: "100%", height: "100%" }}
        >
          <MarkerF position={center} />
        </GoogleMap>
      ) : (
        <div>Loading map...</div>
      )}
    </>
  );
};

export default Map;

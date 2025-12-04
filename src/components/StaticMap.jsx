import { GoogleMap, MarkerF } from "@react-google-maps/api";
import { useEffect } from "react";
import { useState } from "react";
import Loading from "./Loading";

const StaticMap = ({ location }) => {
  const [center, setCenter] = useState({ lat: 48.8584, lng: 2.294 });

  useEffect(() => {
    const data = (location) => {
      setCenter(location);
    };

    location && data(location);
  }, [location]);

  // if (!location) {
  //   return <Loading />;
  // }

  return (
    <div className="w-full h-[350px] my-4 relative border border-blue-600">
      <GoogleMap
        id="map"
        center={center}
        zoom={14}
        mapContainerStyle={{ width: "100%", height: "100%" }}
      >
        {location && <MarkerF position={location} />}
      </GoogleMap>
    </div>
  );
};

export default StaticMap;

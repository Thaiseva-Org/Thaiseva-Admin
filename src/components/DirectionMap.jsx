import { useEffect, useState } from "react";
import { DirectionsRenderer, GoogleMap } from "@react-google-maps/api";

const DirectionMap = () => {
  const [directions, setDirections] = useState(null);
  const [distance, setdistance] = useState("");

  useEffect(() => {
    const DirectionsService = new window.google.maps.DirectionsService();

    DirectionsService.route(
      {
        origin: new window.google.maps.LatLng(41.85073, -87.65126),
        destination: new window.google.maps.LatLng(41.85258, -87.65141),
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === window.google.maps.DirectionsStatus.OK) {
          setDirections(result);
          const route = result.routes[0];
          if (route && route.legs && route.legs.length > 0) {
            const leg = route.legs[0];
            setdistance(leg.distance.text);
          }
        } else {
          console.error(`error fetching directions ${result}`);
        }
      }
    );
  }, []);

  return (
    <div className="w-full h-full">
      {distance && (
        <div className="mt-1 text-xl font-bold">
          Total Distance : {distance}
        </div>
      )}
      <GoogleMap
        mapContainerStyle={{
          width: "100%",
          height: "90%",
        }}
        center={{
          lat: 41.85073,
          lng: -87.65126,
        }}
        zoom={7}
      >
        {directions && <DirectionsRenderer directions={directions} />}
      </GoogleMap>
    </div>
  );
};

export default DirectionMap;

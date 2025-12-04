import {
  // useJsApiLoader,
  GoogleMap,
  Marker,
  Autocomplete,
  DirectionsRenderer,
  useJsApiLoader,
} from "@react-google-maps/api";
import { useRef } from "react";
import { useState } from "react";

const center = { lat: 48.8584, lng: 2.2945 };

const PlacesSearchBox = () => {
  const { isLoaded } = useJsApiLoader({
    // googleMapsApiKey: "AIzaSyDwTBiBiGtJLrlbaiKzVN5BBCj8He1l5Zc",
    // libraries: ["places"],
  });

  const [map, setMap] = useState(/** @type google.maps.Map */ (null));
  const [directionsResponse, setDirectionsResponse] = useState(null);
  const [distance, setDistance] = useState("");
  const [duration, setDuration] = useState("");

  /** @type React.MutableRefObject<HTMLInputElement> */
  const originRef = useRef();
  /** @type React.MutableRefObject<HTMLInputElement> */
  const destiantionRef = useRef();

  async function calculateRoute() {
    if (originRef.current.value === "" || destiantionRef.current.value === "") {
      return;
    }
    // eslint-disable-next-line no-undef
    const directionsService = new google.maps.DirectionsService();
    const results = await directionsService.route({
      origin: originRef.current.value,
      destination: destiantionRef.current.value,
      // eslint-disable-next-line no-undef
      travelMode: google.maps.TravelMode.DRIVING,
    });
    setDirectionsResponse(results);
    setDistance(results.routes[0].legs[0].distance.text);
    setDuration(results.routes[0].legs[0].duration.text);
  }

  function clearRoute() {
    setDirectionsResponse(null);
    setDistance("");
    setDuration("");
    originRef.current.value = "";
    destiantionRef.current.value = "";
  }

  if (!isLoaded) {
    return <div>Loading map...</div>;
  }

  return (
    <div className="w-full h-[400px] relative">
      <div className="absolute top-0 left-1/4 z-10 bg-amber-300 w-2/3 p-2 rounded-lg">
        <div className="flex items-center justify-between gap-3 w-full">
          <div className="flex-1">
            <Autocomplete>
              <input
                label="Origin"
                type="text"
                ref={originRef}
                placeholder="Your location"
                className="location-input"
              />
            </Autocomplete>
          </div>
          <div className="flex-1">
            <Autocomplete>
              <input
                label="Destination"
                type="text"
                placeholder="Your Destination"
                className="location-input"
                ref={destiantionRef}
              />
            </Autocomplete>
          </div>
          <div className="flex-1">
            <div onClick={calculateRoute} className="location-btn">
              Go!
            </div>
            {/* <div onClick={clearRoute}>X</div> */}
          </div>
        </div>

        <div className="flex items-center justify-between w-full gap-3">
          <p>Distance: {distance} </p>
          <p>Duration: {duration} </p>
          <div
            onClick={() => {
              map.panTo(center);
              map.setZoom(15);
            }}
          >
            Go!
          </div>
        </div>
      </div>
      {/* Google Map Box */}
      <GoogleMap
        center={center}
        zoom={15}
        mapContainerStyle={{ width: "100%", height: "100%" }}
        options={{
          zoomControl: false,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        }}
        onLoad={(map) => setMap(map)}
      >
        <Marker position={center} />
        {directionsResponse && (
          <DirectionsRenderer directions={directionsResponse} />
        )}
      </GoogleMap>
    </div>
  );
};

export default PlacesSearchBox;

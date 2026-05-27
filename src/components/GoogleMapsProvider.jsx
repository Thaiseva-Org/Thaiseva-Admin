import { Loader } from "@googlemaps/js-api-loader";
import { useEffect, useState } from "react";

const libraries = ["places"];

const GoogleMapsProvider = ({ children }) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_Google_Api_Key;

    if (!apiKey) {
      setIsReady(true);
      return;
    }

    const loader = new Loader({
      apiKey,
      version: "weekly",
      libraries,
    });

    let isMounted = true;

    loader
      .load()
      .catch((error) => {
        console.warn("Google Maps failed to load:", error.message);
      })
      .finally(() => {
        if (isMounted) {
          setIsReady(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (!isReady) {
    return null;
  }

  return children;
};

export default GoogleMapsProvider;

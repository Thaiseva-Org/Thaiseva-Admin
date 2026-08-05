import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { hotelsCollection } from "../../../../../firebase/firebase.config";
import HotelRoomsManager from "./HotelRoomsManager";
import PageHeading from "../../../../../components/PageHeading";
import LoadingContent from "../../../../../components/LoadingContent";
import { Button } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

/** Normalize hotel fields across gold-standard and legacy shapes. */
const hotelDisplay = (data, docId) => {
  const h = data?.hotel || data?.hotelInformation || data || {};
  const uid =
    data?.uid ||
    data?.hotelUid ||
    h?.hotelUid ||
    h?.hotelId ||
    docId;
  return {
    ...data,
    uid,
    hotelName: h.hotelName || data?.hotelName || "Hotel",
    phoneNumber: h.phoneNumber || data?.phoneNumber || "",
    location: h.location || data?.location || null,
  };
};

const HotelRoomsPage = () => {
  const { hotelId } = useParams();
  const navigate = useNavigate();
  const [hotelDetails, setHotelDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHotelDetails = async () => {
      try {
        const docRef = doc(hotelsCollection, hotelId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setHotelDetails(hotelDisplay(docSnap.data(), hotelId));
        } else {
          console.error("No such hotel!");
        }
      } catch (error) {
        console.error("Error fetching hotel details:", error);
      } finally {
        setLoading(false);
      }
    };

    if (hotelId) {
      fetchHotelDetails();
    }
  }, [hotelId]);

  if (loading) {
    return <LoadingContent />;
  }

  if (!hotelDetails) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh]">
        <h2 className="text-2xl font-bold text-neutral-600">Hotel Not Found</h2>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate("/dashboard/hotels")}
          sx={{ mt: 2 }}
        >
          Back to Hotels
        </Button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate("/dashboard/hotels")}
          variant="outlined"
          sx={{
            borderRadius: "12px",
            textTransform: "none",
            borderColor: "#e2e8f0",
            color: "#64748b",
            "&:hover": {
              borderColor: "#cbd5e1",
              backgroundColor: "#f8fafc",
            },
          }}
        >
          Back
        </Button>
        <div className="flex-1">
          <PageHeading
            text={`Rooms: ${hotelDetails.hotelName}`}
            subtitle="Manage room types and availability for this hotel"
            icon="🛏️"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6">
        <HotelRoomsManager
          hotelUid={hotelDetails.uid || hotelId}
          hotelName={hotelDetails.hotelName}
          hotelPhone={hotelDetails.phoneNumber}
          hotelLocation={hotelDetails.location}
        />
      </div>
    </div>
  );
};

export default HotelRoomsPage;

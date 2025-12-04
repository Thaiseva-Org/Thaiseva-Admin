import {
  Box,
  Button,
  DialogActions,
  Grid,
  TextField,
  Alert,
} from "@mui/material";
import {
  doc,
  // onSnapshot,
  // query,
  // setDoc,
  updateDoc,
  // where,
} from "firebase/firestore";
import { useState } from "react";
import { settingsCollection } from "../firebase/firebase.config";
// import { v4 as uuid } from "uuid";
import {
  // askingForDelete,
  askingForUpdate,
  // deleteNotification,
  // getFileUrl,
  successNotification,
} from "../utils/utils";
// import Loading from "./Loading";
// import NotificationButtons from "./NotificationButton";
// import ViewAll from "./ViewAll";
import { encryptData } from "../services/DataEncrypter";
// import AddBannerForm from "./AddBannerForm";

const NotificationBanner = () => {
  // Offer Notification
  // const [openModalO, setOpenModalO] = useState(false);
  // const [errorO, setErrorO] = useState({ for: "", text: "" });
  // const [loadingO, setLoadingO] = useState({ for: "", status: false });
  // const [isUpdateO, setIsUpdateO] = useState(false);
  // const [showAllO, setShowAllO] = useState(true);
  // const [indexO, setIndexO] = useState(0);
  // const [bannerO, setBannerO] = useState({
  //   title: "",
  //   description: "",
  //   image: "",
  //   id: "",
  // });
  // const [bannersO, setBannersO] = useState([]);

  // useEffect(() => {
  //   const loadBanners = () => {
  //     setLoadingO({ for: "data", status: true });
  //     const unSub = onSnapshot(
  //       query(settingsCollection, where("id", "==", "NotificationOffers")),
  //       (result) => {
  //         const list = result.docs.map((doc) => doc.data());
  //         if (list[0]?.banners.length > 0) {
  //           setBannersO(list[0].banners);
  //           setLoadingO({ for: "data", status: false });
  //           if (list[0]?.banners?.length > 3) {
  //             setShowAllO(false);
  //           }
  //         }
  //         setLoadingO({ for: "data", status: false });
  //       }
  //     );

  //     return () => unSub();
  //   };

  //   loadBanners();
  // }, []);

  // const handleOpenModalO = () => {
  //   setBannerO({});
  //   setIsUpdateO(false);
  //   setOpenModalO(true);
  // };

  // const handleCloseModalO = () => {
  //   setOpenModalO(false);
  //   setBannerO({});
  // };

  // const handleAddBannerO = async () => {
  //   if (!bannerO.id) bannerO.id = uuid();
  //   if (bannerO.id) {
  //     await setDoc(doc(settingsCollection, "NotificationOffers"), {
  //       id: "NotificationOffers",
  //       banners: [...bannersO, bannerO],
  //     }).then(() => {
  //       setBannerO({
  //         title: "",
  //         description: "",
  //         image: "",
  //         id: "",
  //       });

  //       setOpenModalO(false);
  //     });
  //   }
  // };

  // const handleUpdateBannerModalO = (banner, i) => {
  //   setBannerO(banner);
  //   setIndexO(i);
  //   setIsUpdateO(true);
  //   setOpenModalO(true);
  // };

  // const handleUpdateBannerO = async () => {
  //   bannersO[indexO] = bannerO;
  //   await updateDoc(doc(settingsCollection, "NotificationOffers"), {
  //     banners: bannersO,
  //   }).then(() => {
  //     successNotification("The banner is updated.");
  //     setBannerO({
  //       title: "",
  //       description: "",
  //       image: "",
  //       id: "",
  //     });

  //     setOpenModalO(false);
  //     setIsUpdateO(false);
  //   });
  // };

  // const handleDeleteBannerO = async (id) => {
  //   const remaining = bannersO.filter((banner) => banner.id !== id);

  //   askingForDelete().then(async (result) => {
  //     if (result.isConfirmed) {
  //       await updateDoc(doc(settingsCollection, "NotificationOffers"), {
  //         id: "NotificationOffers",
  //         banners: remaining,
  //       }).then(() =>
  //         deleteNotification("The banner is deleted successfully.")
  //       );
  //     }
  //   });
  // };

  // const handleUploadImageO = async (e) => {
  //   const { files } = e.target;
  //   setErrorO({ for: "", text: "" });
  //   setLoadingO({ for: "image", status: true });
  //   const result = await getFileUrl(files);
  //   if (result.error) {
  //     setErrorO({ for: "image", text: result.message });
  //     setLoadingO({ for: "image", status: false });
  //   } else {
  //     setBannerO((p) => ({ ...p, image: result.url }));
  //     setLoadingO({ for: "image", status: false });
  //   }
  // };

  // Credentials Change
  const [cred, setCred] = useState({
    appId: "",
    appSign: "",
  });

  const handleUpdateCredentials = async () => {
    askingForUpdate("You are changing calling credentials!!").then(
      async (result) => {
        if (result.isConfirmed) {
          await updateDoc(doc(settingsCollection, "Confidential"), {
            appId: encryptData(cred.appId),
            appSign: encryptData(cred.appSign),
          }).then(() => {
            successNotification("Credentials Updated Successfully.");
            setCred({
              appId: "",
              appSign: "",
            });
          });
        }
      }
    );
  };

  return (
    <div className="mb-8 rounded-lg">
      <div className="flex w-full lg:w-[50%] lg:flex-row flex-col gap-8 lg:gap-4">
        {/* Notifications */}
        {/* <div className="flex-1 w-[calc(50%-0.5rem)] max-lg:w-full banner-layout">
          <div className="banner-section-title">
            <h2>Offer Notification</h2>
            <button onClick={handleOpenModalO} className="add-new-btn">
              Add New
            </button>
          </div>
          <div className="flex lg:flex-row w-full flex-col-reverse gap-4">
            <div className="notification-left-view">
              {loadingO?.for === "data" && loadingO?.status === false ? (
                bannersO
                  ?.slice(0, showAllO ? bannersO?.length : 3)
                  ?.map((banner, i) => (
                    <NotificationButtons
                      i={i}
                      key={i}
                      banner={banner}
                      handleUpdateBannerModal={handleUpdateBannerModalO}
                      handleDeleteBanner={handleDeleteBannerO}
                    />
                  ))
              ) : (
                <Loading />
              )}
              <ViewAll showAll={showAllO} setShowAll={setShowAllO} />
              {bannersO?.length < 1 && (
                <span className="py-8 text-center light-text">
                  No Offer available
                </span>
              )}
            </div>
          </div>

          <AddBannerForm
            error={errorO}
            loading={loadingO}
            openModal={openModalO}
            handleCloseModal={handleCloseModalO}
            isUpdate={isUpdateO}
            banner={bannerO}
            setBanner={setBannerO}
            handleUploadImage={handleUploadImageO}
            handleAddBanner={handleAddBannerO}
            handleUpdateBanner={handleUpdateBannerO}
          />
        </div> */}

        {/* Credentials Setup */}
        <div className="flex-1 w-[calc(50%-0.5rem)] max-lg:w-full banner-layout">
          <div className="banner-section-title">
            <h2>Change Calling Credentials</h2>
          </div>

          <div className="flex lg:flex-row w-full flex-col-reverse gap-4">
            <div className="notification-left-view">
              <Box>
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={12} sm={12}>
                    <TextField
                      label="App ID"
                      type="text"
                      autoComplete="off"
                      placeholder="Place new AppID here"
                      value={cred.appId}
                      onChange={(e) =>
                        setCred((p) => ({ ...p, appId: e.target.value }))
                      }
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} sm={12}>
                    <TextField
                      label="App Sign"
                      type="text"
                      autoComplete="off"
                      placeholder="Place new AppSign here"
                      value={cred.appSign}
                      onChange={(e) =>
                        setCred((p) => ({
                          ...p,
                          appSign: e.target.value,
                        }))
                      }
                      fullWidth
                    />
                  </Grid>
                </Grid>
                <Alert severity="warning" sx={{ mb: 1 }}>
                  Please check the credentials and think twice before updating
                  to avoid disrupting the calling feature.
                </Alert>
                <DialogActions>
                  <Button
                    variant="contained"
                    type="submit"
                    autoFocus
                    sx={{
                      bgcolor: "var(--primary-bg)",
                      color: "white",
                      hover: "none",
                    }}
                    onClick={handleUpdateCredentials}
                    disabled={cred.appId === "" || cred.appSign === ""}
                  >
                    Update
                  </Button>
                </DialogActions>
              </Box>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationBanner;

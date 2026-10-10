import {Alert} from "@mui/material";

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

        <Alert severity="info">Calling credentials are managed by the server administrator.</Alert>
      </div>
    </div>
  );
};

export default NotificationBanner;

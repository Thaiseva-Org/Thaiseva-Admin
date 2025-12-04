import {
  doc,
  setDoc,
  updateDoc
} from "firebase/firestore";
import { useState } from "react";
import { v4 as uuid } from "uuid";
import { settingsCollection } from "../firebase/firebase.config";
import {
  askingForDelete,
  deleteNotification,
  getFileUrl,
  successNotification,
} from "../utils/utils";
import ActionButtons from "./ActionButtons";
import AddBannerForm from "./AddBannerForm";
import ImageButtons from "./ImageButtons";
import Loading from "./Loading";
import ViewAll from "./ViewAll";

const NewOfferBanner = () => {
  const [openModal, setOpenModal] = useState(false);
  const [error, setError] = useState({ for: "", text: "" });
  const [loading, setLoading] = useState({ for: "", status: false });
  const [activeBanner, setActiveBanner] = useState(0);
  const [isUpdate, setIsUpdate] = useState(false);
  const [showAll, setShowAll] = useState(true);
  const [index, setIndex] = useState(0);
  const [banner, setBanner] = useState({
    title: "",
    description: "",
    image: "",
    id: "",
  });
  const [banners, setBanners] = useState([]);

  // useEffect(() => {
  //   const loadBanners = () => {
  //     setLoading({ for: "data", status: true });
  //     const unSub = onSnapshot(
  //       query(settingsCollection, where("id", "==", "NewOffers")),
  //       (result) => {
  //         const list = result.docs.map((doc) => doc.data());
  //         if (list[0]?.banners.length > 0) {
  //           setBanners(list[0].banners);
  //           setActiveBanner(0);
  //           setLoading({ for: "data", status: false });
  //           if (list[0]?.banners?.length > 4) {
  //             setShowAll(false);
  //           }
  //         }
  //         setLoading({ for: "data", status: false });
  //       }
  //     );

  //     return () => unSub();
  //   };

  //   loadBanners();
  // }, []);

  const handleOpenModal = () => {
    setBanner({});
    setIsUpdate(false);
    setOpenModal(true);
  };

  const handleCloseModal = () => {
    setOpenModal(false);
    setBanner({});
  };

  const handleAddBanner = async () => {
    if (!banner.id) banner.id = uuid();
    if (banner.id) {
      await setDoc(doc(settingsCollection, "NewOffers"), {
        id: "NewOffers",
        banners: [...banners, banner],
      }).then(() => {
        setBanner({
          title: "",
          description: "",
          image: "",
          id: "",
        });

        setOpenModal(false);
      });
    }
  };

  const handleUpdateBannerModal = (banner, i) => {
    setBanner(banner);
    setIndex(i);
    setIsUpdate(true);
    setOpenModal(true);
  };

  const handleUpdateBanner = async () => {
    banners[index] = banner;
    await updateDoc(doc(settingsCollection, "NewOffers"), {
      banners: banners,
    }).then(() => {
      successNotification("The banner is updated.");
      setBanner({
        title: "",
        description: "",
        image: "",
        id: "",
      });

      setOpenModal(false);
      setIsUpdate(false);
    });
  };

  const handleDeleteBanner = async (id) => {
    const remaining = banners.filter((banner) => banner.id !== id);

    askingForDelete().then(async (result) => {
      if (result.isConfirmed) {
        await updateDoc(doc(settingsCollection, "NewOffers"), {
          id: "NewOffers",
          banners: remaining,
        }).then(() =>
          deleteNotification("The banner is deleted successfully.")
        );
      }
    });
  };

  const handleUploadImage = async (e) => {
    const { files } = e.target;
    setError({ for: "", text: "" });
    setLoading({ for: "image", status: true });
    const result = await getFileUrl(files);
    if (result.error) {
      setError({ for: "image", text: result.message });
      setLoading({ for: "image", status: false });
    } else {
      setBanner((p) => ({ ...p, image: result.url }));
      setLoading({ for: "image", status: false });
    }
  };

  return (
    <div className="mb-8 banner-layout">
      <div className="h-full banner-section-title">
        <h2>New Offers page banners</h2>
        <button onClick={handleOpenModal} className="add-new-btn">
          Add New
        </button>
      </div>

      <div className="flex lg:flex-row w-full flex-col-reverse gap-4">
        <div className="banner-box-left-view">
          {loading?.for === "data" && loading?.status === false ? (
            banners
              ?.slice(0, showAll ? banners.length : 4)
              ?.map((banner, i) => (
                // <div
                //   key={i}
                //   className={`flex flex-row items-center justify-between border-2 p-1 rounded shadow-md shadow-black/30 ${
                //     activeBanner?.i === i
                //       ? "bg-purple-300  border-purple-500"
                //       : "bg-white border-blue-100"
                //   }`}
                // >
                //   <div className="flex gap-2 grow">
                //     <img
                //       src={banner.image}
                //       alt=""
                //       className="w-20 h-12 rounded sm:block hidden"
                //     />
                //     <div className="relative grow">
                //       <h3 className="text-sm text-slate-600">
                //         {banner?.title?.slice(0, 20)}
                //         {banner?.title?.length > 20 && "..."}
                //       </h3>
                //       <p className="text-xs text-slate-500">
                //         {banner?.description?.slice(0, 29)}
                //         {banner?.description?.length > 30 && "..."}
                //       </p>
                //     </div>
                //   </div>
                //   <div className="flex gap-2 mr-1">
                //     <div onClick={() => setActiveBanner({ ...banner, i })}>
                //       <ViewDetailsIcon />
                //     </div>
                //     <div onClick={() => handleUpdateBannerModal(banner, i)}>
                //       <UpdateButton />
                //     </div>
                //     <div onClick={() => handleDeleteBanner(banner.id)}>
                //       <DeleteButton />
                //     </div>
                //   </div>
                // </div>
                <ActionButtons
                  i={i}
                  key={i}
                  banner={banner}
                  activeBanner={activeBanner}
                  setActiveBanner={setActiveBanner}
                  handleUpdateBannerModal={handleUpdateBannerModal}
                  handleDeleteBanner={handleDeleteBanner}
                />
              ))
          ) : (
            <Loading />
          )}
          <ViewAll showAll={showAll} setShowAll={setShowAll} />
          {banners?.length < 1 && <span>No banner available</span>}
        </div>

        {/* displaing acive banner */}
        <div className="flex-1 relative rounded bg-white lg:w-[50%]">
          {/* {activeBanner?.image ? (
            <div className="w-full h-80 relative rounded-lg">
              <img
                src={activeBanner?.image}
                alt=""
                className="w-full h-full rounded-lg shadow-md"
              />

              <div className="w-full h-full absolute top-0 right-0 flex items-center justify-between p-10">
                <div className="bg-black/50 p-4 rounded-sm">
                  <h3 className="text-lg font-bold text-center text-white">
                    {activeBanner?.title}
                  </h3>
                  <p className="text-white/80 text-center">
                    {activeBanner?.description}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <span>No banner available</span>
          )} */}
          <div className="w-full h-80 rounded-lg">
            <img
              src={banners?.[activeBanner]?.image}
              alt=""
              className="w-full h-full rounded-lg shadow-md"
            />
          </div>
          <ImageButtons
            activeBanner={activeBanner}
            setActiveBanner={setActiveBanner}
            length={banners.length}
          />
        </div>
      </div>

      <AddBannerForm
        error={error}
        loading={loading}
        openModal={openModal}
        handleCloseModal={handleCloseModal}
        isUpdate={isUpdate}
        banner={banner}
        setBanner={setBanner}
        handleUploadImage={handleUploadImage}
        handleAddBanner={handleAddBanner}
        handleUpdateBanner={handleUpdateBanner}
      />

      {/* <Dialog
        open={openModal}
        onClose={handleCloseModal}
        aria-labelledby="responsive-dialog-title"
      >
        <Box>
          <DialogTitle sx={{ m: 0, p: 2 }} id="customized-dialog-title">
            NewOffers page banner
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

          <DialogContent dividers sx={{ p: { xs: 2, md: 2 } }}>
            <Grid container spacing={2} sx={{ mb: 2, mt: 0.5 }}>

              <Grid item xs={12} sm={12}>
                <TextField
                  label="Banner title"
                  type="text"
                  placeholder="Provide a banner title"
                  value={banner.title}
                  onChange={(e) =>
                    setBanner((p) => ({ ...p, title: e.target.value }))
                  }
                  defaultValue=""
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={12}>
                <TextField
                  label="Banner text"
                  type="text"
                  placeholder="Provide a description"
                  value={banner.description}
                  onChange={(e) =>
                    setBanner((p) => ({ ...p, description: e.target.value }))
                  }
                  defaultValue=""
                  fullWidth
                />
              </Grid>

              <Grid item xs={12} sm={12}>
                <TextField
                  label="Select a banner"
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
              {banner.image && (
                <Grid item xs={12} sm={12}>
                  <img
                    src={banner.image}
                    alt=""
                    className="w-full h-64 rounded-lg"
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
                bgcolor: "var(--primary-bg)",
                color: "white",
                hover: "none",
              }}
              onClick={isUpdate ? handleUpdateBanner : handleAddBanner}
              disabled={!banner.image}
            >
              {isUpdate ? "Update" : "Add"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog> */}
    </div>
  );
};

export default NewOfferBanner;

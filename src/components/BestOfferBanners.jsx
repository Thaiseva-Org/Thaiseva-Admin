import { doc, setDoc, updateDoc } from "firebase/firestore";
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
import ViewAll from "./ViewAll";

const BestOfferBanners = ({ bestOfferBanners }) => {
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
  const [banners, setBanners] = useState(bestOfferBanners);

  const handleOpenModal = () => {
    setIsUpdate(false);
    setBanner({});
    setOpenModal(true);
  };

  const handleCloseModal = () => {
    setOpenModal(false);
    setBanner({});
  };

  const handleAddBanner = async () => {
    if (!banner.id) banner.id = uuid();
    if (banner.id) {
      const newArray = [...banners, banner];
      await setDoc(doc(settingsCollection, "todayBestOffer"), {
        id: "todayBestOffer",
        banners: newArray,
      }).then(() => {
        setBanner({
          title: "",
          description: "",
          image: "",
          id: "",
        });
        setBanners(newArray);
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
    await updateDoc(doc(settingsCollection, "todayBestOffer"), {
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
      setBanners(banners);
      setIsUpdate(false);
    });
  };

  const handleDeleteBanner = async (id) => {
    const remaining = banners.filter((banner) => banner.id !== id);

    askingForDelete().then(async (result) => {
      if (result.isConfirmed) {
        await updateDoc(doc(settingsCollection, "todayBestOffer"), {
          id: "todayBestOffer",
          banners: remaining,
        }).then(() => {
          deleteNotification("The banner is deleted successfully.");
          setBanners(remaining);
          setActiveBanner(0);
        });
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
        <h2>Today Best Offer Banners</h2>
        <button onClick={handleOpenModal} className="add-new-btn">
          Add New
        </button>
      </div>

      {banners?.length >= 1 ? (
        <div className="flex lg:flex-row w-full flex-col-reverse gap-4">
          <div className="banner-box-left-view">
            {banners
              ?.slice(0, showAll ? banners.length : 4)
              ?.map((banner, i) => (
                <ActionButtons
                  i={i}
                  key={i}
                  banner={banner}
                  activeBanner={activeBanner}
                  setActiveBanner={setActiveBanner}
                  handleUpdateBannerModal={handleUpdateBannerModal}
                  handleDeleteBanner={handleDeleteBanner}
                />
              ))}
            <ViewAll showAll={showAll} setShowAll={setShowAll} />
            {banners?.length < 1 && <span>No banner available</span>}
          </div>

          {/* displaing acive banner */}
          <div className="flex-1 relative rounded bg-white lg:w-[50%]">
            <div className="w-full h-80 rounded-lg">
              <img
                loading="lazy"
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
      ) : (
        <div className="w-full text-center mt-2 mb-5 light-text">
          No banner available
        </div>
      )}

      <AddBannerForm
        title="Today Best Offer Banner"
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
    </div>
  );
};

export default BestOfferBanners;

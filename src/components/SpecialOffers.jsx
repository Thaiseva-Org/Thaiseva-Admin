import { doc, setDoc, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
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

const types = [
  { id: "food", name: "Food" },
  { id: "travel", name: "Travel" },
  { id: "hotel", name: "Hotel" },
];

const SpecialOffers = ({ specialOffers }) => {
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
    type: "",
    id: "",
  });
  const [banners, setBanners] = useState(specialOffers);
  const [filteredBanners, setFilteredBanners] = useState([]);
  const [type, setType] = useState(types[0].id);

  useEffect(() => {
    const loadFilteredBanners = () => {
      const filteredBanners = banners?.filter((banner) => banner.type === type);
      setFilteredBanners(filteredBanners);
      if (filteredBanners && filteredBanners?.length > 4) {
        setShowAll(false);
      }
    };
    loadFilteredBanners();
  }, []);

  const filteredBannersData = (e) => {
    const selectedType = e.target.value;
    setType(selectedType);
    setFilteredBanners(
      banners?.filter((banner) => banner.type === selectedType)
    );
    setActiveBanner(0);
  };

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
      const newArray = [...banners, { ...banner, type: type }];
      await setDoc(doc(settingsCollection, "SpecialOffers"), {
        id: "SpecialOffers",
        banners: newArray,
      }).then(() => {
        setBanner({
          title: "",
          description: "",
          image: "",
          type: type,
          id: "",
        });
        setBanners(newArray);
        setOpenModal(false);
      });
    }
    setType("food");
  };

  const handleUpdateBannerModal = (banner, i) => {
    setBanner(banner);
    setIndex(i);
    setIsUpdate(true);
    setOpenModal(true);
  };

  const handleUpdateBanner = async () => {
    banners[index] = banner;
    await updateDoc(doc(settingsCollection, "SpecialOffers"), {
      banners: banners,
    }).then(() => {
      successNotification("The banner is updated.");
      setBanner({
        title: "",
        description: "",
        image: "",
        id: "",
      });
      setBanners(banners);
      setOpenModal(false);
      setIsUpdate(false);
    });
  };

  const handleDeleteBanner = async (id) => {
    const remaining = banners.filter((banner) => banner.id !== id);

    askingForDelete().then(async (result) => {
      if (result.isConfirmed) {
        await updateDoc(doc(settingsCollection, "SpecialOffers"), {
          id: "SpecialOffers",
          banners: remaining,
        }).then(() => {
          deleteNotification("The badge is deleted successfully.");
          setBanners(remaining);
          setActiveBanner(0);
        });
      }
    });
    setType("food");
    filteredBannersData();
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
    <div className="mb-4 banner-layout">
      <div className="banner-section-title">
        <h2>Special Offers</h2>

        <div className="flex gap-4 max-sm:gap-4">
          <select
            className="px-1 text-sm rounded bg-white cursor-pointer"
            onChange={filteredBannersData}
            value={type}
          >
            {types.map((type) => (
              <option className="cursor-pointer" key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
          <button onClick={handleOpenModal} className="add-new-btn">
            Add New
          </button>
        </div>
      </div>

      {banners?.length >= 1 ? (
        <div className="flex lg:flex-row w-full flex-col-reverse gap-4">
          <div className="banner-box-left-view">
            {loading?.status === false ? (
              filteredBanners
                ?.slice(0, showAll ? banners.length : 4)
                .map((banner, i) => (
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
          </div>
          {filteredBanners?.length < 1 && (
            <span className="flex items-center justify-center w-full pb-8 light-text">
              No banner available
            </span>
          )}

          {/* displaing acive banner */}
          <div
            className={`flex-1 relative rounded bg-white lg:w-[50%] ${
              filteredBanners?.length < 1 ? "hidden" : ""
            }`}
          >
            <div className="w-full h-80 rounded-lg">
              <img
                loading="lazy"
                src={filteredBanners?.[activeBanner]?.image}
                alt=""
                className="w-full h-full rounded-lg shadow-md object-cover"
              />
            </div>
            <ImageButtons
              activeBanner={activeBanner}
              setActiveBanner={setActiveBanner}
              length={filteredBanners.length}
            />
          </div>
        </div>
      ) : (
        <div className="w-full text-center mt-2 mb-5 light-text">
          No banner available
        </div>
      )}

      <AddBannerForm
        title="Special Offer"
        type="Offer"
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

export default SpecialOffers;

import DeleteButton from "./DeleteButton";
import UpdateButton from "./UpdateButton";

const ActionButtons = ({
  i,
  banner,
  activeBanner,
  setActiveBanner,
  handleUpdateBannerModal,
  handleDeleteBanner,
}) => {
  return (
    <div
      className={`flex flex-row items-center justify-between rounded-md shadow-[0_0_5px_rgba(0,0,0,0.1)] max-sm:h-16  transition-all duration-300 hover:scale-[1.025] mx-2 ${
        activeBanner === i
          ? "bg-[#ffe9c6] "
          : "bg-white border-[var(--secondary-bg)]"
      }`}
      onClick={() => setActiveBanner(i)}
    >
      {/* <div className="flex gap-2 grow"> */}
      <img
        loading="lazy"
        src={banner.image}
        alt=""
        className="w-24 h-16 object-cover rounded-l-md sm:block hidden"
      />
      <div className="relative grow mx-3 w-full overflow-hidden">
        <h3 className="text-md font-medium text-black truncate w-full">
          {banner?.title}
        </h3>
        <p className="text-xs text-slate-500 truncate w-full">
          {banner?.description}
        </p>
        <span
          className={`text-[10px] text-[#94290c] py-0.5 px-1.5 rounded-full bg-[#ffd388] border border-[#94290c] absolute top-0 right-1 ${
            banner?.category ? "" : "hidden"
          }`}
        >
          {banner.category}
        </span>
      </div>
      {/* </div> */}
      <div className="flex gap-2 mr-3 m-auto">
        {/* <div onClick={() => setActiveBanner({ ...banner, i })}>
          <ViewDetailsIcon />
        </div> */}
        <div onClick={() => handleUpdateBannerModal(banner, i)}>
          <UpdateButton />
        </div>
        <div onClick={() => handleDeleteBanner(banner.id)}>
          <DeleteButton />
        </div>
      </div>
    </div>
  );
};

export default ActionButtons;

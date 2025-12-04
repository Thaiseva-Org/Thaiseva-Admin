import React from "react";
import DeleteButton from "./DeleteButton";
import UpdateButton from "./UpdateButton";
import ViewDetailsIcon from "./ViewDetailsIcon";

const NotificationButtons = ({
  i,
  banner,
  handleUpdateBannerModal,
  handleDeleteBanner,
}) => {
  return (
    <div
      className={`flex flex-row items-center pl-2 transition-all w-[98%] duration-300 hover:scale-[1.025]`}
    >
      <img
        src={banner.image}
        alt=""
        className="w-[5.5rem] h-[5.5rem] rounded-full z-10"
      />

      <div
        className={`flex flex-row relative items-center shadow-[0_0_5px_rgba(0,0,0,0.1)] rounded-r-md w-[calc(100%-5.5rem)] pl-4 left-[-1rem] h-16 bg-white border-[var(--secondary-bg)]`}
      >
        <div className="relative grow mx-3 w-full overflow-hidden">
          <h3 className="text-md font-medium text-black truncate w-full">
            {banner?.title}
          </h3>
          <p className="text-xs text-slate-500 truncate w-full">
            {banner?.description}
          </p>
        </div>
        <div className="flex gap-2 mr-3 m-auto z-10">
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
    </div>
  );
};

export default NotificationButtons;

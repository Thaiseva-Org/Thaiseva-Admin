import React, { useState } from "react";
import ArrowForwardIosRoundedIcon from "@mui/icons-material/ArrowForwardIosRounded";
import ArrowBackIosRoundedIcon from "@mui/icons-material/ArrowBackIosRounded";

const ImageButtons = ({ setActiveBanner, length }) => {
  const [isClickable, setIsClickable] = useState(true);
  const timeGap = 500;
  return (
    <div className="w-full h-full absolute top-0 right-0 flex items-center justify-between p-2">
      <button
        onClick={() => {
          if (!isClickable) return;
          setIsClickable(false);
          setActiveBanner((activeBanner) =>
            activeBanner === 0 ? length - 1 : activeBanner - 1
          );
          setTimeout(() => {
            setIsClickable(true);
          }, timeGap);
        }}
        className="p-2 rounded-full bg-[var(--image-nnp-color)] scale-75 stroke-black shadow-xl shadow-black/50"
      >
        <ArrowBackIosRoundedIcon />
      </button>
      <button
        onClick={() => {
          if (!isClickable) return;
          setIsClickable(false);
          setActiveBanner((activeBanner) => (activeBanner + 1) % length);
          setTimeout(() => {
            setIsClickable(true);
          }, timeGap);
        }}
        className="p-2 rounded-full bg-[var(--image-nnp-color)] scale-75 stroke-black shadow-xl shadow-black/50"
      >
        <ArrowForwardIosRoundedIcon />
      </button>
    </div>
  );
};

export default ImageButtons;

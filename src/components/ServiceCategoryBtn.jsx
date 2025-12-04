import { Typography } from "@mui/material";

const ServiceCategoryBtn = ({ value }) => {
  return (
    <Typography variant="div">
      <span className="font-semibold sm:inline-block hidden">Category : </span>{" "}
      {/* <span className="bg-[blue] text-white text-sm font-bold py-1 px-2 rounded inline-block">
        {value}
      </span> */}
      <span className="bg-[var(--primary-bg)] py-1 md:text-lg text-sm px-2 rounded text-white">
        {value}
      </span>
    </Typography>
  );
};

export default ServiceCategoryBtn;

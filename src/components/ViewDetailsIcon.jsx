import { Tooltip } from "@mui/material";
import { RemoveRedEyeIcon } from "@icons";

const ViewDetailsIcon = ({ title = "", handleView = () => {}, id = "" }) => {
  const handleClick = () => {
    handleView(id);
  };
  return (
    <Tooltip title={title} arrow placement="top">
      <button
        className="bg-[var(--view-button-bg-color)] text-[var(--action-button-text-color)] p-1 rounded-full"
        onClick={handleClick} // Passing onClick prop here
      >
        <RemoveRedEyeIcon className="scale-75" />
      </button>
    </Tooltip>
  );
};

export default ViewDetailsIcon;

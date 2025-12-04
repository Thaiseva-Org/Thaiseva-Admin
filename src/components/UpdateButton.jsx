import { Tooltip } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";

const UpdateButton = ({ title = "", handleEdit = () => {}, id = "" }) => {
  const handleClick = () => {
    handleEdit(id);
  };
  return (
    <Tooltip title={title} arrow placement="top">
      {/* <button className="bg-orange-500 text-white p-1 rounded">
        <EditIcon />
      </button> */}
      <button
        className="bg-[var(--edit-button-bg-color)] text-[var(--action-button-text-color)] p-1 rounded-full"
        onClick={handleClick}
      >
        <EditIcon className="scale-90" />
      </button>
    </Tooltip>
  );
};

export default UpdateButton;

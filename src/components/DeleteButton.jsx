import { Tooltip } from "@mui/material";
import { DeleteForeverIcon } from "@icons";

const DeleteButton = ({ title = "", handleDelete = () => {}, id = "" }) => {
  const handleClick = () => {
    handleDelete(id);
  };

  return (
    <Tooltip title={title} arrow placement="top">
      {/* <button className="bg-red-500 text-white p-1 rounded h-full" onClick={handleClick}>
        <DeleteForeverIcon />
      </button> */}
      <button
        className="bg-[var(--delete-button-bg-color)] text-[var(--action-button-text-color)] p-1 rounded-full"
        onClick={handleClick}
      >
        <DeleteForeverIcon className="scale-90" />
      </button>
    </Tooltip>
  );
};

export default DeleteButton;

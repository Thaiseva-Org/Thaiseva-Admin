import { Tooltip } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";

const UpdateButton = ({ title }) => {
  return (
    <Tooltip title={title} arrow placement="top">
      <button className="bg-[var(--edit-button-bg-color)] text-[var(--action-button-text-color)] p-1 rounded-full">
        <EditIcon className="scale-75" />
      </button>
    </Tooltip>
  );
};

export default UpdateButton;

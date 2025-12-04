import { Tooltip } from "@mui/material";
import AddTaskIcon from "@mui/icons-material/AddTask";

const AddRequirementIcon = () => {
  return (
    <Tooltip title="Add Requirement" arrow placement="top">
      <button className="bg-orange-400 text-white p-1 rounded">
        <AddTaskIcon />
      </button>
    </Tooltip>
  );
};

export default AddRequirementIcon;

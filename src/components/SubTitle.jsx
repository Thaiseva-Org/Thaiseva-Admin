import { Typography } from "@mui/material";

const SubTitle = ({ text }) => {
  return (
    <Typography variant="h6" sx={{ color: 'var(--form-subheadings-color)', my: 1 }}>
  {text}
</Typography>
  );
};

export default SubTitle;

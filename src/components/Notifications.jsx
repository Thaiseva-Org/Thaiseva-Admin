import { enqueueSnackbar } from "notistack";

const successNotification = (text, variant) => {
  enqueueSnackbar(text, { variant });
};

export { successNotification };

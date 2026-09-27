import { Button, CircularProgress } from "@mui/material";
import { VerifiedUserIcon } from "@icons";

const iconButtonClassName =
  "p-2 rounded-full bg-emerald-500 text-white hover:bg-emerald-600 hover:scale-110 transition-all duration-200 disabled:opacity-60";

const modalButtonSx = {
  borderRadius: "10px",
  textTransform: "none",
  fontWeight: 600,
  bgcolor: "#10b981",
  px: 3,
  "&:hover": { bgcolor: "#059669" },
};

export const VerifyPaymentIconButton = ({
  onClick,
  disabled = false,
  loading = false,
  title = "Verify Payment",
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled || loading}
    className={iconButtonClassName}
    title={title}
    aria-label={title}
  >
    {loading ? (
      <CircularProgress size={18} color="inherit" />
    ) : (
      <VerifiedUserIcon className="scale-90" />
    )}
  </button>
);

export const VerifyPaymentModalButton = ({
  onClick,
  disabled = false,
  loading = false,
  label = "Verify Payment",
}) => (
  <Button
    variant="contained"
    startIcon={
      loading ? (
        <CircularProgress size={16} color="inherit" />
      ) : (
        <VerifiedUserIcon />
      )
    }
    disabled={disabled || loading}
    onClick={onClick}
    sx={modalButtonSx}
  >
    {label}
  </Button>
);
import {
  VerifiedUser as VerifiedUserIcon,
  Payments as PaymentsIcon,
  CreditCard as CreditCardIcon,
} from "@mui/icons-material";

const STATUS_ICONS = {
  verified: VerifiedUserIcon,
  onsite: PaymentsIcon,
  unverified: PaymentsIcon,
  unpaid: CreditCardIcon,
};

const resolveStatusKey = (label = "") => {
  const normalized = String(label).toLowerCase();
  if (normalized === "verified") return "verified";
  if (normalized === "onsite") return "onsite";
  if (normalized === "unverified") return "unverified";
  return "unpaid";
};

const PaymentStatusBadge = ({ statusInfo, showIcon = true, className = "" }) => {
  if (!statusInfo) return null;

  const StatusIcon = STATUS_ICONS[resolveStatusKey(statusInfo.label)];

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold ${statusInfo.className} ${className}`}
    >
      {showIcon && StatusIcon && <StatusIcon sx={{ fontSize: 14 }} />}
      {statusInfo.label}
    </span>
  );
};

export default PaymentStatusBadge;
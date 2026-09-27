import { forwardRef } from "react";
import { Box } from "@mui/material";
import { HugeiconsIcon } from "@hugeicons/react";
import * as StrokeRounded from "@hugeicons/core-free-icons";

const FONT_SIZES = { inherit: "inherit", small: 20, medium: 24, large: 35 };
const THEME_COLORS = {
  primary: "primary.main",
  secondary: "secondary.main",
  error: "error.main",
  warning: "warning.main",
  info: "info.main",
  success: "success.main",
  action: "action.active",
  disabled: "action.disabled",
  textPrimary: "text.primary",
  textSecondary: "text.secondary",
};

const hugeIcon = (icon) => {
  const Component = forwardRef(function StrokeRoundedIcon(
    { size, fontSize = "medium", color = "inherit", strokeWidth = 1.8, sx, style, ...props },
    ref,
  ) {
    const resolvedColor = color === "inherit"
      ? "inherit"
      : THEME_COLORS[color]
        ? THEME_COLORS[color]
        : color;
    return (
      <Box
        ref={ref}
        component={HugeiconsIcon}
        icon={icon}
        size={size || "1em"}
        strokeWidth={strokeWidth}
        color="currentColor"
        sx={[
          {
            display: "inline-block",
            flexShrink: 0,
            verticalAlign: "middle",
            fontSize: FONT_SIZES[fontSize] ?? fontSize,
            color: resolvedColor,
          },
          ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
        ]}
        style={style}
        {...props}
      />
    );
  });
  return Component;
};

const Close = hugeIcon(StrokeRounded.Cancel01Icon);
const DeleteBase = hugeIcon(StrokeRounded.Delete02Icon);
const EditBase = hugeIcon(StrokeRounded.PencilEdit02Icon);
const ViewBase = hugeIcon(StrokeRounded.ViewIcon);
const ViewOffBase = hugeIcon(StrokeRounded.ViewOffSlashIcon);
const CheckBase = hugeIcon(StrokeRounded.Tick02Icon);
const CheckCircleBase = hugeIcon(StrokeRounded.CheckmarkCircle02Icon);
const AddBase = hugeIcon(StrokeRounded.Add01Icon);
const AddCircleBase = hugeIcon(StrokeRounded.AddCircleIcon);
const ArrowBackBase = hugeIcon(StrokeRounded.ArrowLeft01Icon);
const ArrowForwardBase = hugeIcon(StrokeRounded.ArrowRight01Icon);
const CalendarBase = hugeIcon(StrokeRounded.Calendar03Icon);
const FilterBase = hugeIcon(StrokeRounded.FilterIcon);
const SearchBase = hugeIcon(StrokeRounded.Search01Icon);
const UserBase = hugeIcon(StrokeRounded.UserCircleIcon);
const MoneyBase = hugeIcon(StrokeRounded.Money03Icon);
const DownloadBase = hugeIcon(StrokeRounded.Download01Icon);
const UploadBase = hugeIcon(StrokeRounded.Upload01Icon);
const HotelBase = hugeIcon(StrokeRounded.Hotel02Icon);
const BedBase = hugeIcon(StrokeRounded.BedDoubleIcon);
const CarBase = hugeIcon(StrokeRounded.Car03Icon);
const BusBase = hugeIcon(StrokeRounded.Bus03Icon);
const RestaurantBase = hugeIcon(StrokeRounded.Restaurant01Icon);
const NotificationBase = hugeIcon(StrokeRounded.Notification03Icon);
const MailBase = hugeIcon(StrokeRounded.Mail01Icon);
const LocationBase = hugeIcon(StrokeRounded.Location01Icon);
const SettingsBase = hugeIcon(StrokeRounded.Settings01Icon);

export const CloseIcon = Close;
export const CloseRoundedIcon = Close;
export const ClearIcon = Close;
export const ClearRoundedIcon = Close;
export const CancelOutlined = Close;
export const MdCancel = Close;
export const MdClose = Close;

export const Delete = DeleteBase;
export const DeleteIcon = DeleteBase;
export const DeleteForeverIcon = DeleteBase;
export const MdDelete = DeleteBase;
export const EditIcon = EditBase;
export const EditOutlined = EditBase;
export const MdEdit = EditBase;

export const Visibility = ViewBase;
export const VisibilityIcon = ViewBase;
export const VisibilityOutlined = ViewBase;
export const RemoveRedEyeIcon = ViewBase;
export const MdVisibility = ViewBase;
export const FaRegEye = ViewBase;
export const VisibilityOff = ViewOffBase;
export const FaRegEyeSlash = ViewOffBase;

export const CheckIcon = CheckBase;
export const DoneRoundedIcon = CheckBase;
export const DoneAll = CheckBase;
export const MdCheck = CheckBase;
export const CheckCircle = CheckCircleBase;
export const CheckCircleOutline = CheckCircleBase;
export const CheckCircleOutlineIcon = CheckCircleBase;
export const MdCheckCircle = CheckCircleBase;
export const CheckBoxIcon = hugeIcon(StrokeRounded.CheckmarkSquare02Icon);
export const VerifiedUserIcon = hugeIcon(StrokeRounded.Shield01Icon);
export const Circle = hugeIcon(StrokeRounded.CircleIcon);

export const Add = AddBase;
export const AddIcon = AddBase;
export const MdAdd = AddBase;
export const FaPlus = AddBase;
export const AddCircleIcon = AddCircleBase;
export const AddTaskIcon = hugeIcon(StrokeRounded.TaskAdd01Icon);
export const FaMinus = hugeIcon(StrokeRounded.MinusSignIcon);

export const ArrowBack = ArrowBackBase;
export const ArrowBackIcon = ArrowBackBase;
export const ArrowBackIosNewIcon = ArrowBackBase;
export const ArrowBackIosNewRoundedIcon = ArrowBackBase;
export const ArrowBackIosRoundedIcon = ArrowBackBase;
export const MdArrowBack = ArrowBackBase;
export const ArrowForwardIosIcon = ArrowForwardBase;
export const ArrowForwardIosRoundedIcon = ArrowForwardBase;
export const NavigateNextIcon = ArrowForwardBase;
export const MdArrowForward = ArrowForwardBase;
export const ExpandLess = hugeIcon(StrokeRounded.ArrowUp01Icon);
export const ExpandLessIcon = ExpandLess;
export const ExpandMore = hugeIcon(StrokeRounded.ArrowDown01Icon);
export const ExpandMoreIcon = ExpandMore;

export const Search = SearchBase;
export const SearchIcon = SearchBase;
export const MdSearch = SearchBase;
export const FilterAltIcon = FilterBase;
export const FilterList = FilterBase;
export const FilterListIcon = FilterBase;
export const RestartAltIcon = hugeIcon(StrokeRounded.FilterResetIcon);
export const RefreshIcon = hugeIcon(StrokeRounded.RefreshIcon);
export const SortIcon = hugeIcon(StrokeRounded.Sorting01Icon);

export const CalendarMonth = CalendarBase;
export const CalendarMonthIcon = CalendarBase;
export const CalendarMonthRoundedIcon = CalendarBase;
export const CalendarTodayIcon = CalendarBase;
export const EventAvailableIcon = hugeIcon(StrokeRounded.CalendarCheckIn01Icon);
export const MdEventAvailable = EventAvailableIcon;
export const EventBusyIcon = hugeIcon(StrokeRounded.CalendarBlock01Icon);
export const AccessTime = hugeIcon(StrokeRounded.Clock01Icon);
export const AccessTimeIcon = AccessTime;
export const ScheduleIcon = AccessTime;
export const HourglassEmptyIcon = hugeIcon(StrokeRounded.HourglassIcon);

export const Person = UserBase;
export const PersonIcon = UserBase;
export const PersonOutlineIcon = UserBase;
export const AccountCircle = UserBase;
export const FaUser = UserBase;
export const PersonAddAlt1Icon = hugeIcon(StrokeRounded.UserAdd01Icon);
export const PersonAddDisabledIcon = hugeIcon(StrokeRounded.UserBlock01Icon);
export const PersonRemoveIcon = hugeIcon(StrokeRounded.UserRemove01Icon);
export const GroupRoundedIcon = hugeIcon(StrokeRounded.UserMultiple02Icon);
export const Groups = GroupRoundedIcon;
export const MdPeople = GroupRoundedIcon;
export const Diversity1Icon = hugeIcon(StrokeRounded.UserGroupIcon);
export const ManageAccountsIcon = hugeIcon(StrokeRounded.UserSettings01Icon);
export const HowToRegIcon = hugeIcon(StrokeRounded.UserCheck01Icon);
export const HailIcon = hugeIcon(StrokeRounded.UserRoadsideIcon);

export const Email = MailBase;
export const EmailIcon = MailBase;
export const MailOutlineIcon = MailBase;
export const MdEmail = MailBase;
export const FaEnvelope = MailBase;
export const Lock = hugeIcon(StrokeRounded.LockIcon);
export const FaLock = Lock;
export const PhoneIcon = hugeIcon(StrokeRounded.PhoneIcon);
export const PhoneIphoneIcon = hugeIcon(StrokeRounded.SmartPhone01Icon);
export const MdPhone = PhoneIcon;
export const Map = hugeIcon(StrokeRounded.MapIcon);
export const LocationOn = LocationBase;
export const LocationOnIcon = LocationBase;
export const MdLocationOn = LocationBase;
export const PublicIcon = hugeIcon(StrokeRounded.Globe02Icon);
export const LocationCity = hugeIcon(StrokeRounded.Building03Icon);

export const HotelIcon = HotelBase;
export const LocalHotelIcon = HotelBase;
export const BedIcon = BedBase;
export const BedroomParentIcon = BedBase;
export const FaBed = BedBase;
export const MeetingRoomIcon = hugeIcon(StrokeRounded.MeetingRoomIcon);
export const MdMeetingRoom = MeetingRoomIcon;
export const DirectionsCar = CarBase;
export const DirectionsCarIcon = CarBase;
export const DriveEtaIcon = CarBase;
export const NoCrashIcon = CarBase;
export const LocalTaxiIcon = hugeIcon(StrokeRounded.TaxiIcon);
export const LocalTaxiRoundedIcon = LocalTaxiIcon;
export const DirectionsBusIcon = BusBase;
export const LuggageIcon = hugeIcon(StrokeRounded.Luggage01Icon);
export const TourIcon = hugeIcon(StrokeRounded.Flag03Icon);
export const TravelExploreIcon = hugeIcon(StrokeRounded.MapsGlobalIcon);

export const RestaurantIcon = RestaurantBase;
export const FastfoodIcon = RestaurantBase;
export const MdRestaurant = RestaurantBase;
export const NightlifeIcon = hugeIcon(StrokeRounded.DrinkIcon);
export const Shop = hugeIcon(StrokeRounded.Store01Icon);
export const Business = hugeIcon(StrokeRounded.Building03Icon);
export const ApartmentIcon = Business;
export const HandshakeIcon = hugeIcon(StrokeRounded.Agreement01Icon);
export const SupportAgentIcon = hugeIcon(StrokeRounded.CustomerSupportIcon);
export const ForumIcon = hugeIcon(StrokeRounded.Message01Icon);
export const ChatBubbleRoundedIcon = ForumIcon;
export const MenuIcon = hugeIcon(StrokeRounded.Menu01Icon);

export const AttachMoneyIcon = MoneyBase;
export const MdAttachMoney = MoneyBase;
export const MonetizationOn = MoneyBase;
export const PaidRoundedIcon = MoneyBase;
export const AccountBalance = hugeIcon(StrokeRounded.BankIcon);
export const MdAccountBalance = AccountBalance;
export const AccountBalanceWalletIcon = hugeIcon(StrokeRounded.Wallet01Icon);
export const CreditCard = hugeIcon(StrokeRounded.CreditCardIcon);
export const CreditCardIcon = CreditCard;
export const PaymentsIcon = hugeIcon(StrokeRounded.Payment01Icon);
export const PaymentsOutlined = PaymentsIcon;
export const ReceiptIcon = hugeIcon(StrokeRounded.ReceiptTextIcon);
export const ReceiptLongRoundedIcon = ReceiptIcon;
export const ArticleIcon = hugeIcon(StrokeRounded.File02Icon);
export const DescriptionIcon = ArticleIcon;

export const DownloadIcon = DownloadBase;
export const FileDownloadIcon = DownloadBase;
export const DownloadForOfflineRoundedIcon = DownloadBase;
export const CloudDownload = hugeIcon(StrokeRounded.CloudDownloadIcon);
export const CloudUploadIcon = hugeIcon(StrokeRounded.CloudUploadIcon);
export const MdCloudUpload = CloudUploadIcon;
export const FileUploadRounded = UploadBase;
export const ImageIcon = hugeIcon(StrokeRounded.Image01Icon);
export const InsertPhotoIcon = ImageIcon;
export const ContentCopyIcon = hugeIcon(StrokeRounded.Copy01Icon);
export const ArchiveIcon = hugeIcon(StrokeRounded.Archive02Icon);
export const ArchiveOutlined = ArchiveIcon;
export const SaveIcon = hugeIcon(StrokeRounded.FloppyDiskIcon);

export const HomeIcon = hugeIcon(StrokeRounded.DashboardSquare01Icon);
export const AppsIcon = hugeIcon(StrokeRounded.GridViewIcon);
export const GridView = AppsIcon;
export const ViewList = hugeIcon(StrokeRounded.LayoutListIcon);
export const SignalCellularAltIcon = hugeIcon(StrokeRounded.ChartHistogramIcon);
export const InsightsRoundedIcon = hugeIcon(StrokeRounded.ChartIncreaseIcon);
export const TimelineRoundedIcon = hugeIcon(StrokeRounded.ChartLineData01Icon);
export const NotificationsIcon = NotificationBase;
export const NotificationsRounded = NotificationBase;
export const AdminPanelSettingsIcon = hugeIcon(StrokeRounded.SecurityCheckIcon);
export const Logout = hugeIcon(StrokeRounded.Logout01Icon);

export const SettingsIcon = SettingsBase;
export const MdSettings = SettingsBase;
export const LayersIcon = hugeIcon(StrokeRounded.Layers01Icon);
export const LinkIcon = hugeIcon(StrokeRounded.Link01Icon);
export const PaletteIcon = hugeIcon(StrokeRounded.PaletteIcon);
export const Category = hugeIcon(StrokeRounded.MenuSquareIcon);
export const ListAlt = hugeIcon(StrokeRounded.LeftToRightListBulletIcon);
export const NumbersIcon = hugeIcon(StrokeRounded.LeftToRightListNumberIcon);
export const TaskIcon = hugeIcon(StrokeRounded.Task01Icon);
export const TaskAltIcon = hugeIcon(StrokeRounded.TaskDone01Icon);
export const BeenhereIcon = hugeIcon(StrokeRounded.BadgeCheckIcon);
export const BlockIcon = hugeIcon(StrokeRounded.UnavailableIcon);
export const PauseCircleOutlineIcon = hugeIcon(StrokeRounded.PauseCircleIcon);
export const WarningAmberIcon = hugeIcon(StrokeRounded.Alert02Icon);
export const MdError = WarningAmberIcon;
export const FaExclamationCircle = WarningAmberIcon;
export const MdInfo = hugeIcon(StrokeRounded.InformationCircleIcon);
export const HelpOutlineIcon = hugeIcon(StrokeRounded.HelpCircleIcon);
export const SentimentVeryDissatisfiedIcon = hugeIcon(StrokeRounded.Sad01Icon);
export const ChangeCircleRounded = hugeIcon(StrokeRounded.Refresh01Icon);
export const FormatQuoteIcon = hugeIcon(StrokeRounded.QuoteIcon);
export const TitleIcon = hugeIcon(StrokeRounded.TextFontIcon);
export const ThumbUpIcon = hugeIcon(StrokeRounded.ThumbsUpIcon);
export const Star = hugeIcon(StrokeRounded.StarIcon);
export const FaStar = Star;
export const SendRounded = hugeIcon(StrokeRounded.SentIcon);
export const MicIcon = hugeIcon(StrokeRounded.Mic01Icon);
export const StopIcon = hugeIcon(StrokeRounded.StopIcon);

export const MdPool = hugeIcon(StrokeRounded.PoolIcon);
export const MdFitnessCenter = hugeIcon(StrokeRounded.Dumbbell01Icon);
export const MdWifi = hugeIcon(StrokeRounded.Wifi01Icon);
export const MdSpa = hugeIcon(StrokeRounded.WellnessIcon);
export const MdLocalParking = hugeIcon(StrokeRounded.ParkingAreaSquareIcon);
export const MdLocalOffer = hugeIcon(StrokeRounded.Tag01Icon);
export const MdPending = hugeIcon(StrokeRounded.Clock01Icon);

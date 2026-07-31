import {
  Badge,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Tab,
  Tabs,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import FilterListIcon from "@mui/icons-material/FilterList";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import {
  BOOKING_STATUSES,
  PAYMENT_STATUSES,
} from "../../utils/transportBooking";

const SelectFilter = ({ label, value, onChange, children }) => (
  <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 170 }, bgcolor: "white" }}>
    <InputLabel>{label}</InputLabel>
    <Select value={value} label={label} onChange={onChange}>{children}</Select>
  </FormControl>
);

const TransportBookingFilters = ({
  filters,
  onChange,
  onReset,
  counts,
  companies = [],
  providers = [],
  vehicleTypes = [],
}) => {
  const set = (field) => (event) => onChange({ ...filters, [field]: event.target.value });
  const hasFilters = filters.search || filters.bookingDateFrom || filters.bookingDateTo ||
    filters.travelDate || filters.paymentStatus !== "All" || filters.vehicleType !== "All" ||
    filters.company !== "All" || filters.provider !== "All";

  return (
    <>
      <div className="flex flex-col md:flex-row gap-4 justify-end items-center mb-6">
        <div className="relative w-full md:w-auto md:min-w-[360px]">
          <input
            type="text"
            placeholder="Search customer, phone, booking ID…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
            value={filters.search}
            onChange={set("search")}
          />
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 !text-xl" />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-neutral-200 p-5 mb-6 hover:shadow-xl transition-shadow duration-300">
        <div className="flex justify-between items-start gap-4 flex-wrap mb-4">
          <div>
            <h3 className="text-lg font-semibold text-primary-700 flex items-center gap-2">
              <FilterListIcon className="text-primary-600" /> Filter Bookings
            </h3>
            <p className="text-xs text-neutral-500 mt-1">Narrow results by booking date, travel date, payment, or assignment.</p>
          </div>
          {hasFilters && (
            <Button size="small" variant="outlined" color="inherit" startIcon={<RestartAltIcon />} onClick={onReset}>
              Reset filters
            </Button>
          )}
        </div>

        <div className="flex items-end gap-3 flex-wrap">
          <fieldset className="px-4 pb-2.5 border border-neutral-300 rounded-lg hover:border-primary-400 focus-within:border-primary-500 transition-colors duration-200 grow sm:grow-0">
            <legend className="px-2 text-sm font-medium text-neutral-600">
              <CalendarMonthIcon sx={{ fontSize: 16, marginRight: "4px" }} /> Booking From
            </legend>
            <input type="date" className="date-input w-full sm:w-[9rem] outline-none bg-transparent text-neutral-700" value={filters.bookingDateFrom} onChange={set("bookingDateFrom")} />
          </fieldset>
          <span className="hidden sm:inline text-neutral-400 font-medium pb-2.5 text-sm">to</span>
          <fieldset className="px-4 pb-2.5 border border-neutral-300 rounded-lg hover:border-primary-400 focus-within:border-primary-500 transition-colors duration-200 grow sm:grow-0">
            <legend className="px-2 text-sm font-medium text-neutral-600">
              <CalendarMonthIcon sx={{ fontSize: 16, marginRight: "4px" }} /> Booking To
            </legend>
            <input type="date" min={filters.bookingDateFrom} className="date-input w-full sm:w-[9rem] outline-none bg-transparent text-neutral-700" value={filters.bookingDateTo} onChange={set("bookingDateTo")} />
          </fieldset>
          <fieldset className="px-4 pb-2.5 border border-neutral-300 rounded-lg hover:border-primary-400 focus-within:border-primary-500 transition-colors duration-200 grow sm:grow-0">
            <legend className="px-2 text-sm font-medium text-neutral-600">
              <CalendarMonthIcon sx={{ fontSize: 16, marginRight: "4px" }} /> Travel Date
            </legend>
            <input type="date" className="date-input w-full sm:w-[9rem] outline-none bg-transparent text-neutral-700" value={filters.travelDate} onChange={set("travelDate")} />
          </fieldset>
          <SelectFilter label="Payment status" value={filters.paymentStatus} onChange={set("paymentStatus")}>
            {PAYMENT_STATUSES.map((status) => <MenuItem key={status} value={status}>{status}</MenuItem>)}
          </SelectFilter>
          <SelectFilter label="Vehicle type" value={filters.vehicleType} onChange={set("vehicleType")}>
            <MenuItem value="All">All vehicles</MenuItem>
            {vehicleTypes.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
          </SelectFilter>
          <SelectFilter label="Company" value={filters.company} onChange={set("company")}>
            <MenuItem value="All">All companies</MenuItem>
            {companies.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
          </SelectFilter>
          <SelectFilter label="Driver / provider" value={filters.provider} onChange={set("provider")}>
            <MenuItem value="All">All drivers / providers</MenuItem>
            {providers.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
          </SelectFilter>
        </div>
      </div>

      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2, bgcolor: "white", borderRadius: "12px 12px 0 0" }}>
        <Tabs
          value={filters.status}
          onChange={(_, value) => onChange({ ...filters, status: value })}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="booking status filters"
        >
          {BOOKING_STATUSES.map((status) => (
            <Tab
              key={status}
              value={status}
              label={
                <Badge badgeContent={counts[status] || 0} color={status === "Pending" ? "warning" : "primary"} max={999} sx={{ pr: 1.5 }}>
                  <span className="pr-2">{status}</span>
                </Badge>
              }
            />
          ))}
        </Tabs>
      </Box>
    </>
  );
};

export default TransportBookingFilters;

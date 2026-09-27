import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Tab,
  Tabs,
  TextField,
  Tooltip,
} from "@mui/material";
import { Add, ArchiveOutlined, DeleteIcon, DirectionsCar, EditOutlined, Groups, Search, VisibilityOutlined } from "@icons";
import { onSnapshot } from "firebase/firestore";
import PageHeading from "../../../../../components/PageHeading";
import {
  transportCompaniesCollection,
  transportDriversCollection,
  transportVehiclesCollection,
} from "../../../../../firebase/firebase.config";
import {
  archiveTransportResource,
  deleteTransportResource,
  getWorkflowError,
  saveTransportResource,
} from "../../../../../services/TransportWorkflow";
import ResourceFormDialog from "./ResourceFormDialog";

const tabTypes = ["company", "driver", "vehicle"];
const plural = { company: "Companies", driver: "Drivers", vehicle: "Vehicles" };

const summaryColors = {
  primary: "bg-primary-50 text-primary-600",
  success: "bg-success-50 text-success-600",
  warning: "bg-warning-50 text-warning-600",
};

const SummaryCard = ({ label, value, color = "primary", icon }) => (
  <div className="bg-white rounded-xl border border-neutral-200 shadow-sm p-5 flex items-center justify-between">
    <div><p className="text-sm text-neutral-500">{label}</p><p className={`text-3xl font-bold mt-1 ${summaryColors[color].split(" ")[1]}`}>{value}</p></div>
    <div className={`p-3 rounded-xl ${summaryColors[color]}`}>{icon}</div>
  </div>
);

const TransportManagement = () => {
  const [tab, setTab] = useState(0);
  const [companies, setCompanies] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [search, setSearch] = useState("");
  const [availability, setAvailability] = useState("All");
  const [activeFilter, setActiveFilter] = useState("All");
  const [companyType, setCompanyType] = useState("All");
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const subscriptions = [
      onSnapshot(transportCompaniesCollection, (snapshot) => {
        setCompanies(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })).filter((record) => record.isDemo !== true));
      }),
      onSnapshot(transportDriversCollection, (snapshot) => {
        setDrivers(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })).filter((record) => record.isDemo !== true));
      }),
      onSnapshot(transportVehiclesCollection, (snapshot) => {
        setVehicles(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })).filter((record) => record.isDemo !== true));
      }),
    ];
    return () => subscriptions.forEach((unsubscribe) => unsubscribe());
  }, []);

  const type = tabTypes[tab];
  const records = type === "company" ? companies : type === "driver" ? drivers : vehicles;
  const filtered = useMemo(() => records.filter((record) => {
    const term = search.trim().toLowerCase();
    const haystack = [record.companyName, record.driverName, record.vehicleName, record.phone, record.registrationNumber]
      .filter(Boolean).join(" ").toLowerCase();
    return (!term || haystack.includes(term)) &&
      (activeFilter === "All" || (activeFilter === "Active") === (record.active !== false)) &&
      (availability === "All" || record.availabilityStatus === availability) &&
      (companyType === "All" || record.companyType === companyType);
  }), [records, search, activeFilter, availability, companyType]);

  const openForm = (record = null) => {
    setSelected(record);
    setError("");
    setFormOpen(true);
  };
  const save = async (values) => {
    setBusy(true);
    setError("");
    try {
      await saveTransportResource(type, values, selected?.id);
      setSuccess(`${type[0].toUpperCase()}${type.slice(1)} saved successfully.`);
      setFormOpen(false);
    } catch (saveError) {
      setError(getWorkflowError(saveError));
    } finally {
      setBusy(false);
    }
  };
  const archive = async (record) => {
    if (!window.confirm(`Deactivate ${record.companyName || record.driverName || record.vehicleName}? Existing bookings will keep their snapshots.`)) return;
    setBusy(true);
    try {
      await archiveTransportResource(type, record.id);
      setSuccess("Record deactivated. It remains available to historical bookings.");
    } catch (archiveError) {
      setError(getWorkflowError(archiveError));
    } finally {
      setBusy(false);
    }
  };
  const remove = async (record) => {
    const name = record.companyName || record.driverName || record.vehicleName;
    if (!window.confirm(`Permanently delete ${name}? This cannot be undone. Historical booking snapshots will remain.`)) return;
    setBusy(true);
    setError("");
    try {
      await deleteTransportResource(type, record.id);
      setSuccess(`${type[0].toUpperCase()}${type.slice(1)} deleted permanently.`);
    } catch (deleteError) {
      setError(getWorkflowError(deleteError));
    } finally {
      setBusy(false);
    }
  };
  const companyName = (id) => companies.find((company) => company.id === id)?.companyName || "—";
  const vehicleName = (id) => vehicles.find((vehicle) => vehicle.id === id)?.vehicleName || "Not assigned";
  const displayFields = (record) => type === "company"
    ? [["Company", record.companyName], ["Type", record.companyType], ["Contact", record.contactPerson], ["Phone", record.phone], ["Email", record.email], ["Commission", `${record.defaultCommissionPercentage || 0}%`]]
    : type === "driver"
      ? [["Driver", record.driverName], ["Company", companyName(record.companyId)], ["Assigned car", vehicleName(record.assignedVehicleId)], ["Phone", record.phone], ["Licence", record.licenceNumber], ["Availability", record.availabilityStatus]]
      : [["Vehicle", record.vehicleName], ["Company", companyName(record.companyId)], ["Type", record.vehicleType], ["Registration", record.registrationNumber], ["Capacity", record.seatingCapacity], ["Availability", record.availabilityStatus]];
  const viewFields = (record) => Object.entries(record || {})
    .filter(([key, value]) => !["id", "createdAt", "updatedAt", "updatedBy", "archivedAt", "archivedBy"].includes(key) && ["string", "number", "boolean"].includes(typeof value))
    .map(([key, value]) => [
      key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase()),
      key === "companyId" ? companyName(value) : key === "assignedVehicleId" ? vehicleName(value) : value,
      key.toLowerCase().endsWith("url"),
    ]);

  return (
    <div className="animate-fade-in">
      <PageHeading text="Taxi & Van Management" subtitle="Manage transport companies, their drivers, and vehicles" icon="🚐" />
      {success && <Alert severity="success" onClose={() => setSuccess("")} sx={{ mb: 2 }}>{success}</Alert>}
      {error && !formOpen && <Alert severity="error" onClose={() => setError("")} sx={{ mb: 2 }}>{error}</Alert>}
      <div className="bg-white border rounded-xl shadow-sm mb-5">
        <Tabs value={tab} onChange={(_, value) => { setTab(value); setSearch(""); }} variant="scrollable" scrollButtons="auto">
          <Tab label="Companies" />
          <Tab label="Drivers" />
          <Tab label="Vehicles" />
        </Tabs>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {type === "company" && <>
          <SummaryCard label="Total companies" value={companies.length} icon={<Groups />} />
          <SummaryCard label="Active companies" value={companies.filter((item) => item.active !== false).length} color="success" icon={<Groups />} />
          <SummaryCard label="Taxi companies" value={companies.filter((item) => item.companyType?.includes("Taxi")).length} icon={<DirectionsCar />} />
          <SummaryCard label="Van companies" value={companies.filter((item) => item.companyType?.includes("Van")).length} color="warning" icon={<DirectionsCar />} />
        </>}
        {type === "driver" && <>
          <SummaryCard label="Total drivers" value={drivers.length} icon={<Groups />} />
          <SummaryCard label="Active drivers" value={drivers.filter((item) => item.active !== false).length} color="success" icon={<Groups />} />
          <SummaryCard label="Available drivers" value={drivers.filter((item) => item.active !== false && item.availabilityStatus === "Available").length} color="success" icon={<Groups />} />
          <SummaryCard label="Assigned cars" value={drivers.filter((item) => item.assignedVehicleId).length} icon={<DirectionsCar />} />
        </>}
        {type === "vehicle" && <>
          <SummaryCard label="Total vehicles" value={vehicles.length} icon={<DirectionsCar />} />
          <SummaryCard label="Active vehicles" value={vehicles.filter((item) => item.active !== false).length} color="success" icon={<DirectionsCar />} />
          <SummaryCard label="Available vehicles" value={vehicles.filter((item) => item.active !== false && item.availabilityStatus === "Available").length} color="success" icon={<DirectionsCar />} />
          <SummaryCard label="Vehicles on trip" value={vehicles.filter((item) => item.availabilityStatus === "On Trip").length} color="warning" icon={<DirectionsCar />} />
        </>}
      </div>
      <>
          <div className="bg-white border rounded-xl shadow-sm p-4 mb-4 flex flex-wrap gap-3">
            <TextField size="small" placeholder={`Search ${plural[type].toLowerCase()}…`} value={search} onChange={(event) => setSearch(event.target.value)} InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }} sx={{ flexGrow: 1, minWidth: 240 }} />
            {type === "company" && <FormControl size="small" sx={{ minWidth: 190 }}><InputLabel>Company type</InputLabel><Select value={companyType} label="Company type" onChange={(event) => setCompanyType(event.target.value)}><MenuItem value="All">All types</MenuItem>{["Taxi Company", "Van Company", "Freelancing"].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</Select></FormControl>}
            {type !== "company" && <FormControl size="small" sx={{ minWidth: 160 }}><InputLabel>Availability</InputLabel><Select value={availability} label="Availability" onChange={(event) => setAvailability(event.target.value)}><MenuItem value="All">All</MenuItem>{["Available", "Assigned", "On Trip", "Unavailable", "Inactive"].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</Select></FormControl>}
            <FormControl size="small" sx={{ minWidth: 140 }}><InputLabel>Status</InputLabel><Select value={activeFilter} label="Status" onChange={(event) => setActiveFilter(event.target.value)}>{["All", "Active", "Inactive"].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</Select></FormControl>
            <Button variant="contained" startIcon={<Add />} onClick={() => openForm()}>Add {type}</Button>
          </div>
          <div className="bg-white border rounded-xl shadow-sm overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead className="bg-gradient-to-r from-primary-500 to-primary-600 text-white"><tr>{displayFields({}).map(([label]) => <th key={label} className="px-4 py-3 text-left text-xs uppercase">{label}</th>)}<th className="px-4 py-3 text-left text-xs uppercase">Status</th><th className="px-4 py-3 text-left text-xs uppercase">Actions</th></tr></thead>
              <tbody className="divide-y">
                {filtered.map((record) => <tr key={record.id} className="hover:bg-primary-50/50">{displayFields(record).map(([label, value]) => <td key={label} className="px-4 py-3 text-sm">{value || "—"}</td>)}<td className="px-4 py-3"><Chip size="small" color={record.active !== false ? "success" : "default"} label={record.active !== false ? "Active" : "Inactive"} /></td><td className="px-4 py-3 whitespace-nowrap"><Tooltip title="View"><IconButton size="small" onClick={() => setViewing(record)}><VisibilityOutlined fontSize="small" /></IconButton></Tooltip><Tooltip title="Edit"><IconButton size="small" onClick={() => openForm(record)}><EditOutlined fontSize="small" /></IconButton></Tooltip>{record.active !== false && <Tooltip title="Deactivate"><IconButton disabled={busy} color="warning" size="small" onClick={() => archive(record)}><ArchiveOutlined fontSize="small" /></IconButton></Tooltip>}<Tooltip title="Delete permanently"><IconButton disabled={busy} color="error" size="small" onClick={() => remove(record)}><DeleteIcon fontSize="small" /></IconButton></Tooltip></td></tr>)}
                {!filtered.length && <tr><td colSpan={8} className="text-center py-14 text-neutral-500">No matching {plural[type].toLowerCase()} found.</td></tr>}
              </tbody>
            </table>
          </div>
      </>

      <ResourceFormDialog open={formOpen} type={type} record={selected} companies={companies.filter((company) => company.active !== false)} vehicles={vehicles} busy={busy} error={error} onClose={() => setFormOpen(false)} onSave={save} />
      <Dialog open={Boolean(viewing)} onClose={() => setViewing(null)} maxWidth="md" fullWidth><DialogTitle>Details</DialogTitle><DialogContent dividers><div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{viewFields(viewing).map(([label, value, isUrl]) => <div key={label}><p className="text-xs uppercase text-neutral-500">{label}</p>{isUrl && value ? <a className="font-medium text-primary-600 underline break-all" href={value} target="_blank" rel="noreferrer">Open document</a> : <p className="font-medium break-words">{typeof value === "boolean" ? (value ? "Yes" : "No") : value || "—"}</p>}</div>)}</div></DialogContent><DialogActions><Button onClick={() => setViewing(null)}>Close</Button></DialogActions></Dialog>
    </div>
  );
};

export default TransportManagement;

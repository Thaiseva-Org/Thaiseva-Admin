import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from "@mui/material";
import { onSnapshot, query, where } from "firebase/firestore";
import {
  transportCompaniesCollection,
  transportDriversCollection,
  transportVehiclesCollection,
} from "../../firebase/firebase.config";
import {
  DEMO_TRANSPORT_COMPANIES,
  DEMO_TRANSPORT_DRIVERS,
  DEMO_TRANSPORT_VEHICLES,
} from "../../data/transportDemoData";

const CUSTOM_ID = "__custom__";

const baseForm = {
  companyId: "",
  driverId: "",
  vehicleId: "",
  finalAmount: "",
  commissionPercentage: "",
  travelAt: "",
  durationHours: 6,
  providerName: "",
  providerPhone: "",
  vehicleName: "",
  registrationNumber: "",
  handoverName: "",
  handoverPhone: "",
  pickupLocation: "",
  customCompanyName: "",
  customCompanyPhone: "",
  customDriverName: "",
  customDriverPhone: "",
  customVehicleName: "",
  customVehicleType: "",
  customRegistrationNumber: "",
};

const AssignmentDialog = ({ open, booking, kind, edit = false, busy, error, onClose, onSubmit }) => {
  const [form, setForm] = useState(baseForm);
  const [companies, setCompanies] = useState(DEMO_TRANSPORT_COMPANIES);
  const [drivers, setDrivers] = useState(DEMO_TRANSPORT_DRIVERS);
  const [vehicles, setVehicles] = useState(DEMO_TRANSPORT_VEHICLES);

  useEffect(() => {
    if (!open) return undefined;
    setForm({
      ...baseForm,
      companyId: booking?.companyId || (kind !== "selfDrive" && booking?.companySnapshot ? CUSTOM_ID : ""),
      driverId: booking?.driverId || (kind !== "selfDrive" && booking?.driverSnapshot ? CUSTOM_ID : ""),
      vehicleId: booking?.vehicleId || (booking?.vehicleSnapshot ? CUSTOM_ID : ""),
      finalAmount: booking?.finalAmount || "",
      commissionPercentage: booking?.commissionPercentage ?? booking?.comission ?? "",
      providerName: booking?.providerSnapshot?.name || booking?.Provider?.name || "",
      providerPhone: booking?.providerSnapshot?.phone || booking?.Provider?.phone || "",
      vehicleName: booking?.vehicleSnapshot?.name || booking?.vehicleDetails?.vehicle || "",
      registrationNumber: booking?.vehicleSnapshot?.registrationNumber || booking?.vehicleDetails?.vehicleNumber || "",
      handoverName: booking?.handoverSnapshot?.name || booking?.dropDetails?.name || "",
      handoverPhone: booking?.handoverSnapshot?.phone || booking?.dropDetails?.phone || "",
      pickupLocation: booking?.PickUpLocation || booking?.pickupLocation || "",
      customCompanyName: booking?.companyId ? "" : booking?.companySnapshot?.name || "",
      customCompanyPhone: booking?.companyId ? "" : booking?.companySnapshot?.phone || "",
      customDriverName: booking?.driverId ? "" : booking?.driverSnapshot?.name || booking?.Driver?.name || "",
      customDriverPhone: booking?.driverId ? "" : booking?.driverSnapshot?.phone || booking?.Driver?.phone || "",
      customVehicleName: booking?.vehicleId ? "" : booking?.vehicleSnapshot?.name || booking?.vehicleDetails?.vehicle || "",
      customVehicleType: booking?.vehicleId ? "" : booking?.vehicleSnapshot?.vehicleType || kind,
      customRegistrationNumber: booking?.vehicleId ? "" : booking?.vehicleSnapshot?.registrationNumber || booking?.vehicleDetails?.vehicleNumber || "",
    });
    const unsubs = [
      onSnapshot(query(transportCompaniesCollection, where("active", "==", true)), (snap) => {
        const records = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setCompanies(records.length ? records : DEMO_TRANSPORT_COMPANIES);
      }),
      onSnapshot(query(transportDriversCollection, where("active", "==", true)), (snap) => {
        const records = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setDrivers(records.length ? records : DEMO_TRANSPORT_DRIVERS);
      }),
      onSnapshot(query(transportVehiclesCollection, where("active", "==", true)), (snap) => {
        const records = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setVehicles(records.length ? records : DEMO_TRANSPORT_VEHICLES);
      }),
    ];
    return () => unsubs.forEach((unsubscribe) => unsubscribe());
  }, [open, booking, kind]);

  const eligibleCompanies = useMemo(() => companies.filter((company) => {
    const type = company.companyType;
    // Car bookings accept taxi, van, and mixed companies
    return ["Taxi Company", "Van Company", "Taxi and Van Company"].includes(type);
  }), [companies]);
  const eligibleDrivers = drivers.filter((driver) =>
    driver.companyId === form.companyId && ["Available", "Assigned"].includes(driver.availabilityStatus || "Available"));
  const eligibleVehicles = vehicles.filter((vehicle) =>
    vehicle.companyId === form.companyId &&
    ["Available", "Assigned"].includes(vehicle.availabilityStatus || "Available"));
  const selfDriveVehicles = vehicles.filter((vehicle) => vehicle.active !== false);
  const selectedCompany = companies.find((company) => company.id === form.companyId);

  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  const validMoney = Number(form.finalAmount) > 0 && Number(form.commissionPercentage) >= 0 && Number(form.commissionPercentage) <= 100;
  const documentsVerified = booking?.licenceVerificationStatus === "Verified" && booking?.passportVerificationStatus === "Verified";
  const assignmentValid = kind === "selfDrive"
    ? form.vehicleId && form.providerName && form.providerPhone && form.vehicleName && form.registrationNumber && form.handoverName && form.handoverPhone && form.pickupLocation && documentsVerified
    : form.companyId && form.driverId && form.vehicleId &&
      (form.companyId !== CUSTOM_ID || (form.customCompanyName && form.customCompanyPhone)) &&
      (form.driverId !== CUSTOM_ID || (form.customDriverName && form.customDriverPhone)) &&
      (form.vehicleId !== CUSTOM_ID || (form.customVehicleName && form.customRegistrationNumber)) &&
      (edit || form.travelAt);

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>{edit ? "Edit assignment" : "Accept booking"}</DialogTitle>
      <DialogContent dividers>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {error && <Alert severity="error" sx={{ gridColumn: "1 / -1" }}>{error}</Alert>}
          {kind === "selfDrive" ? (
            <>
              {!documentsVerified && <Alert severity="warning" sx={{ gridColumn: "1 / -1" }}>Verify both the driving licence and passport from the booking details before acceptance.</Alert>}
              <FormControl required fullWidth sx={{ gridColumn: { md: "1 / -1" } }}>
                <InputLabel>Managed self-drive vehicle</InputLabel>
                <Select
                  value={form.vehicleId}
                  label="Managed self-drive vehicle"
                  onChange={(event) => {
                    const vehicle = vehicles.find((item) => item.id === event.target.value);
                    const company = companies.find((item) => item.id === vehicle?.companyId);
                    setForm((current) => ({
                      ...current,
                      vehicleId: event.target.value,
                      companyId: vehicle?.companyId || "",
                      providerName: company?.companyName || "",
                      providerPhone: company?.phone || "",
                      vehicleName: vehicle?.vehicleName || "",
                      registrationNumber: vehicle?.registrationNumber || "",
                    }));
                  }}
                >
                  {selfDriveVehicles.map((vehicle) => {
                    const company = companies.find((item) => item.id === vehicle.companyId);
                    const availability = vehicle.availabilityStatus || "Available";
                    return <MenuItem key={vehicle.id} value={vehicle.id} disabled={!['Available', 'Assigned'].includes(availability)}>{vehicle.vehicleName} · {vehicle.registrationNumber} · {company?.companyName || "No company"} · {availability}</MenuItem>;
                  })}
                  <MenuItem value={CUSTOM_ID}>Custom / unregistered vehicle</MenuItem>
                </Select>
              </FormControl>
              <TextField required label="Vehicle provider" value={form.providerName} onChange={set("providerName")} InputProps={{ readOnly: form.vehicleId !== CUSTOM_ID }} />
              <TextField required label="Provider phone" value={form.providerPhone} onChange={set("providerPhone")} InputProps={{ readOnly: form.vehicleId !== CUSTOM_ID }} />
              <TextField required label="Vehicle name" value={form.vehicleName} onChange={set("vehicleName")} InputProps={{ readOnly: form.vehicleId !== CUSTOM_ID }} />
              <TextField required label="Registration number" value={form.registrationNumber} onChange={set("registrationNumber")} InputProps={{ readOnly: form.vehicleId !== CUSTOM_ID }} />
              <TextField required label="Handover person" value={form.handoverName} onChange={set("handoverName")} />
              <TextField required label="Handover phone" value={form.handoverPhone} onChange={set("handoverPhone")} />
              <TextField required label="Physical pickup location" value={form.pickupLocation} onChange={set("pickupLocation")} sx={{ gridColumn: { md: "1 / -1" } }} />
            </>
          ) : (
            <>
              <FormControl required fullWidth>
                <InputLabel>Company</InputLabel>
                <Select
                  value={form.companyId}
                  label="Company"
                  onChange={(event) => setForm({
                    ...form,
                    companyId: event.target.value,
                    driverId: event.target.value === CUSTOM_ID ? CUSTOM_ID : "",
                    vehicleId: event.target.value === CUSTOM_ID ? CUSTOM_ID : "",
                    commissionPercentage: companies.find((item) => item.id === event.target.value)?.defaultCommissionPercentage ?? form.commissionPercentage,
                  })}
                >
                  {eligibleCompanies.map((company) => <MenuItem key={company.id} value={company.id}>{company.companyName}</MenuItem>)}
                  <MenuItem value={CUSTOM_ID}>Custom / unregistered company</MenuItem>
                </Select>
              </FormControl>
              {form.companyId === CUSTOM_ID && <>
                <TextField required label="Custom company name" value={form.customCompanyName} onChange={set("customCompanyName")} />
                <TextField required label="Custom company phone" value={form.customCompanyPhone} onChange={set("customCompanyPhone")} />
              </>}
              <FormControl required fullWidth disabled={!form.companyId}>
                <InputLabel>Driver</InputLabel>
                <Select
                  value={form.driverId}
                  label="Driver"
                  onChange={(event) => {
                    const driver = drivers.find((item) => item.id === event.target.value);
                    setForm((current) => ({
                      ...current,
                      driverId: event.target.value,
                      vehicleId: eligibleVehicles.some((vehicle) => vehicle.id === driver?.assignedVehicleId)
                        ? driver.assignedVehicleId
                        : current.vehicleId,
                    }));
                  }}
                >
                  <MenuItem value={CUSTOM_ID}>Custom / unregistered driver</MenuItem>
                  {eligibleDrivers.map((driver) => <MenuItem key={driver.id} value={driver.id}>{driver.driverName} · {driver.phone}</MenuItem>)}
                </Select>
              </FormControl>
              {form.driverId === CUSTOM_ID && <>
                <TextField required label="Custom driver name" value={form.customDriverName} onChange={set("customDriverName")} />
                <TextField required label="Custom driver phone" value={form.customDriverPhone} onChange={set("customDriverPhone")} />
              </>}
              <FormControl required fullWidth disabled={!form.companyId}>
                <InputLabel>Vehicle</InputLabel>
                <Select value={form.vehicleId} label="Vehicle" onChange={set("vehicleId")}>
                  <MenuItem value={CUSTOM_ID}>Custom / unregistered vehicle</MenuItem>
                  {eligibleVehicles.map((vehicle) => <MenuItem key={vehicle.id} value={vehicle.id}>{vehicle.vehicleName} · {vehicle.registrationNumber}</MenuItem>)}
                </Select>
              </FormControl>
              {form.vehicleId === CUSTOM_ID && <>
                <TextField required label="Custom vehicle name" value={form.customVehicleName} onChange={set("customVehicleName")} />
                <TextField label="Custom vehicle type" value={form.customVehicleType} onChange={set("customVehicleType")} />
                <TextField required label="Custom registration number" value={form.customRegistrationNumber} onChange={set("customRegistrationNumber")} />
              </>}
              <TextField
                required={!edit}
                type="datetime-local"
                label="Travel date and time"
                value={form.travelAt}
                onChange={set("travelAt")}
                InputLabelProps={{ shrink: true }}
                helperText="If no trip end is supplied, a 6-hour duration is used for conflict checks."
              />
              <TextField type="number" label="Assumed duration (hours)" value={form.durationHours} onChange={set("durationHours")} inputProps={{ min: 1, max: 168 }} />
              {selectedCompany && <Alert severity="info">Default commission: {selectedCompany.defaultCommissionPercentage || 0}%</Alert>}
            </>
          )}
          <TextField required type="number" label="Final amount (THB)" value={form.finalAmount} onChange={set("finalAmount")} inputProps={{ min: 0, step: 0.01 }} />
          <TextField required type="number" label="Commission percentage" value={form.commissionPercentage} onChange={set("commissionPercentage")} inputProps={{ min: 0, max: 100, step: 0.01 }} />
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Close</Button>
        <Button variant="contained" disabled={busy || !assignmentValid || !validMoney} onClick={() => onSubmit(form)}>
          {busy ? "Checking availability…" : edit ? "Save assignment" : "Accept / confirm"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AssignmentDialog;

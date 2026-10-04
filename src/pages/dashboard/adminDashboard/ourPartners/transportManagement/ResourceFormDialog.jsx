/**
 * @file ResourceFormDialog.jsx
 * @description Dynamic modal form supporting polymorphic schema-driven CRUD for transport resources.
 *
 * Architecture & Features:
 * - Dynamic form schemas for three distinct transport entities (`company`, `driver`, `vehicle`)
 * - Contextual entity associations: filters vehicles to match driver's parent company
 * - Direct cloud document upload via {@link DragDropImageUploader} to `transport_documents`
 * - International telephone formatting and validation via {@link CountryPhoneInput}
 * - Numeric boundaries and constraint validation (e.g. commission 0-100%, seating capacity min 1)
 *
 * @module AdminDashboard/OurPartners/TransportManagement/ResourceFormDialog
 */

import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from "@mui/material";
import DragDropImageUploader from "../../../../../components/websiteConfig/DragDropImageUploader";
import CountryPhoneInput from "../../../../../components/CountryPhoneInput";

const defaults = {
  company: {
    companyName: "",
    companyType: "Taxi Company",
    contactPerson: "",
    phone: "",
    email: "",
    address: "",
    defaultCommissionPercentage: 0,
    notes: "",
    active: true,
  },
  driver: {
    companyId: "",
    assignedVehicleId: "",
    driverName: "",
    phone: "",
    licenceNumber: "",
    licenceExpiryDate: "",
    idProofUrl: "",
    address: "",
    notes: "",
    availabilityStatus: "Available",
    active: true,
  },
  vehicle: {
    companyId: "",
    vehicleName: "",
    vehicleType: "Taxi",
    brand: "",
    model: "",
    registrationNumber: "",
    seatingCapacity: "",
    fuelType: "Petrol",
    insuranceExpiryDate: "",
    permitExpiryDate: "",
    documentUrl: "",
    notes: "",
    availabilityStatus: "Available",
    active: true,
  },
};

const fields = {
  company: [
    ["companyName", "Company name", "text", true],
    ["companyType", "Company type", "select", true, ["Taxi Company", "Van Company", "Freelancing"]],
    ["contactPerson", "Contact person"],
    ["phone", "Phone number", "tel", true],
    ["email", "Email", "email"],
    ["address", "Address", "multiline"],
    ["defaultCommissionPercentage", "Default commission %", "number"],
    ["notes", "Notes", "multiline"],
  ],
  driver: [
    ["companyId", "Company", "company", true],
    ["assignedVehicleId", "Assigned car / vehicle", "vehicle"],
    ["driverName", "Driver name", "text", true],
    ["phone", "Phone number", "tel", true],
    ["licenceNumber", "Driving licence number", "text", true],
    ["licenceExpiryDate", "Licence expiry date", "date"],
    ["idProofUrl", "ID proof / document URL", "url"],
    ["address", "Address", "multiline"],
    ["availabilityStatus", "Availability", "select", true, ["Available", "Assigned", "On Trip", "Unavailable", "Inactive"]],
    ["notes", "Notes", "multiline"],
  ],
  vehicle: [
    ["companyId", "Company", "company", true],
    ["vehicleName", "Vehicle name", "text", true],
    ["vehicleType", "Vehicle type", "select", true, ["Taxi", "SUV Taxi", "Van", "Luxury Van", "Minivan"]],
    ["brand", "Brand"],
    ["model", "Model"],
    ["registrationNumber", "Registration number", "text", true],
    ["seatingCapacity", "Seating capacity", "number"],
    ["fuelType", "Fuel type", "select", false, ["Petrol", "Diesel", "Electric", "Hybrid", "CNG", "Other"]],
    ["insuranceExpiryDate", "Insurance expiry date", "date"],
    ["permitExpiryDate", "Permit expiry date", "date"],
    ["documentUrl", "Vehicle documents URL", "url"],
    ["availabilityStatus", "Availability", "select", true, ["Available", "Assigned", "On Trip", "Unavailable", "Inactive"]],
    ["notes", "Notes", "multiline"],
  ],
};

/**
 * ResourceFormDialog Component.
 *
 * Modal dialog rendering polymorphic input controls tailored to the active
 * transport resource type (`company`, `driver`, or `vehicle`).
 */
const ResourceFormDialog = ({ open, type, record, companies, vehicles = [], busy, error, onClose, onSave }) => {
  const [form, setForm] = useState(defaults[type]);
  useEffect(() => {
    if (open) setForm({ ...defaults[type], ...(record || {}) });
  }, [open, type, record]);

  /**
   * Curried input change handler updating a specific form attribute.
   *
   * @param {string} name - Form field identifier.
   * @returns {function(React.ChangeEvent): void} Event callback.
   */
  const set = (name) => (event) => setForm({ ...form, [name]: event.target.value });

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>{record ? "Edit" : "Add"} {type}</DialogTitle>
      <DialogContent dividers>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {error && <Alert severity="error" sx={{ gridColumn: "1 / -1" }}>{error}</Alert>}
          {fields[type].map(([name, label, inputType = "text", required = false, options = []]) => {
            if (["select", "company", "vehicle"].includes(inputType)) {
              const values = inputType === "company"
                ? companies.map((company) => [company.id, company.companyName])
                : inputType === "vehicle"
                  ? vehicles
                    .filter((vehicle) => vehicle.active !== false &&
                      vehicle.companyId === form.companyId &&
                      (!vehicle.assignedDriverId || vehicle.assignedDriverId === record?.id))
                    .map((vehicle) => [vehicle.id, `${vehicle.vehicleName} · ${vehicle.registrationNumber}`])
                  : options.map((option) => [option, option]);
              return (
                <FormControl key={name} required={required} fullWidth>
                  <InputLabel>{label}</InputLabel>
                  <Select
                    value={form[name] || ""}
                    label={label}
                    onChange={(event) => setForm((current) => ({
                      ...current,
                      [name]: event.target.value,
                      ...(inputType === "company" && type === "driver" ? { assignedVehicleId: "" } : {}),
                    }))}
                  >
                    {inputType === "vehicle" && <MenuItem value="">No vehicle assigned</MenuItem>}
                    {values.map(([value, text]) => <MenuItem key={value} value={value}>{text}</MenuItem>)}
                  </Select>
                </FormControl>
              );
            }
            if (inputType === "url") {
              return (
                <div key={name} className="md:col-span-1">
                  <DragDropImageUploader
                    label={label}
                    image={form[name] || ""}
                    onImageChange={(url) => setForm((current) => ({ ...current, [name]: url }))}
                    folder="transport_documents"
                    height={150}
                  />
                </div>
              );
            }
            if (inputType === "tel") {
              return (
                <CountryPhoneInput
                  key={name}
                  name={name}
                  required={required}
                  label={label}
                  value={form[name] ?? ""}
                  onChange={set(name)}
                />
              );
            }
            return (
              <TextField
                key={name}
                required={required}
                fullWidth
                label={label}
                type={inputType === "multiline" ? "text" : inputType}
                value={form[name] ?? ""}
                onChange={set(name)}
                multiline={inputType === "multiline"}
                minRows={inputType === "multiline" ? 2 : undefined}
                InputLabelProps={inputType === "date" ? { shrink: true } : undefined}
                inputProps={name === "defaultCommissionPercentage" ? { min: 0, max: 100 } : name === "seatingCapacity" ? { min: 1 } : undefined}
                sx={inputType === "multiline" ? { gridColumn: { md: "1 / -1" } } : undefined}
              />
            );
          })}
          <FormControlLabel control={<Checkbox checked={form.active !== false} onChange={(event) => setForm({ ...form, active: event.target.checked })} />} label="Active" />
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Close</Button>
        <Button variant="contained" disabled={busy} onClick={() => onSave(form)}>{busy ? "Saving…" : "Save"}</Button>
      </DialogActions>
    </Dialog>
  );
};

ResourceFormDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  type: PropTypes.oneOf(["company", "driver", "vehicle"]).isRequired,
  record: PropTypes.object,
  companies: PropTypes.arrayOf(PropTypes.object).isRequired,
  vehicles: PropTypes.arrayOf(PropTypes.object),
  busy: PropTypes.bool,
  error: PropTypes.string,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
};

export default ResourceFormDialog;


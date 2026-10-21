import {assertActiveAccount} from "./activeAccount";
/* eslint-disable max-len */
import {getFirestore, FieldValue, Timestamp} from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import {HttpsError, onCall} from "firebase-functions/v2/https";

type Data = Record<string, unknown>;
type BookingKind = "taxi" | "van" | "selfDrive";

const REGION = "asia-east2";
const DEFAULT_TRIP_HOURS = 6;
const BOOKING_COLLECTIONS: Record<BookingKind, string> = {
  taxi: "car_bookings",
  // van is no longer a separate product; keep key for legacy admin calls → car_bookings
  van: "car_bookings",
  selfDrive: "self_driving_bookings",
};
const VALID_METHODS = new Set([
  "Cash", "UPI", "Card", "Bank Transfer", "Payment Link", "Other",
]);
const VALID_DOCUMENT_STATUSES = new Set(["Pending", "Verified", "Rejected"]);
const VALID_TRANSITIONS: Record<string, Set<string>> = {
  Pending: new Set(["Accepted", "Confirmed", "Rejected", "Canceled"]),
  Accepted: new Set(["Completed", "Canceled"]),
  Confirmed: new Set(["Completed", "Canceled"]),
  Completed: new Set(),
  Rejected: new Set(),
  Canceled: new Set(),
};

const stringValue = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const personValue = (...values: unknown[]): string => {
  for (const value of values) {
    const normalized = stringValue(value);
    if (normalized && !/^(?:n\/?a|not assigned|[-\u2014])$/i.test(normalized)) {
      return normalized;
    }
  }
  return "";
};

const hasSelfDriveDocuments = (booking: Data): boolean => Boolean(
  stringValue(
    booking.licenceLink || booking.licenseLink ||
    booking.drivingLicenceLink || booking.drivingLicenseLink ||
    booking.licenceUrl || booking.licenseUrl ||
    booking.drivingLicenceUrl || booking.drivingLicenseUrl ||
    booking.licence || booking.license,
  ) && stringValue(
    booking.passportLink || booking.passportDocumentLink ||
    booking.passportUrl || booking.passportDocumentUrl ||
    booking.passport || booking.passportImage,
  ),
);

// Values such as __na__ and __custom__ are UI selection sentinels, not
// Firestore document IDs. Older bookings may still contain those values, so
// sanitize both incoming assignments and persisted legacy fields before
// constructing a DocumentReference.
const managedResourceId = (value: unknown): string => {
  const id = stringValue(value);
  return /^__.*__$/.test(id) ? "" : id;
};

const numberValue = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeStatus = (data: Data): string => {
  const raw = stringValue(data.bookingStatus || data.status).toLowerCase();
  if (["accepted", "confirmed", "completed", "done"].includes(raw)) {
    if (raw === "confirmed") return "Confirmed";
    if (["completed", "done"].includes(raw)) return "Completed";
    return "Accepted";
  }
  if (["rejected", "denied"].includes(raw)) return "Rejected";
  if (["canceled", "cancelled"].includes(raw)) return "Canceled";
  return "Pending";
};

const collectionFor = (kind: BookingKind, _source: string): string =>
  BOOKING_COLLECTIONS[kind];

const legacyStatus = (kind: BookingKind, status: string): string => {
  if (status === "Confirmed") return kind === "van" ? "Confirmed" : "Accepted";
  return status;
};

const bookingAmount = (data: Data): number => Math.max(0, numberValue(
  data.finalAmount ?? data.AmountOffered ?? data.price ?? data.amount ??
  data.totalAmount,
));

const asTimestamp = (value: unknown): Timestamp | null => {
  if (value instanceof Timestamp) return value;
  if (value && typeof value === "object" && "seconds" in value) {
    const seconds = numberValue((value as Data).seconds, NaN);
    if (Number.isFinite(seconds)) return Timestamp.fromMillis(seconds * 1000);
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return Timestamp.fromDate(value);
  }
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return Timestamp.fromDate(date);
  }
  return null;
};

const required = (data: Data, field: string, message: string): string => {
  const value = stringValue(data[field]);
  if (!value) throw new HttpsError("invalid-argument", message);
  return value;
};

const assertAdmin = async (auth: {uid: string; token: Data} | undefined) => {
  if (!auth) throw new HttpsError("unauthenticated", "Sign in is required.");
  await assertActiveAccount(auth.uid, auth.token || {});
  if (auth.token.admin === true) return;
  const user = await getFirestore().doc(`users/${auth.uid}`).get();
  const role = stringValue(user.data()?.role).toLowerCase();
  if (!new Set(["admin"]).has(role)) {
    throw new HttpsError("permission-denied", "Admin access is required.");
  }
};

const actor = (auth: {uid: string; token: Data}): Data => ({
  uid: auth.uid,
  name: stringValue(auth.token.name) || stringValue(auth.token.email) || "Admin",
  email: stringValue(auth.token.email),
});

const appendHistory = (
  current: unknown,
  entry: Data,
): Data[] => {
  const list = Array.isArray(current) ? current.filter((item) => item && typeof item === "object") : [];
  return [...list.slice(-99), entry];
};

const paymentStatus = (finalAmount: number, received: number, refunded: number): string => {
  if (refunded > 0) return "Refunded";
  const netReceived = Math.max(0, received - refunded);
  if (netReceived <= 0) return "Unpaid";
  if (netReceived + 0.00001 < finalAmount) return "Partially Paid";
  return "Paid";
};

const getAssignmentWindow = (booking: Data, input: Data) => {
  const start = asTimestamp(
    input.assignmentStart || input.travelAt || booking.assignmentStart ||
    booking.travelAt || booking.travelDate || booking.pickupDate ||
    booking.bookingDate || booking.date || booking.time || booking.reqTime,
  );
  if (!start) {
    throw new HttpsError("failed-precondition", "A valid travel date and time is required.");
  }
  const requestedHours = numberValue(input.durationHours, DEFAULT_TRIP_HOURS);
  const durationHours = requestedHours > 0 && requestedHours <= 168 ? requestedHours : DEFAULT_TRIP_HOURS;
  const end = asTimestamp(
    input.assignmentEnd || booking.assignmentEnd || booking.dropoffDate ||
    booking.returnDate || booking.endDate,
  ) ||
    Timestamp.fromMillis(start.toMillis() + durationHours * 60 * 60 * 1000);
  if (end.toMillis() <= start.toMillis()) {
    throw new HttpsError("invalid-argument", "Trip end time must be after the start time.");
  }
  return {start, end, durationHours};
};

const assertNoConflict = async (
  collectionName: string,
  bookingId: string,
  driverId: string | null,
  vehicleId: string | null,
  start: Timestamp,
  end: Timestamp,
) => {
  const db = getFirestore();
  const collections = ["car_bookings", "self_driving_bookings"];
  for (const target of collections) {
    const assignments: Array<[string, string | null, string]> = [
      ["driverId", driverId, "driver"],
      ["vehicleId", vehicleId, "vehicle"],
    ];
    for (const [field, value, label] of assignments) {
      if (!value) continue;
      const snapshot = await db.collection(target)
        .where(field, "==", value)
        .get();
      const conflict = snapshot.docs.find((doc) => {
        if (target === collectionName && doc.id === bookingId) return false;
        const data = doc.data();
        if (!["Accepted", "Confirmed"].includes(normalizeStatus(data))) return false;
        const otherStart = asTimestamp(data.assignmentStart);
        const otherEnd = asTimestamp(data.assignmentEnd);
        return Boolean(otherStart && otherEnd &&
          otherStart.toMillis() < end.toMillis() &&
          otherEnd.toMillis() > start.toMillis());
      });
      if (conflict) {
        throw new HttpsError(
          "already-exists",
          `The selected ${label} is already assigned during this trip window.`,
          {conflictingBookingId: conflict.id},
        );
      }
    }
  }
};

const assignmentPatch = async (
  kind: BookingKind,
  collectionName: string,
  bookingId: string,
  booking: Data,
  input: Data,
): Promise<Data> => {
  if (kind === "selfDrive") {
    const licence = stringValue(booking.licenceVerificationStatus || "Pending");
    const passport = stringValue(booking.passportVerificationStatus || "Pending");
    if (licence !== "Verified" || passport !== "Verified") {
      throw new HttpsError(
        "failed-precondition",
        "Driving licence and passport must both be verified before acceptance.",
      );
    }
    if (!hasSelfDriveDocuments(booking)) {
      throw new HttpsError(
        "failed-precondition",
        "Driving licence and passport documents must exist before acceptance.",
      );
    }
    const vehicleSelection = required(input, "vehicleId", "Select a managed vehicle or Custom.");
    if (vehicleSelection === "__na__") {
      throw new HttpsError(
        "failed-precondition",
        "A vehicle must be assigned before a self-drive booking can be accepted.",
      );
    }
    const customVehicle = vehicleSelection === "__custom__";
    const db = getFirestore();
    const vehicleSnap = customVehicle ? null : await db.doc(`transportVehicles/${vehicleSelection}`).get();
    if (vehicleSnap && !vehicleSnap.exists) {
      throw new HttpsError("not-found", "The selected vehicle was not found.");
    }
    const vehicle = vehicleSnap?.data() || {};
    if (vehicleSnap && (vehicle.active === false ||
        !new Set(["Available", "Assigned"]).has(stringValue(vehicle.availabilityStatus) || "Available"))) {
      throw new HttpsError("failed-precondition", "The selected vehicle is unavailable.");
    }
    const companyId = customVehicle ? null : stringValue(vehicle.companyId);
    const companySnap = companyId ? await db.doc(`transportCompanies/${companyId}`).get() : null;
    if (companyId && (!companySnap?.exists || companySnap.data()?.active === false)) {
      throw new HttpsError("failed-precondition", "The vehicle company is missing or inactive.");
    }
    const company = companySnap?.data() || {};
    const providerName = customVehicle ?
      required(input, "providerName", "Vehicle provider is required.") :
      stringValue(company.companyName || company.name);
    const providerPhone = customVehicle ?
      required(input, "providerPhone", "Provider phone is required.") :
      stringValue(company.phone || company.contact);
    const vehicleName = customVehicle ?
      required(input, "vehicleName", "Vehicle name is required.") :
      stringValue(vehicle.vehicleName || vehicle.name);
    const registrationNumber = customVehicle ?
      required(input, "registrationNumber", "Registration number is required.") :
      stringValue(vehicle.registrationNumber);
    if (!providerName || !providerPhone || !vehicleName || !registrationNumber) {
      throw new HttpsError("failed-precondition", "Complete the selected vehicle and company details in management.");
    }
    const handoverName = personValue(
      input.handoverName,
      booking.customerName,
      booking.name,
      booking.username,
      booking.guestName,
    );
    const handoverPhone = personValue(
      input.handoverPhone,
      booking.customerPhone,
      booking.contact,
      booking.phoneNo,
      booking.guestPhone,
      booking.phone,
    );
    if (!handoverName || !handoverPhone) {
      throw new HttpsError(
        "invalid-argument",
        "Handover person and phone are required. Add them to the booking or assignment.",
      );
    }
    const pickupLocation = required(input, "pickupLocation", "Physical pickup location is required.");
    const window = customVehicle ? null : getAssignmentWindow(booking, input);
    if (window) {
      await assertNoConflict(collectionName, bookingId, null, vehicleSelection, window.start, window.end);
    }
    return {
      companyId,
      vehicleId: customVehicle ? null : vehicleSelection,
      vehicleAssignmentMode: customVehicle ? "custom" : "managed",
      companySnapshot: {
        name: providerName,
        phone: providerPhone,
        companyType: company.companyType || "Self Drive Provider",
      },
      providerSnapshot: {name: providerName, phone: providerPhone},
      vehicleSnapshot: {
        name: vehicleName,
        vehicleType: vehicle.vehicleType || "Self Drive",
        registrationNumber,
      },
      handoverSnapshot: {name: handoverName, phone: handoverPhone},
      Provider: {name: providerName, phone: providerPhone},
      vehicleDetails: {vehicle: vehicleName, vehicleNumber: registrationNumber},
      dropDetails: {name: handoverName, phone: handoverPhone},
      PickUpLocation: pickupLocation,
      ...(window ? {
        assignmentStart: window.start,
        assignmentEnd: window.end,
        assumedDurationHours: window.durationHours,
      } : {}),
    };
  }

  const companySelection = required(input, "companyId", "Company is required.");
  const driverSelection = required(input, "driverId", "Driver is required.");
  const vehicleSelection = required(input, "vehicleId", "Vehicle is required.");
  const noCompany = companySelection === "__na__";
  const noDriver = driverSelection === "__na__";
  const noVehicle = vehicleSelection === "__na__";
  const customCompany = companySelection === "__custom__";
  const customDriver = driverSelection === "__custom__";
  const customVehicle = vehicleSelection === "__custom__";
  if (customCompany && (!customDriver || !customVehicle)) {
    throw new HttpsError("failed-precondition", "A custom company requires custom driver and vehicle details.");
  }
  const companyId = customCompany || noCompany ? null : companySelection;
  const driverId = customDriver || noDriver ? null : driverSelection;
  const vehicleId = customVehicle || noVehicle ? null : vehicleSelection;
  const db = getFirestore();
  const [companySnap, driverSnap, vehicleSnap] = await Promise.all([
    companyId ? db.doc(`transportCompanies/${companyId}`).get() : null,
    driverId ? db.doc(`transportDrivers/${driverId}`).get() : null,
    vehicleId ? db.doc(`transportVehicles/${vehicleId}`).get() : null,
  ]);
  if ((companySnap && !companySnap.exists) || (driverSnap && !driverSnap.exists) || (vehicleSnap && !vehicleSnap.exists)) {
    throw new HttpsError("not-found", "Company, driver, or vehicle was not found.");
  }
  const company = companySnap?.data() || (noCompany ? {
    companyName: "N/A",
    phone: "N/A",
    companyType: "Not assigned",
  } : {
    companyName: required(input, "customCompanyName", "Custom company name is required."),
    phone: required(input, "customCompanyPhone", "Custom company phone is required."),
    companyType: "Custom",
  });
  const driver = driverSnap?.data() || (noDriver ? {
    driverName: "N/A",
    name: "N/A",
    phone: "N/A",
  } : {
    driverName: required(input, "customDriverName", "Custom driver name is required."),
    phone: required(input, "customDriverPhone", "Custom driver phone is required."),
  });
  const vehicle = vehicleSnap?.data() || (noVehicle ? {
    vehicleName: "N/A",
    name: "N/A",
    vehicleType: kind === "van" ? "Van" : "Taxi",
    registrationNumber: "N/A",
  } : {
    vehicleName: required(input, "customVehicleName", "Custom vehicle name is required."),
    vehicleType: stringValue(input.customVehicleType) || (kind === "van" ? "Van" : "Taxi"),
    registrationNumber: required(input, "customRegistrationNumber", "Custom registration number is required."),
  });
  if (company.active === false || driver.active === false || vehicle.active === false) {
    throw new HttpsError("failed-precondition", "Inactive assignments cannot be used.");
  }
  if ((companyId && driverId && driver.companyId !== companyId) ||
      (companyId && vehicleId && vehicle.companyId !== companyId)) {
    throw new HttpsError("failed-precondition", "Driver and vehicle must belong to the selected company.");
  }
  if (!new Set(["Available", "Assigned"]).has(stringValue(driver.availabilityStatus) || "Available") ||
      !new Set(["Available", "Assigned"]).has(stringValue(vehicle.availabilityStatus) || "Available")) {
    throw new HttpsError("failed-precondition", "Driver or vehicle is unavailable.");
  }
  // Car bookings accept any vehicle type (car / van / taxi / bike)
  const window = getAssignmentWindow(booking, input);
  await assertNoConflict(collectionName, bookingId, driverId, vehicleId, window.start, window.end);
  return {
    companyId,
    driverId,
    vehicleId,
    companyAssignmentMode: noCompany ? "na" : customCompany ? "custom" : "managed",
    driverAssignmentMode: noDriver ? "na" : customDriver ? "custom" : "managed",
    vehicleAssignmentMode: noVehicle ? "na" : customVehicle ? "custom" : "managed",
    companySnapshot: {
      name: company.companyName || company.name || "",
      phone: company.phone || company.contact || "",
      companyType: company.companyType || "",
    },
    driverSnapshot: {
      name: driver.driverName || driver.name || "",
      phone: driver.phone || "",
      licenceNumber: driver.licenceNumber || "",
    },
    vehicleSnapshot: {
      name: vehicle.vehicleName || vehicle.name || "",
      vehicleType: vehicle.vehicleType || "",
      registrationNumber: vehicle.registrationNumber || "",
    },
    Driver: {name: driver.driverName || driver.name || "", phone: driver.phone || ""},
    vehicleDetails: {
      vehicle: vehicle.vehicleName || vehicle.name || "",
      vehicleNumber: vehicle.registrationNumber || "",
    },
    companyName: company.companyName || company.name || "",
    assignmentStart: window.start,
    assignmentEnd: window.end,
    assumedDurationHours: window.durationHours,
  };
};

export const manageTransportBooking = onCall(
  {region: REGION, cors: true},
  async (request) => {
    await assertAdmin(request.auth);
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in is required.");
    const input = (request.data || {}) as Data;
    const kind = stringValue(input.bookingKind) as BookingKind;
    if (!Object.prototype.hasOwnProperty.call(BOOKING_COLLECTIONS, kind)) {
      throw new HttpsError("invalid-argument", "Unknown booking type.");
    }
    const bookingId = required(input, "bookingId", "Booking ID is required.");
    const action = required(input, "action", "Action is required.");
    const source = stringValue(input.source) || "manual";
    const collectionName = collectionFor(kind, source);
    const bookingRef = getFirestore().doc(`${collectionName}/${bookingId}`);
    const snapshot = await bookingRef.get();
    if (!snapshot.exists) throw new HttpsError("not-found", "Booking was not found.");
    const booking = snapshot.data() || {};
    const currentStatus = normalizeStatus(booking);
    const actionKey = stringValue(input.idempotencyKey) || `${action}:${Date.now()}`;
    const existingKeys = Array.isArray(booking.workflowActionKeys) ? booking.workflowActionKeys : [];
    if (existingKeys.includes(actionKey)) return {ok: true, duplicate: true};
    const changedBy = actor(request.auth);
    const now = Timestamp.now();
    let patch: Data = {};
    let activityAction = action;
    let nextStatus = currentStatus;

    if (action === "editDetails") {
      if (currentStatus !== "Pending") {
        throw new HttpsError("failed-precondition", "Only pending booking details can be edited.");
      }
      const travelAt = asTimestamp(input.travelAt);
      patch = {
        customerName: required(input, "customerName", "Customer name is required."),
        customerPhone: required(input, "customerPhone", "Customer phone is required."),
        pickup: required(input, "pickup", "Pickup is required."),
        destination: required(input, "destination", "Destination is required."),
        travelAt: travelAt || booking.travelAt || null,
        notes: stringValue(input.notes),
      };
      if (kind === "taxi") {
        patch.name = patch.customerName;
        patch.contact = patch.customerPhone;
        patch.drop = patch.destination;
        if (travelAt) patch.time = travelAt;
      } else if (kind === "van") {
        patch.guestName = patch.customerName;
        patch.guestPhone = patch.customerPhone;
        patch.pickupLocation = patch.pickup;
        patch.dropLocation = patch.destination;
        if (travelAt) patch.bookingDate = travelAt;
      } else {
        patch.username = patch.customerName;
        patch.phoneNo = patch.customerPhone;
      }
      activityAction = "Booking details edited";
    } else if (["accept", "updateAssignment"].includes(action)) {
      if (action === "accept" && currentStatus !== "Pending") {
        throw new HttpsError("failed-precondition", "Only pending bookings can be accepted.");
      }
      if (action === "updateAssignment" && !["Accepted", "Confirmed"].includes(currentStatus)) {
        throw new HttpsError("failed-precondition", "Assignment can only be edited after acceptance.");
      }
      const assignment = await assignmentPatch(kind, collectionName, bookingId, booking, input);
      const finalAmount = numberValue(input.finalAmount, bookingAmount(booking));
      const commissionPercentage = numberValue(
        input.commissionPercentage,
        numberValue(booking.commissionPercentage ?? booking.comission),
      );
      if (finalAmount <= 0 || commissionPercentage < 0 || commissionPercentage > 100) {
        throw new HttpsError("invalid-argument", "Amount and commission values are invalid.");
      }
      nextStatus = action === "accept" ? (kind === "van" ? "Confirmed" : "Accepted") : currentStatus;
      const businessCommission = finalAmount * commissionPercentage / 100;
      patch = {
        ...assignment,
        finalAmount,
        AmountOffered: finalAmount,
        price: kind === "van" ? finalAmount : booking.price,
        commissionPercentage,
        comission: commissionPercentage,
        businessCommission,
        providerPayout: finalAmount - businessCommission,
        earningsStatus: "Expected",
        ...(action === "accept" ? {acceptedAt: now, acceptedBy: changedBy} : {}),
      };
      activityAction = action === "accept" ? "Booking accepted" : "Assignment updated";
    } else if (action === "complete") {
      nextStatus = "Completed";
      const additionalCharges = Math.max(0, numberValue(input.additionalCharges));
      const finalAmount = bookingAmount(booking) + additionalCharges;
      const commissionPercentage = numberValue(
        booking.commissionPercentage ?? booking.comission,
      );
      const netReceived = Math.max(
        0,
        numberValue(booking.amountReceived) - numberValue(booking.amountRefunded),
      );
      patch = {
        completedAt: now,
        completedBy: changedBy,
        completionNotes: stringValue(input.notes),
        additionalCharges,
        finalAmount,
        remainingBalance: Math.max(0, finalAmount - netReceived),
        paymentStatus: paymentStatus(
          finalAmount,
          numberValue(booking.amountReceived),
          numberValue(booking.amountRefunded),
        ),
        businessCommission: finalAmount * commissionPercentage / 100,
        providerPayout: finalAmount - finalAmount * commissionPercentage / 100,
      };
      activityAction = "Booking completed";
    } else if (action === "reject") {
      nextStatus = "Rejected";
      patch = {
        rejectedAt: now,
        rejectedBy: changedBy,
        rejectionReason: required(input, "reason", "Rejection reason is required."),
        rejectionNotes: stringValue(input.notes),
        showRejectionReasonToCustomer: input.showReasonToCustomer === true,
      };
      activityAction = "Booking rejected";
    } else if (action === "cancel") {
      nextStatus = "Canceled";
      patch = {
        canceledAt: now,
        canceledBy: changedBy,
        cancellationReason: required(input, "reason", "Cancellation reason is required."),
        cancellationNotes: stringValue(input.notes),
      };
      activityAction = "Booking canceled";
    } else if (action === "verifyDocument") {
      if (kind !== "selfDrive") throw new HttpsError("failed-precondition", "Document verification is for self-drive bookings.");
      if (currentStatus !== "Pending") {
        throw new HttpsError("failed-precondition", "Documents can only be verified while the booking is pending.");
      }
      const documentType = required(input, "documentType", "Document type is required.");
      if (!new Set(["licence", "passport"]).has(documentType)) {
        throw new HttpsError("invalid-argument", "Unknown document type.");
      }
      const verificationStatus = required(input, "verificationStatus", "Verification status is required.");
      if (!VALID_DOCUMENT_STATUSES.has(verificationStatus)) {
        throw new HttpsError("invalid-argument", "Invalid verification status.");
      }
      const documentLink = documentType === "licence" ? stringValue(
        booking.licenceLink || booking.licenseLink ||
        booking.drivingLicenceLink || booking.drivingLicenseLink ||
        booking.licenceUrl || booking.licenseUrl ||
        booking.drivingLicenceUrl || booking.drivingLicenseUrl ||
        booking.licence || booking.license,
      ) : stringValue(
        booking.passportLink || booking.passportDocumentLink ||
        booking.passportUrl || booking.passportDocumentUrl ||
        booking.passport || booking.passportImage,
      );
      if (!documentLink) {
        throw new HttpsError(
          "failed-precondition",
          `${documentType === "licence" ? "Driving licence" : "Passport"} document is missing.`,
        );
      }
      patch = {
        [`${documentType}VerificationStatus`]: verificationStatus,
        [`${documentType}VerifiedAt`]: now,
        [`${documentType}VerifiedBy`]: changedBy,
        [`${documentType}VerificationNotes`]: stringValue(input.notes),
      };
      activityAction = `${documentType === "licence" ? "Driving licence" : "Passport"} ${verificationStatus.toLowerCase()}`;
    } else if (["recordPayment", "recordRefund"].includes(action)) {
      if (currentStatus === "Rejected") {
        throw new HttpsError("failed-precondition", "Payments cannot be recorded for rejected bookings.");
      }
      if (action === "recordPayment" &&
          !["Accepted", "Confirmed", "Completed"].includes(currentStatus)) {
        throw new HttpsError(
          "failed-precondition",
          "Payments can only be recorded after acceptance or completion.",
        );
      }
      if (action === "recordRefund" &&
          !["Accepted", "Confirmed", "Completed", "Canceled"].includes(currentStatus)) {
        throw new HttpsError(
          "failed-precondition",
          "Refunds can only be recorded for accepted, completed, or canceled bookings.",
        );
      }
      const amount = numberValue(input.amount, -1);
      if (!(amount > 0)) throw new HttpsError("invalid-argument", "Amount must be greater than zero.");
      const finalAmount = bookingAmount(booking);
      if (finalAmount <= 0) throw new HttpsError("failed-precondition", "Set the final amount before recording payment.");
      const transactions = Array.isArray(booking.paymentTransactions) ? booking.paymentTransactions : [];
      const refunds = Array.isArray(booking.refundTransactions) ? booking.refundTransactions : [];
      const received = Math.max(0, numberValue(booking.amountReceived));
      const refunded = Math.max(0, numberValue(booking.amountRefunded));
      const isRefund = action === "recordRefund";
      if (isRefund && amount > received - refunded + 0.00001) {
        throw new HttpsError("invalid-argument", "Refund cannot exceed the unrefunded amount received.");
      }
      if (!isRefund && received + amount > finalAmount + 0.00001) {
        throw new HttpsError("invalid-argument", "Payment cannot exceed the remaining balance.");
      }
      const method = required(input, "paymentMethod", "Payment method is required.");
      if (!VALID_METHODS.has(method)) throw new HttpsError("invalid-argument", "Unsupported payment method.");
      const transaction = {
        id: actionKey,
        amount,
        paymentMethod: method,
        transactionReference: stringValue(input.transactionReference),
        receivedDate: asTimestamp(input.receivedDate) || now,
        receivedBy: changedBy,
        notes: stringValue(input.notes),
        createdAt: now,
        type: isRefund ? "Refund" : "Payment",
      };
      const newReceived = received + (isRefund ? 0 : amount);
      const newRefunded = refunded + (isRefund ? amount : 0);
      const netReceived = Math.max(0, newReceived - newRefunded);
      patch = {
        finalAmount,
        amountReceived: newReceived,
        amountRefunded: newRefunded,
        remainingBalance: Math.max(0, finalAmount - netReceived),
        paymentStatus: paymentStatus(finalAmount, newReceived, newRefunded),
        paymentTransactions: isRefund ? transactions : [...transactions, transaction],
        refundTransactions: isRefund ? [...refunds, transaction] : refunds,
        lastPaymentAt: now,
        earningsStatus: netReceived > 0 ? (netReceived >= finalAmount ? "Realised" : "Partially Realised") : "Expected",
      };
      activityAction = isRefund ? "Refund recorded" : "Payment received";
    } else {
      throw new HttpsError("invalid-argument", "Unsupported booking action.");
    }

    if (nextStatus !== currentStatus && !VALID_TRANSITIONS[currentStatus]?.has(nextStatus)) {
      throw new HttpsError(
        "failed-precondition",
        `Invalid status transition: ${currentStatus} to ${nextStatus}.`,
      );
    }

    await getFirestore().runTransaction(async (transaction) => {
      const freshSnap = await transaction.get(bookingRef);
      if (!freshSnap.exists) throw new HttpsError("not-found", "Booking was removed.");
      const fresh = freshSnap.data() || {};
      const freshKeys = Array.isArray(fresh.workflowActionKeys) ? fresh.workflowActionKeys : [];
      if (freshKeys.includes(actionKey)) return;
      const freshStatus = normalizeStatus(fresh);
      if (freshStatus !== currentStatus) {
        throw new HttpsError("aborted", "Booking changed. Refresh and try again.");
      }
      if (action === "accept" && kind === "selfDrive" &&
          (stringValue(fresh.licenceVerificationStatus) !== "Verified" ||
           stringValue(fresh.passportVerificationStatus) !== "Verified" ||
           !hasSelfDriveDocuments(fresh))) {
        throw new HttpsError(
          "failed-precondition",
          "Driving licence and passport must still be verified before acceptance.",
        );
      }
      const assignedDriverId = managedResourceId(
        Object.prototype.hasOwnProperty.call(patch, "driverId") ? patch.driverId : fresh.driverId,
      );
      const assignedVehicleId = managedResourceId(
        Object.prototype.hasOwnProperty.call(patch, "vehicleId") ? patch.vehicleId : fresh.vehicleId,
      );
      const previousDriverId = managedResourceId(fresh.driverId);
      const previousVehicleId = managedResourceId(fresh.vehicleId);
      const driverRef = assignedDriverId ?
        getFirestore().doc(`transportDrivers/${assignedDriverId}`) : null;
      const vehicleRef = assignedVehicleId ?
        getFirestore().doc(`transportVehicles/${assignedVehicleId}`) : null;
      const previousDriverRef = previousDriverId && previousDriverId !== assignedDriverId ?
        getFirestore().doc(`transportDrivers/${previousDriverId}`) : null;
      const previousVehicleRef = previousVehicleId && previousVehicleId !== assignedVehicleId ?
        getFirestore().doc(`transportVehicles/${previousVehicleId}`) : null;
      const driverState = driverRef ? await transaction.get(driverRef) : null;
      const vehicleState = vehicleRef ? await transaction.get(vehicleRef) : null;
      if (previousDriverRef) await transaction.get(previousDriverRef);
      if (previousVehicleRef) await transaction.get(previousVehicleRef);
      if (["accept", "updateAssignment"].includes(action)) {
        const driverBooking = stringValue(driverState?.data()?.currentBookingId);
        const vehicleBooking = stringValue(vehicleState?.data()?.currentBookingId);
        if ((driverBooking && driverBooking !== bookingId) ||
            (vehicleBooking && vehicleBooking !== bookingId)) {
          throw new HttpsError(
            "already-exists",
            "Driver or vehicle was assigned by another admin. Refresh and choose again.",
          );
        }
      }
      let effectivePatch: Data = {...patch};
      if (["recordPayment", "recordRefund"].includes(action)) {
        const amount = numberValue(input.amount, -1);
        const finalAmount = bookingAmount(fresh);
        const received = Math.max(0, numberValue(fresh.amountReceived));
        const refunded = Math.max(0, numberValue(fresh.amountRefunded));
        const isRefund = action === "recordRefund";
        if (isRefund && amount > received - refunded + 0.00001) {
          throw new HttpsError(
            "invalid-argument",
            "Refund cannot exceed the unrefunded amount received.",
          );
        }
        if (!isRefund && received + amount > finalAmount + 0.00001) {
          throw new HttpsError(
            "invalid-argument",
            "Payment cannot exceed the remaining balance.",
          );
        }
        const payments = Array.isArray(fresh.paymentTransactions) ?
          fresh.paymentTransactions : [];
        const refunds = Array.isArray(fresh.refundTransactions) ?
          fresh.refundTransactions : [];
        const payment = {
          id: actionKey,
          amount,
          paymentMethod: stringValue(input.paymentMethod),
          transactionReference: stringValue(input.transactionReference),
          receivedDate: asTimestamp(input.receivedDate) || now,
          receivedBy: changedBy,
          notes: stringValue(input.notes),
          createdAt: now,
          type: isRefund ? "Refund" : "Payment",
        };
        const newReceived = received + (isRefund ? 0 : amount);
        const newRefunded = refunded + (isRefund ? amount : 0);
        const netReceived = Math.max(0, newReceived - newRefunded);
        effectivePatch = {
          ...effectivePatch,
          finalAmount,
          amountReceived: newReceived,
          amountRefunded: newRefunded,
          remainingBalance: Math.max(0, finalAmount - netReceived),
          paymentStatus: paymentStatus(finalAmount, newReceived, newRefunded),
          paymentTransactions: isRefund ? payments : [...payments, payment],
          refundTransactions: isRefund ? [...refunds, payment] : refunds,
          lastPaymentAt: now,
          earningsStatus: netReceived > 0 ?
            (netReceived >= finalAmount ? "Realised" : "Partially Realised") :
            "Expected",
        };
      } else if (action === "complete") {
        const additionalCharges = Math.max(0, numberValue(input.additionalCharges));
        const finalAmount = bookingAmount(fresh) + additionalCharges;
        const commissionPercentage = numberValue(
          fresh.commissionPercentage ?? fresh.comission,
        );
        const received = Math.max(0, numberValue(fresh.amountReceived));
        const refunded = Math.max(0, numberValue(fresh.amountRefunded));
        effectivePatch = {
          ...effectivePatch,
          additionalCharges,
          finalAmount,
          remainingBalance: Math.max(0, finalAmount - received + refunded),
          paymentStatus: paymentStatus(finalAmount, received, refunded),
          businessCommission: finalAmount * commissionPercentage / 100,
          providerPayout: finalAmount - finalAmount * commissionPercentage / 100,
        };
      }
      const historyEntry = {
        action: activityAction,
        previousStatus: currentStatus,
        newStatus: nextStatus,
        changedBy,
        timestamp: now,
        reason: stringValue(input.reason),
        notes: stringValue(input.notes),
      };
      const assignmentActivities = action === "accept" && kind !== "selfDrive" ? [
        {...historyEntry, action: "Company selected"},
        {...historyEntry, action: "Driver assigned"},
        {...historyEntry, action: "Vehicle assigned"},
        historyEntry,
      ] : [historyEntry];
      const activityHistory = assignmentActivities.reduce(
        (history, entry) => appendHistory(history, entry),
        fresh.activityHistory,
      );
      const update: Data = {
        ...effectivePatch,
        bookingStatus: nextStatus,
        status: legacyStatus(kind, nextStatus),
        updatedAt: now,
        updatedBy: changedBy,
        workflowActionKeys: [...freshKeys.slice(-99), actionKey],
        activityHistory,
        statusHistory: nextStatus !== currentStatus ?
          appendHistory(fresh.statusHistory, historyEntry) :
          (Array.isArray(fresh.statusHistory) ? fresh.statusHistory : []),
      };
      transaction.update(bookingRef, update);

      if (kind !== "selfDrive" && driverRef && vehicleRef) {
        if (["accept", "updateAssignment"].includes(action)) {
          if (previousDriverRef) {
            transaction.set(previousDriverRef, {
              availabilityStatus: "Available",
              currentBookingId: FieldValue.delete(),
              updatedAt: now,
            }, {merge: true});
          }
          if (previousVehicleRef) {
            transaction.set(previousVehicleRef, {
              availabilityStatus: "Available",
              currentBookingId: FieldValue.delete(),
              updatedAt: now,
            }, {merge: true});
          }
          transaction.set(driverRef, {
            availabilityStatus: "Assigned",
            currentBookingId: bookingId,
            updatedAt: now,
          }, {merge: true});
          transaction.set(vehicleRef, {
            availabilityStatus: "Assigned",
            currentBookingId: bookingId,
            updatedAt: now,
          }, {merge: true});
        } else if (["complete", "cancel"].includes(action)) {
          const driverBooking = stringValue(driverState?.data()?.currentBookingId);
          const vehicleBooking = stringValue(vehicleState?.data()?.currentBookingId);
          if (!driverBooking || driverBooking === bookingId) {
            transaction.set(driverRef, {
              availabilityStatus: "Available",
              currentBookingId: FieldValue.delete(),
              updatedAt: now,
            }, {merge: true});
          }
          if (!vehicleBooking || vehicleBooking === bookingId) {
            transaction.set(vehicleRef, {
              availabilityStatus: "Available",
              currentBookingId: FieldValue.delete(),
              updatedAt: now,
            }, {merge: true});
          }
        }
      }
      if (kind === "selfDrive" && (vehicleRef || previousVehicleRef)) {
        if (["accept", "updateAssignment"].includes(action)) {
          if (previousVehicleRef) {
            transaction.set(previousVehicleRef, {
              availabilityStatus: "Available",
              currentBookingId: FieldValue.delete(),
              updatedAt: now,
            }, {merge: true});
          }
          if (vehicleRef) {
            transaction.set(vehicleRef, {
              availabilityStatus: "Assigned",
              currentBookingId: bookingId,
              updatedAt: now,
            }, {merge: true});
          }
        } else if (["complete", "cancel"].includes(action) && vehicleRef) {
          const vehicleBooking = stringValue(vehicleState?.data()?.currentBookingId);
          if (!vehicleBooking || vehicleBooking === bookingId) {
            transaction.set(vehicleRef, {
              availabilityStatus: "Available",
              currentBookingId: FieldValue.delete(),
              updatedAt: now,
            }, {merge: true});
          }
        }
      }

      const finalAmount = numberValue(update.finalAmount, bookingAmount(fresh));
      const commissionPercentage = numberValue(
        update.commissionPercentage,
        numberValue(fresh.commissionPercentage ?? fresh.comission),
      );
      const earningsEligible =
        ["Accepted", "Confirmed", "Completed"].includes(nextStatus) ||
        ["Accepted", "Confirmed", "Completed"].includes(currentStatus) ||
        ["recordPayment", "recordRefund"].includes(action);
      if (finalAmount > 0 && earningsEligible) {
        const earningsRef = getFirestore().doc(
          `transportEarnings/${collectionName}_${bookingId}`,
        );
        const realisedBase = Math.max(0, numberValue(
          update.amountReceived,
          numberValue(fresh.amountReceived),
        ) - numberValue(update.amountRefunded, numberValue(fresh.amountRefunded)));
        transaction.set(earningsRef, {
          bookingId,
          bookingCollection: collectionName,
          bookingKind: kind,
          companyId: update.companyId || fresh.companyId || null,
          driverId: update.driverId || fresh.driverId || null,
          vehicleId: update.vehicleId || fresh.vehicleId || null,
          finalAmount,
          commissionPercentage,
          expectedBusinessCommission: finalAmount * commissionPercentage / 100,
          expectedProviderPayout: finalAmount - finalAmount * commissionPercentage / 100,
          realisedGrossRevenue: realisedBase,
          realisedBusinessCommission: realisedBase * commissionPercentage / 100,
          realisedProviderPayout: realisedBase - realisedBase * commissionPercentage / 100,
          status: update.earningsStatus || fresh.earningsStatus || "Expected",
          updatedAt: now,
        }, {merge: true});
      }
    });
    return {ok: true, bookingStatus: nextStatus};
  },
);

const RESOURCE_COLLECTIONS: Record<string, string> = {
  company: "transportCompanies",
  driver: "transportDrivers",
  vehicle: "transportVehicles",
};

export const manageTransportResource = onCall(
  {region: REGION, cors: true},
  async (request) => {
    await assertAdmin(request.auth);
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in is required.");
    const input = (request.data || {}) as Data;
    const resourceType = required(input, "resourceType", "Resource type is required.");
    const collectionName = RESOURCE_COLLECTIONS[resourceType];
    if (!collectionName) throw new HttpsError("invalid-argument", "Unknown resource type.");
    const action = stringValue(input.action) || "save";
    const id = stringValue(input.id);
    const values = input.values && typeof input.values === "object" ? input.values as Data : {};
    const db = getFirestore();
    const now = Timestamp.now();
    const target = id ? db.doc(`${collectionName}/${id}`) : db.collection(collectionName).doc();
    const changedBy = actor(request.auth);

    if (action === "archive") {
      if (!id) throw new HttpsError("invalid-argument", "Resource ID is required.");
      if (resourceType === "driver") {
        await db.runTransaction(async (transaction) => {
          const driverSnap = await transaction.get(target);
          const assignedVehicleId = stringValue(driverSnap.data()?.assignedVehicleId);
          const vehicleRef = assignedVehicleId ? db.doc(`transportVehicles/${assignedVehicleId}`) : null;
          const vehicleSnap = vehicleRef ? await transaction.get(vehicleRef) : null;
          transaction.set(target, {
            active: false,
            archived: true,
            archivedAt: now,
            archivedBy: changedBy,
            updatedAt: now,
          }, {merge: true});
          if (vehicleRef && vehicleSnap?.data()?.assignedDriverId === id) {
            transaction.set(vehicleRef, {
              assignedDriverId: FieldValue.delete(),
              assignedDriverName: FieldValue.delete(),
              updatedAt: now,
            }, {merge: true});
          }
        });
      } else if (resourceType === "vehicle") {
        await db.runTransaction(async (transaction) => {
          const vehicleSnap = await transaction.get(target);
          const assignedDriverId = stringValue(vehicleSnap.data()?.assignedDriverId);
          const driverRef = assignedDriverId ? db.doc(`transportDrivers/${assignedDriverId}`) : null;
          const driverSnap = driverRef ? await transaction.get(driverRef) : null;
          transaction.set(target, {
            active: false,
            archived: true,
            archivedAt: now,
            archivedBy: changedBy,
            updatedAt: now,
          }, {merge: true});
          if (driverRef && driverSnap?.data()?.assignedVehicleId === id) {
            transaction.set(driverRef, {
              assignedVehicleId: null,
              assignedVehicleSnapshot: null,
              updatedAt: now,
            }, {merge: true});
          }
        });
      } else {
        await target.set({
          active: false,
          archived: true,
          archivedAt: now,
          archivedBy: changedBy,
          updatedAt: now,
        }, {merge: true});
      }
      return {ok: true, id};
    }

    if (action === "delete") {
      if (!id) throw new HttpsError("invalid-argument", "Resource ID is required.");
      if (resourceType === "company") {
        const [drivers, vehicles] = await Promise.all([
          db.collection("transportDrivers").where("companyId", "==", id).limit(1).get(),
          db.collection("transportVehicles").where("companyId", "==", id).limit(1).get(),
        ]);
        if (!drivers.empty || !vehicles.empty) {
          throw new HttpsError(
            "failed-precondition",
            "Delete or move this company's drivers and vehicles first.",
          );
        }
        const company = await target.get();
        if (!company.exists) throw new HttpsError("not-found", "Company was not found.");
        await target.delete();
      } else if (resourceType === "driver") {
        await db.runTransaction(async (transaction) => {
          const driver = await transaction.get(target);
          if (!driver.exists) throw new HttpsError("not-found", "Driver was not found.");
          if (stringValue(driver.data()?.currentBookingId)) {
            throw new HttpsError("failed-precondition", "This driver is assigned to an active booking.");
          }
          const assignedVehicleId = stringValue(driver.data()?.assignedVehicleId);
          const vehicleRef = assignedVehicleId ? db.doc(`transportVehicles/${assignedVehicleId}`) : null;
          const vehicle = vehicleRef ? await transaction.get(vehicleRef) : null;
          transaction.delete(target);
          if (vehicleRef && vehicle?.data()?.assignedDriverId === id) {
            transaction.set(vehicleRef, {
              assignedDriverId: FieldValue.delete(),
              assignedDriverName: FieldValue.delete(),
              updatedAt: now,
            }, {merge: true});
          }
        });
      } else {
        await db.runTransaction(async (transaction) => {
          const vehicle = await transaction.get(target);
          if (!vehicle.exists) throw new HttpsError("not-found", "Vehicle was not found.");
          if (stringValue(vehicle.data()?.currentBookingId)) {
            throw new HttpsError("failed-precondition", "This vehicle is assigned to an active booking.");
          }
          const assignedDriverId = stringValue(vehicle.data()?.assignedDriverId);
          const normalized = stringValue(vehicle.data()?.registrationNumberNormalized);
          const registryId = normalized.replace(/[^A-Z0-9_-]/gi, "_");
          const driverRef = assignedDriverId ? db.doc(`transportDrivers/${assignedDriverId}`) : null;
          const registryRef = registryId ? db.doc(`transportRegistrationNumbers/${registryId}`) : null;
          const driver = driverRef ? await transaction.get(driverRef) : null;
          const registry = registryRef ? await transaction.get(registryRef) : null;
          transaction.delete(target);
          if (driverRef && driver?.data()?.assignedVehicleId === id) {
            transaction.set(driverRef, {
              assignedVehicleId: null,
              assignedVehicleSnapshot: null,
              updatedAt: now,
            }, {merge: true});
          }
          if (registryRef && registry?.data()?.vehicleId === id) {
            transaction.delete(registryRef);
          }
        });
      }
      return {ok: true, id};
    }

    let assignedVehicleData: Data | null = null;
    if (resourceType === "company") {
      required(values, "companyName", "Company name is required.");
      if (!new Set(["Taxi Company", "Van Company", "Taxi and Van Company"]).has(stringValue(values.companyType))) {
        throw new HttpsError("invalid-argument", "Select a valid company type.");
      }
      const commission = numberValue(values.defaultCommissionPercentage);
      if (commission < 0 || commission > 100) throw new HttpsError("invalid-argument", "Commission must be between 0 and 100.");
    } else {
      const companyId = required(values, "companyId", "Company is required.");
      const company = await db.doc(`transportCompanies/${companyId}`).get();
      if (!company.exists || company.data()?.active === false) {
        throw new HttpsError("failed-precondition", "Select an active company.");
      }
      if (resourceType === "driver") {
        required(values, "driverName", "Driver name is required.");
        required(values, "phone", "Driver phone is required.");
        const assignedVehicleId = stringValue(values.assignedVehicleId);
        if (assignedVehicleId) {
          const assignedVehicle = await db.doc(`transportVehicles/${assignedVehicleId}`).get();
          if (!assignedVehicle.exists || assignedVehicle.data()?.active === false) {
            throw new HttpsError("failed-precondition", "Select an active vehicle.");
          }
          assignedVehicleData = assignedVehicle.data() || {};
          if (assignedVehicleData.companyId !== companyId) {
            throw new HttpsError("failed-precondition", "Driver and assigned vehicle must belong to the same company.");
          }
        }
      } else {
        required(values, "vehicleName", "Vehicle name is required.");
        const registrationNumber = required(values, "registrationNumber", "Registration number is required.").toUpperCase();
        const duplicate = await db.collection(collectionName)
          .where("registrationNumberNormalized", "==", registrationNumber.replace(/\s+/g, ""))
          .limit(2)
          .get();
        if (duplicate.docs.some((doc) => doc.id !== id)) {
          throw new HttpsError("already-exists", "A vehicle with this registration number already exists.");
        }
        values.registrationNumber = registrationNumber;
        values.registrationNumberNormalized = registrationNumber.replace(/\s+/g, "");
        if (id) {
          const currentVehicle = await target.get();
          const assignedDriverId = stringValue(currentVehicle.data()?.assignedDriverId);
          if (assignedDriverId) {
            const assignedDriver = await db.doc(`transportDrivers/${assignedDriverId}`).get();
            if (assignedDriver.exists && assignedDriver.data()?.companyId !== companyId) {
              throw new HttpsError(
                "failed-precondition",
                "Unassign this vehicle from its driver before changing the company.",
              );
            }
          }
        }
      }
    }

    const payload: Data = {
      ...values,
      active: values.active !== false,
      archived: false,
      updatedAt: now,
      updatedBy: actor(request.auth),
    };
    if (resourceType === "driver") {
      payload.assignedVehicleId = stringValue(values.assignedVehicleId) || null;
      payload.assignedVehicleSnapshot = assignedVehicleData ? {
        name: assignedVehicleData.vehicleName || assignedVehicleData.name || "",
        registrationNumber: assignedVehicleData.registrationNumber || "",
        vehicleType: assignedVehicleData.vehicleType || "",
      } : null;
    }
    if (!id) payload.createdAt = now;
    if (resourceType === "vehicle") {
      const normalized = stringValue(values.registrationNumberNormalized);
      const registryId = normalized.replace(/[^A-Z0-9_-]/gi, "_");
      const registryRef = db.doc(`transportRegistrationNumbers/${registryId}`);
      await db.runTransaction(async (transaction) => {
        const registry = await transaction.get(registryRef);
        const ownerId = stringValue(registry.data()?.vehicleId);
        if (registry.exists && ownerId && ownerId !== target.id) {
          throw new HttpsError(
            "already-exists",
            "A vehicle with this registration number already exists.",
          );
        }
        transaction.set(registryRef, {
          vehicleId: target.id,
          registrationNumberNormalized: normalized,
          updatedAt: now,
        }, {merge: true});
        transaction.set(target, payload, {merge: true});
      });
    } else if (resourceType === "driver") {
      await db.runTransaction(async (transaction) => {
        const current = await transaction.get(target);
        const oldVehicleId = stringValue(current.data()?.assignedVehicleId);
        const newVehicleId = stringValue(payload.assignedVehicleId);
        const oldVehicleRef = oldVehicleId ? db.doc(`transportVehicles/${oldVehicleId}`) : null;
        const newVehicleRef = newVehicleId ? db.doc(`transportVehicles/${newVehicleId}`) : null;
        const oldVehicleSnap = oldVehicleRef ? await transaction.get(oldVehicleRef) : null;
        const newVehicleSnap = newVehicleRef && newVehicleId !== oldVehicleId ? await transaction.get(newVehicleRef) : oldVehicleSnap;
        if (newVehicleRef) {
          if (!newVehicleSnap?.exists || newVehicleSnap.data()?.active === false || newVehicleSnap.data()?.companyId !== values.companyId) {
            throw new HttpsError("failed-precondition", "Select an active vehicle from the driver's company.");
          }
          const assignedDriverId = stringValue(newVehicleSnap.data()?.assignedDriverId);
          if (assignedDriverId && assignedDriverId !== target.id) {
            throw new HttpsError("already-exists", "This vehicle is already assigned to another driver.");
          }
        }
        transaction.set(target, payload, {merge: true});
        if (oldVehicleRef && oldVehicleId !== newVehicleId && oldVehicleSnap?.data()?.assignedDriverId === target.id) {
          transaction.set(oldVehicleRef, {
            assignedDriverId: FieldValue.delete(),
            assignedDriverName: FieldValue.delete(),
            updatedAt: now,
          }, {merge: true});
        }
        if (newVehicleRef) {
          transaction.set(newVehicleRef, {
            assignedDriverId: target.id,
            assignedDriverName: values.driverName,
            updatedAt: now,
          }, {merge: true});
        }
      });
    } else {
      await target.set(payload, {merge: true});
    }
    return {ok: true, id: target.id};
  },
);

export const initializeLegacyTransportBooking = onCall(
  {region: REGION, cors: true},
  async (request) => {
    await assertAdmin(request.auth);
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in is required.");
    const input = (request.data || {}) as Data;
    const kind = stringValue(input.bookingKind) as BookingKind;
    if (!Object.prototype.hasOwnProperty.call(BOOKING_COLLECTIONS, kind)) {
      throw new HttpsError("invalid-argument", "Unknown booking type.");
    }
    const bookingId = required(input, "bookingId", "Booking ID is required.");
    const source = stringValue(input.source) || "manual";
    const collectionName = collectionFor(kind, source);
    const ref = getFirestore().doc(`${collectionName}/${bookingId}`);
    await getFirestore().runTransaction(async (transaction) => {
      const snap = await transaction.get(ref);
      if (!snap.exists) throw new HttpsError("not-found", "Booking was not found.");
      const data = snap.data() || {};
      const finalAmount = bookingAmount(data);
      const received = Math.max(0, numberValue(data.amountReceived));
      transaction.set(ref, {
        bookingReference: data.bookingReference || `${kind.toUpperCase()}-${bookingId.slice(0, 8).toUpperCase()}`,
        bookingStatus: normalizeStatus(data),
        paymentStatus: stringValue(data.paymentStatus) || paymentStatus(finalAmount, received, 0),
        finalAmount,
        amountReceived: received,
        amountRefunded: Math.max(0, numberValue(data.amountRefunded)),
        remainingBalance: Math.max(0, finalAmount - received),
        paymentTransactions: Array.isArray(data.paymentTransactions) ? data.paymentTransactions : [],
        refundTransactions: Array.isArray(data.refundTransactions) ? data.refundTransactions : [],
        statusHistory: Array.isArray(data.statusHistory) ? data.statusHistory : [],
        activityHistory: Array.isArray(data.activityHistory) ? data.activityHistory : [],
        migratedAt: FieldValue.serverTimestamp(),
      }, {merge: true});
    });
    logger.info("Initialized legacy transport booking", {collectionName, bookingId});
    return {ok: true};
  },
);

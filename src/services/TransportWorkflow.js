import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "../firebase/firebase.config";

const functions = getFunctions(app, "asia-east2");
const mutateBooking = httpsCallable(functions, "manageTransportBooking");
const mutateResource = httpsCallable(functions, "manageTransportResource");
const initializeLegacy = httpsCallable(
  functions,
  "initializeLegacyTransportBooking"
);
const createManualVan = httpsCallable(functions, "createManualVanBooking");
const seedDemoData = httpsCallable(functions, "seedTransportDemoData");

const actionKey = (action) => {
  if (globalThis.crypto?.randomUUID) return `${action}:${crypto.randomUUID()}`;
  return `${action}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
};

export const runBookingAction = async (payload) => {
  const result = await mutateBooking({
    ...payload,
    idempotencyKey: payload.idempotencyKey || actionKey(payload.action),
  });
  return result.data;
};

export const saveTransportResource = async (resourceType, values, id = "") => {
  const result = await mutateResource({
    resourceType,
    action: "save",
    id,
    values,
  });
  return result.data;
};

export const archiveTransportResource = async (resourceType, id) => {
  const result = await mutateResource({ resourceType, action: "archive", id });
  return result.data;
};

export const initializeLegacyBooking = async (bookingKind, bookingId, source) => {
  const result = await initializeLegacy({ bookingKind, bookingId, source });
  return result.data;
};

export const createManualVanBooking = async (values) => {
  const result = await createManualVan(values);
  return result.data;
};

export const addTransportDemoData = async () => {
  const result = await seedDemoData();
  return result.data;
};

export const getWorkflowError = (error) => {
  const message = error?.details || error?.message || "Unable to save changes.";
  return String(message).replace(/^FirebaseError:\s*/i, "");
};

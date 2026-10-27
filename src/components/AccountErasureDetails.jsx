import {useEffect, useState} from "react";
import {collection, doc, getDoc, getDocs, limit, orderBy, query} from "firebase/firestore";
import {db} from "../firebase/firebase.config";

const explanations = {
  RETENTION_DEADLINE_REVIEW: "A future or invalid retention deadline must be reviewed before deletion.",
  ACCOUNTING_RETENTION_MAPPING_REQUIRED: "Accounting-linked evidence needs a documented retention period before disposal.",
  STORAGE_RETENTION_HOLD: "Storage has an active object hold or retention lock; preserved bytes are restricted.",
  RETENTION_HOLD: "A legal, retention, dispute or chargeback hold needs review.",
  HELD_ATTACHMENT_DEPENDENCY: "Preserved to protect held supporting evidence.",
  BUSINESS_RECORD_RETENTION_DECISION: "Decide which details are still necessary; document the basis and disposal date.",
  DERIVED_ORDER_COPY_RETENTION_DECISION: "Review this partner copy together with its original order.",
  UID_QUERY_LIMIT: "The record search reached its limit; complete the inventory before closing.",
  SUBCOLLECTION_INVENTORY_LIMIT: "Nested records need further inspection before deletion.",
  CONFLICTING_IDENTITY: "Ownership fields disagree; verify the owner before deletion.",
};
const dateText = value => value?.toDate?.().toLocaleString() || "Not recorded";

export default function AccountErasureDetails({uid}) {
  const [state, setState] = useState({loading: true});
  useEffect(() => {
    let active = true;
    setState({loading: true});
    if (!uid || uid.includes("/")) {setState({error: true}); return;}
    Promise.all([
      getDoc(doc(db, "privacyErasureJobs", uid)),
      getDocs(query(collection(db, "privacyErasureJobs", uid, "records"), orderBy("updatedAt", "desc"), limit(51))),
    ]).then(([job, records]) => {
      if (active) setState({job: job.data(), records: records.docs.map(item => ({id: item.id, ...item.data()}))});
    }).catch(() => {if (active) setState({error: true});});
    return () => {active = false;};
  }, [uid]);
  if (state.loading) return <p className="text-xs text-gray-500">Loading cleanup evidence…</p>;
  if (state.error) return <p role="alert" className="text-xs text-red-700">Cleanup evidence could not be loaded. Close and reopen these details to retry.</p>;
  if (!state.job) return <p className="text-xs text-amber-800">Cleanup has no recorded result yet. Check holds, account type and retry errors.</p>;
  const {job, records} = state;
  return <section className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
    <h4 className="font-semibold text-gray-900">Cleanup evidence and retained data</h4>
    <ul className="text-xs space-y-1 text-gray-700">
      <li>Profile: {job.profileErased === true ? "Removed" : "Preserved or not yet verified"}</li>
      <li>Supported uploads: {job.uploadsErased === true ? "Removed" : "Preserved or not yet verified"}</li>
      <li>Supported personal records: {job.operationalRecordsErased === true ? "Removed" : "Some records still need review"}</li>
      <li>Verified: {dateText(job.verifiedAt)}</li>
      <li>Next review: {dateText(job.reviewDueAt)} · Owner: {job.reviewOwner || "Admin"}</li>
    </ul>
    <p className="text-xs text-amber-900">This is scoped cleanup evidence. Bookings, orders, shared conversations, old uploads, provider copies, exports and backups require a documented decision before this request is complete. Keep necessary records only for a stated reason and period.</p>
    {job.inventoryComplete === false && <p role="alert" className="text-xs font-semibold text-red-700">The inventory is incomplete. Do not close this request.</p>}
    {records.length > 0 && <ul className="space-y-2 pt-1">{records.slice(0, 50).map(record => <li key={record.id} className="bg-white border rounded p-2 text-xs">
      <p className="font-mono break-all text-gray-700">{record.recordPath}</p>
      <p className="mt-1">{explanations[record.reason] || "Review the record and document its disposition."}</p>
    </li>)}</ul>}
    {records.length > 50 && <p className="text-xs text-red-700">Showing the first 50 review records. Further records remain in the protected case inventory.</p>}
  </section>;
}

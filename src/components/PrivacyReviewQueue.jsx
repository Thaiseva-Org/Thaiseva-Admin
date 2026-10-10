import {useEffect, useState} from "react";
import {collection, getDocs, limit, orderBy, query} from "firebase/firestore";
import {db} from "../firebase/firebase.config";

export default function PrivacyReviewQueue({refreshKey}) {
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.all([getDocs(query(collection(db, "privacyErasureJobs"), orderBy("updatedAt", "desc"), limit(50))), getDocs(query(collection(db, "privacyRetentionReviews"), orderBy("updatedAt", "desc"), limit(50)))])
      .then(snapshots => {
        if (active) {setJobs(snapshots.flatMap(snapshot => snapshot.docs.map(document => ({id: document.id, ...document.data()})))); setError(false);}
      }).catch(() => {if (active) setError(true);});
    return () => {active = false;};
  }, [refreshKey]);
  if (!jobs.length && !error) return null;
  return <section className="my-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
    <h3 className="font-semibold">Remaining data review</h3>
    <p className="my-2 text-sm">Removing a login does not finish data deletion. Review booking records, shared messages, old uploads, exports and backups. Keep required records only for a documented reason and period.</p>
    {error ? <p role="alert">Could not load the review queue. Refresh or try again.</p> :
      <ul className="space-y-3">{jobs.map(job => <li key={job.id} className="rounded border bg-white p-3 text-sm">
        <strong>{job.recordPath ? `Record: ${job.recordPath}` : `Customer: ${job.id}`}</strong>
        <p>{job.recordPath ? "Record needs a retention decision before cleanup." : job.status === "RETRY_REQUIRED" ? "Cleanup failed partway. Retry the original request after checking the cause." :
          job.status === "PROCESSING" ? "Cleanup is running. If this remains unchanged, check the server logs before retrying." : "Direct cleanup finished; remaining records need review."}</p>
        {job.reason && <p>Manual review needed: lifecycle date is missing.</p>}
        {job.remainingReview?.length > 0 && <p className="mt-1">Review: {job.remainingReview.join(", ")}</p>}
      </li>)}</ul>}
  </section>;
}

import { useEffect, useRef, useState } from 'react';
import { doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { db } from '../firebase/firebase.config';
import { isListingActive, listingStatusFields } from '../utils/listing-status';
export function useListingStatus(kind, records = []) {
  const [overrides, setOverrides] = useState({});
  const [pending, setPending] = useState({});
  const locks = useRef(new Set());
  useEffect(() => {
    const acknowledged = records.filter((record) => {
      const id = record.uid || record.id;
      return Object.hasOwn(overrides, id) && !pending[id] && isListingActive(record) === overrides[id];
    }).map((record) => record.uid || record.id);
    if (acknowledged.length) setOverrides((old) => {
      const next = { ...old };
      acknowledged.forEach((id) => delete next[id]);
      return next;
    });
  }, [records, overrides, pending]);
  const resolve = (record) => Object.hasOwn(overrides, record.uid || record.id) ? overrides[record.uid || record.id] : isListingActive(record);
  const toggle = async (record, active) => {
    const id = record.uid || record.id;
    if (!id || locks.current.has(id)) return false;
    if (kind === 'room' && !record.hotelUid) { toast.error('This room needs a linked hotel before its status can be updated.'); return false; }
    locks.current.add(id);
    const previous = resolve(record);
    setOverrides((old) => ({ ...old, [id]: active }));
    setPending((old) => ({ ...old, [id]: true }));
    try {
      const batch = writeBatch(db);
      const fields = { ...listingStatusFields(active), updatedAt: serverTimestamp() };
      if (kind === 'hotel') batch.update(doc(db, 'HotelDB', id), { ...fields, 'hotel.isActive': active, 'hotel.status': fields.status });
      else if (kind === 'tour') {
        batch.update(doc(db, 'sightseeingPackages', id), fields);
        batch.set(doc(db, 'sightseeingPackagesDetails', id), { ...record, ...fields }, { merge: true });
      } else {
        batch.set(doc(db, 'hotelPackageDetails', id), { ...record, ...fields }, { merge: true });
        batch.set(doc(db, 'HotelDB', record.hotelUid, 'rooms', id), { ...record, ...fields }, { merge: true });
      }
      await batch.commit();
      toast.success(`Listing is now ${active ? 'active' : 'inactive'}.`);
      return true;
    } catch (error) {
      setOverrides((old) => ({ ...old, [id]: previous }));
      toast.error('Status could not be saved. Please try again.');
      console.error('Listing status update failed:', error);
      return false;
    } finally {
      locks.current.delete(id);
      setPending((old) => ({ ...old, [id]: false }));
    }
  };
  return { resolve, toggle, pending };
}

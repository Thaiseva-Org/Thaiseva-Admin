import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { db, storage } from "../firebase/firebase.config";
import { DEFAULT_SITE_STATS } from "../data/websiteMediaSlots";

const COLLECTION_NAME = "image";

/**
 * Real-time listener for all media slots and dynamic statistics.
 * Automatically synchronizes with Firestore onSnapshot.
 * @param {Function} onUpdate - callback({ mediaMap, stats, rawDocs })
 * @param {Function} onError - error callback
 * @returns {Function} unsubscribe function
 */
export function subscribeToMedia(onUpdate, onError) {
  const colRef = collection(db, COLLECTION_NAME);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const mediaMap = {};
      let stats = { ...DEFAULT_SITE_STATS };
      const rawDocs = [];

      snapshot.docs.forEach((d) => {
        const data = d.data() || {};
        const id = d.id;
        rawDocs.push({ id, ...data });

        if (id === "stats") {
          stats = {
            ...DEFAULT_SITE_STATS,
            ...data,
            id: "stats",
          };
        } else {
          // Normalizes field names if needed
          const url =
            data.url ||
            data.imageUrl ||
            data.videoUrl ||
            data.downloadURL ||
            data.image ||
            data.src ||
            "";

          const status =
            data.status ||
            (data.isActive === false ? "inactive" : "active");

          mediaMap[id] = {
            id,
            ...data,
            url,
            status,
            isActive: status === "active" && data.isActive !== false,
          };
        }
      });

      onUpdate({ mediaMap, stats, rawDocs });
    },
    (err) => {
      console.error("[WebsiteMediaService] onSnapshot error:", err);
      if (onError) onError(err);
    }
  );
}

/**
 * One-time fetch of all media documents in the 'image' collection.
 */
export async function fetchMediaOnce() {
  const colRef = collection(db, COLLECTION_NAME);
  const snapshot = await getDocs(colRef);
  const mediaMap = {};
  let stats = { ...DEFAULT_SITE_STATS };

  snapshot.docs.forEach((d) => {
    const data = d.data() || {};
    const id = d.id;
    if (id === "stats") {
      stats = { ...DEFAULT_SITE_STATS, ...data, id: "stats" };
    } else {
      const url =
        data.url ||
        data.imageUrl ||
        data.videoUrl ||
        data.downloadURL ||
        data.image ||
        data.src ||
        "";
      const status =
        data.status ||
        (data.isActive === false ? "inactive" : "active");
      mediaMap[id] = {
        id,
        ...data,
        url,
        status,
        isActive: status === "active" && data.isActive !== false,
      };
    }
  });

  return { mediaMap, stats };
}

/**
 * Upload a media file (image or video) to Firebase Storage and save its reference to Firestore.
 * @param {string} slotId - e.g. 'hero', 'qr-payment', 'tours-hero-bg'
 * @param {File} file - File object from browser input
 * @param {Function} [onProgress] - optional callback({ percent, bytesTransferred, totalBytes })
 * @param {string} [status='active']
 */
export async function uploadMediaFile(
  slotId,
  file,
  onProgress = null,
  status = "active"
) {
  if (!slotId || !file) {
    throw new Error("A valid slot ID and file must be provided.");
  }

  // Sanitize filename and create storage path
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const fileExt = sanitizedName.split(".").pop() || "jpg";
  const storagePath = `site-media/${slotId}_${Date.now()}.${fileExt}`;
  const storageRef = ref(storage, storagePath);

  const uploadTask = uploadBytesResumable(storageRef, file);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      (snapshot) => {
        if (onProgress && snapshot.totalBytes > 0) {
          const percent = Math.round(
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          );
          onProgress({
            percent,
            bytesTransferred: snapshot.bytesTransferred,
            totalBytes: snapshot.totalBytes,
          });
        }
      },
      (error) => {
        console.error(`[WebsiteMediaService] Upload failed for ${slotId}:`, error);
        reject(error);
      },
      async () => {
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);

          // Update Firestore collection 'image'
          const docRef = doc(db, COLLECTION_NAME, slotId);
          await setDoc(
            docRef,
            {
              name: slotId,
              url: downloadUrl,
              imageUrl: downloadUrl,
              status: status,
              isActive: status === "active",
              storagePath: storagePath,
              originalFileName: file.name,
              fileSize: file.size,
              mimeType: file.type,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );

          resolve({
            success: true,
            slotId,
            url: downloadUrl,
            storagePath,
            status,
          });
        } catch (dbErr) {
          console.error(
            `[WebsiteMediaService] Error updating Firestore for ${slotId}:`,
            dbErr
          );
          reject(dbErr);
        }
      }
    );
  });
}

/**
 * Direct set of media URL without uploading a local file.
 * Useful for Unsplash URLs, CDN links, or existing storage links.
 */
export async function setMediaUrlDirect(slotId, url, status = "active") {
  if (!slotId) throw new Error("Slot ID is required.");
  const cleanUrl = (url || "").trim();
  if (!cleanUrl) throw new Error("Media URL cannot be empty.");

  const docRef = doc(db, COLLECTION_NAME, slotId);
  await setDoc(
    docRef,
    {
      name: slotId,
      url: cleanUrl,
      imageUrl: cleanUrl,
      status: status,
      isActive: status === "active",
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return { success: true, slotId, url: cleanUrl, status };
}

/**
 * Dynamic Active / Inactive switch.
 * When set to 'inactive', the frontend instantly falls back to the default asset
 * without needing to delete the uploaded image from Firestore.
 */
export async function toggleSlotStatus(slotId, isActive) {
  if (!slotId) throw new Error("Slot ID is required.");
  const status = isActive ? "active" : "inactive";
  const docRef = doc(db, COLLECTION_NAME, slotId);

  await setDoc(
    docRef,
    {
      status: status,
      isActive: Boolean(isActive),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return { success: true, slotId, status, isActive: Boolean(isActive) };
}

/**
 * Reverts slot to default fallback asset by setting status: 'inactive'.
 */
export async function revertSlotToDefault(slotId) {
  return toggleSlotStatus(slotId, false);
}

/**
 * Completely removes the custom document from Firestore, reverting to default.
 */
export async function removeCustomMediaDoc(slotId, storagePath = null) {
  if (!slotId) throw new Error("Slot ID is required.");

  if (storagePath) {
    try {
      const storageRef = ref(storage, storagePath);
      await deleteObject(storageRef);
    } catch (e) {
      console.warn(
        `[WebsiteMediaService] Could not remove storage file ${storagePath}:`,
        e
      );
    }
  }

  const docRef = doc(db, COLLECTION_NAME, slotId);
  await deleteDoc(docRef);
  return { success: true, slotId };
}

/**
 * Update dynamic site statistics counters in the 'stats' doc in the 'image' collection.
 */
export async function updateSiteStats(statsData, status = "active") {
  const docRef = doc(db, COLLECTION_NAME, "stats");

  const cleanData = {
    name: "stats",
    status: status,
    isActive: status === "active",
    activeUsers: String(statsData.activeUsers ?? "800+"),
    happyReviews: String(statsData.happyReviews ?? "600+"),
    appDownloads: String(statsData.appDownloads ?? "1000+"),
    appRating: String(statsData.appRating ?? "4.8"),
    happyTravelers: String(statsData.happyTravelers ?? "0+"),
    verifiedHotels: String(statsData.verifiedHotels ?? "5"),
    curatedTours: String(statsData.curatedTours ?? "1"),
    localPartners: String(statsData.localPartners ?? "0+"),
    updatedAt: serverTimestamp(),
  };

  await setDoc(docRef, cleanData, { merge: true });
  return { success: true, id: "stats", stats: cleanData };
}

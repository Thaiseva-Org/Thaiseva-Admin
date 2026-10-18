import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  attractionCategoryCollection,
  attractionCollection,
  clubCollection,
  db,
  shopCollection,
} from "../firebase/firebase.config";

export const DEFAULT_ATTRACTION_CATEGORIES = [
  {
    id: "shopping-malls",
    name: "Shopping Malls",
    slug: "shopping-malls",
    emoji: "🛍️",
    icon: "Shop",
    badgeColor: "#2563EB",
    order: 1,
    description: "Iconic shopping complexes, premium outlets, and lifestyle malls across Thailand",
    isActive: true,
  },
  {
    id: "clubs-nightlife",
    name: "Clubs & Nightlife",
    slug: "clubs-nightlife",
    emoji: "🍸",
    icon: "Nightlife",
    badgeColor: "#7C3AED",
    order: 2,
    description: "Famous nightclubs, rooftop lounges, beach clubs, and party hubs",
    isActive: true,
  },
  {
    id: "temples-culture",
    name: "Temples & Culture",
    slug: "temples-culture",
    emoji: "🛕",
    icon: "AccountBalance",
    badgeColor: "#D97706",
    order: 3,
    description: "Historic temples, royal shrines, and sacred cultural monuments",
    isActive: true,
  },
  {
    id: "night-markets",
    name: "Night Markets & Street Food",
    slug: "night-markets",
    emoji: "🍢",
    icon: "Storefront",
    badgeColor: "#DC2626",
    order: 4,
    description: "Bustling evening markets, local street food hubs, and souvenir walking streets",
    isActive: true,
  },
  {
    id: "beaches-islands",
    name: "Beaches & Viewpoints",
    slug: "beaches-islands",
    emoji: "🌴",
    icon: "BeachAccess",
    badgeColor: "#059669",
    order: 5,
    description: "Scenic beaches, tropical islands, and panoramic mountain viewpoints",
    isActive: true,
  },
  {
    id: "theme-water-parks",
    name: "Theme & Water Parks",
    slug: "theme-water-parks",
    emoji: "🎡",
    icon: "Attractions",
    badgeColor: "#EC4899",
    order: 6,
    description: "World-class water parks, amusement complexes, and family entertainment kingdoms",
    isActive: true,
  },
  {
    id: "wellness-spas",
    name: "Wellness & Thai Spas",
    slug: "wellness-spas",
    emoji: "💆",
    icon: "Spa",
    badgeColor: "#0D9488",
    order: 7,
    description: "Authentic Thai massage sanctuaries, luxury onsens, herbal steam treatments, and wellness retreats",
    isActive: true,
  },
  {
    id: "nature-wildlife",
    name: "Nature & Wildlife Sanctuaries",
    slug: "nature-wildlife",
    emoji: "🐘",
    icon: "Park",
    badgeColor: "#16A34A",
    order: 8,
    description: "Ethical elephant care sanctuaries, lush national parks, jungle waterfalls, and botanical gardens",
    isActive: true,
  },
  {
    id: "rooftops-dining",
    name: "Rooftop Lounges & Fine Dining",
    slug: "rooftops-dining",
    emoji: "🥂",
    icon: "Restaurant",
    badgeColor: "#EA580C",
    order: 9,
    description: "Sky-high cocktail lounges, Michelin-starred culinary venues, and riverside dining terraces",
    isActive: true,
  },
  {
    id: "adventure-sports",
    name: "Adventure & Marine Sports",
    slug: "adventure-sports",
    emoji: "🪂",
    icon: "SportsKabaddi",
    badgeColor: "#0284C7",
    order: 10,
    description: "Scuba diving expeditions, island parasailing, zip-line canopy tours, and world-class Muay Thai stadiums",
    isActive: true,
  },
];

/**
 * Fetch all attraction categories sorted by order
 */
export async function getAttractionCategories() {
  try {
    const q = query(attractionCategoryCollection, orderBy("order", "asc"));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return [];
    }
    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));
  } catch (error) {
    // If order index is missing, fallback to unscoped getDocs
    console.warn("Falling back to unordered category fetch:", error);
    const snapshot = await getDocs(attractionCategoryCollection);
    const list = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));
    return list.sort((a, b) => (a.order || 99) - (b.order || 99));
  }
}

/**
 * Seed initial default categories if the collection is empty
 */
export async function seedDefaultCategoriesIfEmpty() {
  const snapshot = await getDocs(query(attractionCategoryCollection, limit(1)));
  if (!snapshot.empty) {
    return false;
  }

  const batch = writeBatch(db);
  for (const cat of DEFAULT_ATTRACTION_CATEGORIES) {
    const docRef = doc(db, "attraction_categories", cat.id);
    batch.set(docRef, {
      ...cat,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
  return true;
}

/**
 * Save (create or update) an attraction category
 */
export async function saveAttractionCategory(categoryData, id = null) {
  const docId = id || categoryData.slug || categoryData.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const docRef = doc(db, "attraction_categories", docId);

  const payload = {
    ...categoryData,
    slug: docId,
    order: Number(categoryData.order) || 1,
    isActive: categoryData.isActive !== false,
    updatedAt: serverTimestamp(),
  };

  if (!id) {
    payload.createdAt = serverTimestamp();
    await setDoc(docRef, payload);
  } else {
    await updateDoc(docRef, payload);
  }

  return docId;
}

/**
 * Delete an attraction category
 */
export async function deleteAttractionCategory(categoryId) {
  // Check if any attractions are using this category
  const q = query(attractionCollection, where("categoryId", "==", categoryId), limit(1));
  const snap = await getDocs(q);
  if (!snap.empty) {
    throw new Error("Cannot delete category because there are attractions assigned to it. Reassign or delete those attractions first.");
  }

  await deleteDoc(doc(db, "attraction_categories", categoryId));
}

/**
 * Fetch attractions with optional category filter
 */
export async function getAttractionsList({ categoryId = "all" } = {}) {
  let q;
  if (categoryId && categoryId !== "all") {
    q = query(attractionCollection, where("categoryId", "==", categoryId));
  } else {
    q = query(attractionCollection);
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }));
}

/**
 * Save an attraction (create or update)
 */
export async function saveAttraction(attractionData, id = null) {
  const payload = {
    name: attractionData.name || "",
    categoryId: attractionData.categoryId || "shopping-malls",
    categoryName: attractionData.categoryName || "",
    description: attractionData.description || "",
    imageUrl: attractionData.imageUrl || "",
    address: attractionData.address || "",
    city: attractionData.city || "Bangkok",
    latitude: typeof attractionData.latitude === "number" ? attractionData.latitude : Number(attractionData.latitude) || 0,
    longitude: typeof attractionData.longitude === "number" ? attractionData.longitude : Number(attractionData.longitude) || 0,
    openingHours: attractionData.openingHours || "",
    contactNumber: attractionData.contactNumber || "",
    websiteUrl: attractionData.websiteUrl || "",
    visitorInstructions: attractionData.visitorInstructions || "",
    isFeatured: Boolean(attractionData.isFeatured),
    isActive: attractionData.isActive !== false,
    updatedAt: serverTimestamp(),
  };

  if (id) {
    const docRef = doc(db, "attractions", id);
    await updateDoc(docRef, payload);
    return id;
  }

  payload.createdAt = serverTimestamp();
  const docRef = await addDoc(attractionCollection, payload);
  return docRef.id;
}

/**
 * Delete an attraction
 */
export async function deleteAttraction(id) {
  await deleteDoc(doc(db, "attractions", id));
}

/**
 * Safely migrate existing legacy `shops` and `clubs` into `attractions`
 */
export async function migrateLegacyShopsAndClubs() {
  let migratedCount = 0;

  // 1. Ensure categories exist
  await seedDefaultCategoriesIfEmpty();

  // 2. Migrate Shops
  const shopsSnapshot = await getDocs(shopCollection);
  for (const shopDoc of shopsSnapshot.docs) {
    const data = shopDoc.data();
    // Check if already migrated
    const targetDocRef = doc(db, "attractions", `shop_${shopDoc.id}`);
    await setDoc(
      targetDocRef,
      {
        name: data.name || "",
        categoryId: "shopping-malls",
        categoryName: "Shopping Malls",
        description: data.description || "",
        imageUrl: data.imageUrl || "",
        address: data.address || "",
        city: data.city || "Bangkok",
        latitude: typeof data.latitude === "number" ? data.latitude : Number(data.latitude) || 0,
        longitude: typeof data.longitude === "number" ? data.longitude : Number(data.longitude) || 0,
        legacyId: shopDoc.id,
        legacySource: "shops",
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    migratedCount++;
  }

  // 3. Migrate Clubs
  const clubsSnapshot = await getDocs(clubCollection);
  for (const clubDoc of clubsSnapshot.docs) {
    const data = clubDoc.data();
    const targetDocRef = doc(db, "attractions", `club_${clubDoc.id}`);
    await setDoc(
      targetDocRef,
      {
        name: data.name || "",
        categoryId: "clubs-nightlife",
        categoryName: "Clubs & Nightlife",
        description: data.description || "",
        imageUrl: data.imageUrl || "",
        address: data.address || "",
        city: data.city || "Bangkok",
        latitude: typeof data.latitude === "number" ? data.latitude : Number(data.latitude) || 0,
        longitude: typeof data.longitude === "number" ? data.longitude : Number(data.longitude) || 0,
        legacyId: clubDoc.id,
        legacySource: "clubs",
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    migratedCount++;
  }

  return {
    migratedShops: shopsSnapshot.size,
    migratedClubs: clubsSnapshot.size,
    totalMigrated: migratedCount,
  };
}

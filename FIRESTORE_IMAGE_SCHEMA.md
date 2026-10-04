# Thaiseva Firestore Media, QR & Dynamic Stats Architecture (Admin Master Guide)

> [!NOTE]
> **Consolidated Specification:** This media, QR code, and site statistics architecture has been unified into the **[Firestore Data Architecture & Schema Dictionary (Section 2.6: Dynamic Website Media)](file:///d:/projects/Thaiseva-Admin-Portal-Web-App/docs/04-data/DATA_SCHEMA_DICTIONARY.md)** and the **[Third-Party Integrations Guide](file:///d:/projects/Thaiseva-Admin-Portal-Web-App/docs/03-api/THIRD_PARTY_INTEGRATIONS.md)**.

This document serves as an administrative operational guide for uploading and dynamically controlling all **Images**, **Videos**, **QR Codes**, and **Site Statistics** across the Thaiseva website.

---

## 1. Core Architecture & Firestore Setup

- **Collection Name**: `image`
- **Document ID**: Named exactly as the target Slot ID (e.g. `hero`, `about-leader-harish`, `qr-ios`, `tours-hero-bg`, `hotels-hero-bg`, `blogs-hero-bg`, `stats`).
- **Real-Time Sync**: All pages connect to Firestore using real-time listeners (`onSnapshot`). Whenever you change a document in the admin panel, the website updates **instantly in real time without refreshing**.
- **Safe Fallback**: If a document doesn't exist yet or its status is set to `inactive`, the site automatically falls back to the default asset or default counter numbers.

---

## 2. Document Data Schema ("What Saves as What")

### A. Media Documents (Images, Videos, QR Codes)
Every media document created in the `image` collection should follow this schema:

```json
{
  "name": "hero",
  "url": "https://firebasestorage.googleapis.com/... (Firebase Storage download URL)",
  "status": "active",
  "updatedAt": "Firestore server timestamp"
}
```

#### Supported Field Names
The website automatically recognizes any of these URL field names for maximum flexibility:
- **`url`** (Standard recommended field)
- `imageUrl`
- `videoUrl`
- `downloadURL`
- `src`
- `image`

---

### B. Site Statistics Document (`stats`)
Statistics counters for both the **Home Page** and the **About Us Page** can be controlled from a single document named **`stats`** inside the `image` collection:

```json
{
  "name": "stats",
  "status": "active",
  "activeUsers": "800+",
  "happyReviews": "600+",
  "appDownloads": "1000+",
  "appRating": "4.8",
  "happyTravelers": "0+",
  "verifiedHotels": "5",
  "curatedTours": "1",
  "localPartners": "0+",
  "updatedAt": "Firestore server timestamp"
}
```

> **Flexibility Note**: Values can be saved as numbers (e.g., `800`, `4.8`) or as formatted strings (e.g., `"800+"`, `"1,200+"`, `"4.8"`). The website will automatically parse the number for animated counters and preserve the suffix (like `+` or `%`).

---

## 3. Dynamic Status System (`status`)

Every media item and the statistics document have a **Dynamic Status** that can be toggled by the admin:

| Status Value | Website Behavior |
| :--- | :--- |
| **`"active"`** (default) | The website uses your uploaded custom URL or custom stats in real time. |
| **`"inactive"`** (or `isActive: false`) | The website temporarily disables the custom URL/stats and **instantly reverts to the built-in default asset/numbers** without having to delete the document from Firestore. |

### How to Toggle Status in Admin UI:
```javascript
import { db } from '@/components/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

// Turn any media slot or stats on/off dynamically:
async function toggleSlotStatus(slotId, isActive) {
    const docRef = doc(db, 'image', slotId);
    await updateDoc(docRef, {
        status: isActive ? 'active' : 'inactive',
        isActive: Boolean(isActive),
        updatedAt: serverTimestamp()
    });
}
```

---

## 4. Master Specification Table ("What Saves as What")

Here is the complete list of all dynamic slots across the website:

### A. Services Page (`/services`)

| Slot ID (Firestore Doc Name) | Media Type | Target Location | Default Asset (Fallback) | Description |
| :--- | :--- | :--- | :--- | :--- |
| **`hero`** | Image | Hero Section Visual Card | `/images/services-hero-blue.jpg` | Main prominent photo card in the blue hero section |
| **`heroBg`** | Image | Hero Background | `/images/About-us-bg.png` | Atmospheric background graphic behind hero |
| **`local-services`** | Image | Service Card 01 | Unsplash Concierge photo | Local services & on-ground assistance card |
| **`food`** | Image | Service Card 02 | Unsplash Pad Thai photo | Food delivery card |
| **`transport`** | Image | Service Card 03 | Unsplash Transport photo | Taxi transfers & car rentals combined card |
| **`hotel`** | Image | Service Card 04 | Unsplash Resort photo | Hotels & stays card |
| **`travel`** | Image | Service Card 05 | Unsplash Island photo | Tours & travel packages card |

---

### B. About Us Page (`/about`)

| Slot ID (Firestore Doc Name) | Media Type | Target Location | Default Asset (Fallback) | Description |
| :--- | :--- | :--- | :--- | :--- |
| **`about-hero-bg`** | Image | About Hero Background | `/images/About-us-bg.png` | Background behind hero skyline |
| **`about-leader-harish`** | Image | Leadership Team Card 1 | `harish-ceo.png` | Harish Tiwari (CEO & Founder) portrait |
| **`about-leader-ryan`** | Image | Leadership Team Card 2 | Unsplash Executive photo | Ryan P. (Marketing Director) portrait |
| **`about-leader-neha`** | Image | Leadership Team Card 3 | `neha-shukla.png` | Neha Shukla (Overseas Manager) portrait |

---

### C. Home Page (`/`)

| Slot ID (Firestore Doc Name) | Media Type | Target Location | Default Asset (Fallback) | Description |
| :--- | :--- | :--- | :--- | :--- |
| **`home-hero-bg`** | Image | Home Hero Background | `/images/home-hero-background.jpg` | Base scenic background of the home hero |
| **`home-hero-overlay`** | Image | Home Hero Overlay | `/images/home-hero-overlay.png` | Blue gradient overlay on home hero |
| **`home-dmc-partner`** | Image | Best DMC Partner Section | `dmc-partner.jpg` | Portrait image in "Your Trusted Thailand DMC" |
| **`home-action-video`** | Video (`.mp4`/`.webm`) | "See Thaiseva in Action" | `coverr-tropical-beach-3382/720p.mp4` | Video playback in the interactive scroll section |
| **`home-action-poster`** | Image | Video Thumbnail Poster | Unsplash Tropical Poster | Video cover image before play |

---

### D. QR Codes (App Downloads & Payments)

| Slot ID (Firestore Doc Name) | Media Type | Target Location | Default Asset (Fallback) | Description |
| :--- | :--- | :--- | :--- | :--- |
| **`qr-ios`** | QR Image (`.png`/`.svg`) | App Download Modal & Banner | `/app-qr-ios.png` | App Store iOS scan-to-download QR code |
| **`qr-android`** | QR Image (`.png`/`.svg`) | App Download Modal & Banner | `/app-qr-android.png` | Google Play Android scan-to-download QR code |
| **`qr-app`** | QR Image (`.png`/`.svg`) | App Download (Universal) | Platform default | General QR code used for both iOS & Android |
| **`qr-payment`** | QR Image (`.jpeg`/`.png`) | Checkout & Profile Payment | `/thaiseva-qr.jpeg` | Official Thai PromptPay / Bank Transfer QR Code |

---

### E. Packages / Tours Hero Background (`/tours`)

| Slot ID (Firestore Doc Name) | Media Type | Target Location | Default Asset (Fallback) | Description |
| :--- | :--- | :--- | :--- | :--- |
| **`tours-hero-bg`** | Image | Tours Page Hero Header | Unsplash Thailand Temple Hero | Background hero banner at top of `/tours` |

*Aliases accepted*: `packages-hero-bg`, `tour-hero-bg`, `package-hero-bg`

---

### F. Hotels / Stays Hero Background (`/stays`)

| Slot ID (Firestore Doc Name) | Media Type | Target Location | Default Asset (Fallback) | Description |
| :--- | :--- | :--- | :--- | :--- |
| **`hotels-hero-bg`** | Image | Hotels Page Hero Header | `/images/hotel-banner.webp` | Background hero banner at top of `/stays` |

*Aliases accepted*: `stays-hero-bg`, `hotel-hero-bg`, `stay-hero-bg`

---

### G. Blogs Hero Background (`/blogs`)

| Slot ID (Firestore Doc Name) | Media Type | Target Location | Default Asset (Fallback) | Description |
| :--- | :--- | :--- | :--- | :--- |
| **`blogs-hero-bg`** | Image | Blogs Page Hero Header | Unsplash Bangkok Skyline Hero | Background hero banner at top of `/blogs` |

*Aliases accepted*: `blog-hero-bg`, `blogs-hero`

---

### H. Site Statistics Counters (`stats`)

| Slot ID (Firestore Doc Name) | Data Type | Target Page | Target Element | Default Value | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`stats`** | JSON Document | Home & About | Counters | Below | Consolidated site statistics document |
| ↳ `activeUsers` | Number or String | Home (`/`) | Stats Strip | `800+` | Total active users counter |
| ↳ `happyReviews` | Number or String | Home (`/`) | Stats Strip | `600+` | Customer reviews counter |
| ↳ `appDownloads` | Number or String | Home (`/`) | Stats Strip | `1000+` | Total app downloads counter |
| ↳ `appRating` | Number or String | Home (`/`) | Stats Strip | `4.8` | App Store & Play Store rating |
| ↳ `happyTravelers` | Number or String | About (`/about`) | Frame 6 Stats Bar | `0+` | Happy travelers served |
| ↳ `verifiedHotels` | Number or String | About (`/about`) | Frame 6 Stats Bar | `5` (or DB count) | Verified hotel partners |
| ↳ `curatedTours` | Number or String | About (`/about`) | Frame 6 Stats Bar | `1` (or DB count) | Curated sightseeing tours |
| ↳ `localPartners` | Number or String | About (`/about`) | Frame 6 Stats Bar | `0+` | Local ground partners |

---

## 5. Admin Side Code Implementation

### Step 1: Upload File to Firebase Storage & Save to Firestore

```javascript
import { db, storage } from '@/components/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Upload an image, video, or QR code and save it to the 'image' collection
 * @param {string} slotId - e.g. 'hero', 'qr-payment', 'tours-hero-bg', 'hotels-hero-bg', 'blogs-hero-bg'
 * @param {File} file - The file from <input type="file" />
 * @param {string} status - 'active' or 'inactive' (default 'active')
 */
export async function uploadAndSaveMedia(slotId, file, status = 'active') {
    if (!slotId || !file) {
        throw new Error('Please select a slot and choose a file.');
    }

    // 1. Upload to Firebase Storage
    const fileExt = file.name.split('.').pop();
    const storagePath = `site-media/${slotId}_${Date.now()}.${fileExt}`;
    const storageRef = ref(storage, storagePath);

    const uploadResult = await uploadBytes(storageRef, file);
    const downloadUrl = await getDownloadURL(uploadResult.ref);

    // 2. Save document to Firestore collection 'image'
    const docRef = doc(db, 'image', slotId);
    await setDoc(
        docRef,
        {
            name: slotId,
            url: downloadUrl,
            status: status,
            isActive: status === 'active',
            storagePath: storagePath,
            updatedAt: serverTimestamp()
        },
        { merge: true }
    );

    return {
        success: true,
        slotId,
        url: downloadUrl,
        status
    };
}
```

---

### Step 2: Set URL Directly Without Uploading a File

```javascript
import { db } from '@/components/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

export async function setMediaUrl(slotId, url, status = 'active') {
    const docRef = doc(db, 'image', slotId);
    await setDoc(
        docRef,
        {
            name: slotId,
            url: url.trim(),
            status: status,
            isActive: status === 'active',
            updatedAt: serverTimestamp()
        },
        { merge: true }
    );
    return { success: true, slotId, url, status };
}
```

---

### Step 3: Save / Update Dynamic Site Statistics

```javascript
import { db } from '@/components/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Save or update site statistics
 * @param {Object} statsData - Stats numbers/strings
 * @param {string} status - 'active' or 'inactive'
 */
export async function updateSiteStats(statsData, status = 'active') {
    const docRef = doc(db, 'image', 'stats');
    await setDoc(
        docRef,
        {
            name: 'stats',
            status: status,
            isActive: status === 'active',
            activeUsers: statsData.activeUsers ?? '800+',
            happyReviews: statsData.happyReviews ?? '600+',
            appDownloads: statsData.appDownloads ?? '1000+',
            appRating: statsData.appRating ?? '4.8',
            happyTravelers: statsData.happyTravelers ?? '0+',
            verifiedHotels: statsData.verifiedHotels ?? '5',
            curatedTours: statsData.curatedTours ?? '1',
            localPartners: statsData.localPartners ?? '0+',
            updatedAt: serverTimestamp()
        },
        { merge: true }
    );
    return { success: true, id: 'stats', status };
}
```

---

### Step 4: Using the Next.js REST API Endpoint

If your admin panel communicates via HTTP fetch:

#### Update a Single Image / Video / QR / Hero Background:
```http
POST /api/services/images
Content-Type: application/json

{
  "name": "tours-hero-bg",
  "url": "https://firebasestorage.googleapis.com/.../new-tours-banner.jpg",
  "status": "active"
}
```

#### Update Site Statistics:
```http
POST /api/services/images
Content-Type: application/json

{
  "name": "stats",
  "activeUsers": "1,200+",
  "happyReviews": "950+",
  "appDownloads": "2,500+",
  "appRating": "4.9",
  "happyTravelers": "500+",
  "verifiedHotels": "25",
  "curatedTours": "18",
  "localPartners": "40+",
  "status": "active"
}
```

#### Fetch All Current Media & Statistics:
```http
GET /api/services/images
```

Response:
```json
{
  "success": true,
  "collection": "image",
  "images": {
    "hero": "https://...",
    "tours-hero-bg": "https://...",
    "hotels-hero-bg": "https://...",
    "blogs-hero-bg": "https://...",
    "qr-payment": "https://..."
  },
  "statuses": {
    "tours-hero-bg": "active",
    "hotels-hero-bg": "active",
    "blogs-hero-bg": "active",
    "stats": "active"
  },
  "stats": {
    "activeUsers": "1,200+",
    "happyReviews": "950+",
    "appRating": "4.9"
  }
}
```

---

## 6. Real-Time Verification Checklist

1. **Upload or change an image/QR code in the admin panel**:
   - Check the **Packages / Tours Page** (`/tours`) -> hero background updates immediately.
   - Check the **Hotels / Stays Page** (`/stays`) -> hero background updates immediately.
   - Check the **Blogs Page** (`/blogs`) -> hero background updates immediately.
   - Check the **Services Page** (`/services`) -> hero and cards update immediately.
   - Check the **About Us Page** (`/about`) -> leadership photos, hero background, and counters update immediately.
   - Check the **Home Page** (`/`) -> hero background, DMC partner photo, action video, and stats counters update immediately.
   - Check **App Download QR Codes** (in download banner or modal) -> updates immediately.
   - Check **Payment QR Code** (in checkout or profile booking pay modal) -> updates immediately.
2. **Toggle status to `inactive`**:
   - The site immediately switches back to the default asset or default counter numbers.
3. **Toggle status back to `active`**:
   - The site immediately displays your custom uploaded URL or custom stats again.

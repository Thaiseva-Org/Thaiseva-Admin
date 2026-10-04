# Quick Integration Guide: Connecting Website to Thaiseva Media & Stats

> [!NOTE]
> **Consolidated Specification:** This consumer website media guide and hook implementation have been unified into **[Third-Party Integrations Guide (Section 4: Consumer Website Integration)](file:///d:/projects/Thaiseva-Admin-Portal-Web-App/docs/03-api/THIRD_PARTY_INTEGRATIONS.md)** and the **[Firestore Data Architecture & Schema Dictionary (Section 2.6: Dynamic Website Media)](file:///d:/projects/Thaiseva-Admin-Portal-Web-App/docs/04-data/DATA_SCHEMA_DICTIONARY.md)**.

This guide explains how to connect the consumer website (frontend) to the Admin Portal's dynamic media and statistics in Firestore.

---

## 1. Core Concepts

- **Firestore Collection**: `image`
- **Real-Time Sync**: Connect using `onSnapshot` to update images and stats instantly when modified in the admin dashboard without reloading.
- **Automatic Fallback**: If an image is toggled to `inactive` in the admin panel or hasn't been uploaded yet, the website seamlessly falls back to built-in local assets.

---

## 2. Drop-in React Hook (`useWebsiteMedia.js`)

Copy this file into your website project (e.g. `src/hooks/useWebsiteMedia.js`):

```javascript
import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
// Replace with your project's Firebase db instance
import { db } from '@/firebase/config';

export function useWebsiteMedia() {
  const [mediaMap, setMediaMap] = useState({});
  const [siteStats, setSiteStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'image'),
      (snapshot) => {
        const map = {};
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (doc.id === 'stats') {
            setSiteStats(data);
          } else {
            map[doc.id] = data;
          }
        });
        setMediaMap(map);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching website media:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  /**
   * Returns active URL if status is active, otherwise returns fallback
   */
  const getMediaUrl = (slotId, fallbackUrl = '') => {
    const record = mediaMap[slotId];
    if (record && record.status === 'active' && record.isActive !== false && record.url) {
      return record.url;
    }
    return fallbackUrl;
  };

  return { mediaMap, siteStats, getMediaUrl, loading };
}
```

---

## 3. How to Use in Components

```jsx
import React from 'react';
import { useWebsiteMedia } from '@/hooks/useWebsiteMedia';

export default function MyPage() {
  const { getMediaUrl, siteStats } = useWebsiteMedia();

  // 1. Dynamic Hero Banner with local fallback
  const toursHeroBg = getMediaUrl(
    'tours-hero-bg',
    '/images/default-tours-hero.jpg'
  );

  // 2. Dynamic Payment QR code
  const paymentQr = getMediaUrl(
    'qr-payment',
    '/images/default-thaiseva-qr.jpeg'
  );

  return (
    <div>
      {/* Hero Banner */}
      <section 
        className="hero" 
        style={{ backgroundImage: `url(${toursHeroBg})` }}
      >
        <h1>Explore Tours</h1>
      </section>

      {/* QR Code */}
      <img src={paymentQr} alt="Scan to Pay" width={200} height={200} />

      {/* Dynamic Statistics */}
      {siteStats && (
        <div className="stats">
          <span>Active Users: {siteStats.activeUsers || '800+'}</span>
          <span>Reviews: {siteStats.happyReviews || '600+'}</span>
          <span>Rating: {siteStats.appRating || '4.8'}</span>
        </div>
      )}
    </div>
  );
}
```

---

## 4. Slot ID Reference ("What Maps to What")

### Hero Banners & Page Backgrounds
| Slot ID | Location | Target Page |
| :--- | :--- | :--- |
| `tours-hero-bg` | Top Hero Header Banner | `/tours` |
| `hotels-hero-bg` | Top Hero Header Banner | `/stays` |
| `blogs-hero-bg` | Top Hero Header Banner | `/blogs` |
| `home-hero-bg` | Scenic Hero Background | `/` (Home) |
| `home-hero-overlay` | Blue Gradient Overlay | `/` (Home) |
| `about-hero-bg` | Skyline Header Background | `/about` |

### QR Codes
| Slot ID | Description | Default Fallback |
| :--- | :--- | :--- |
| `qr-payment` | PromptPay / Bank Transfer QR | `/thaiseva-qr.jpeg` |
| `qr-ios` | App Store Download QR | `/app-qr-ios.png` |
| `qr-android` | Google Play Download QR | `/app-qr-android.png` |

### Dynamic Statistics (`doc.id === 'stats'`)
| Field Name | Target | Default |
| :--- | :--- | :--- |
| `activeUsers` | Home Stats Strip | `800+` |
| `happyReviews` | Home Stats Strip | `600+` |
| `appDownloads` | Home Stats Strip | `1000+` |
| `appRating` | Home Stats Strip | `4.8` |
| `happyTravelers` | About Us Stats | `0+` |
| `verifiedHotels` | About Us Stats | `5` |
| `curatedTours` | About Us Stats | `1` |
| `localPartners` | About Us Stats | `0+` |

---

## 5. REST API Alternative (Next.js / Express)

If your website uses backend routes or SSR instead of client-side Firestore listeners:

```http
GET /api/services/images
```

Response JSON:
```json
{
  "success": true,
  "images": {
    "tours-hero-bg": "https://firebasestorage.googleapis.com/...",
    "hotels-hero-bg": "https://firebasestorage.googleapis.com/...",
    "qr-payment": "https://firebasestorage.googleapis.com/..."
  },
  "statuses": {
    "tours-hero-bg": "active",
    "hotels-hero-bg": "active"
  },
  "stats": {
    "activeUsers": "1,200+",
    "happyReviews": "950+",
    "appRating": "4.9"
  }
}
```

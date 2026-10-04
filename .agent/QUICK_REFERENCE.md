# Admin Dashboard Quick Reference Guide

> [!NOTE]
> **Consolidated Specification:** This quick reference guide has been unified into the authoritative **[Admin & Partner Operations User Manual](file:///d:/projects/Thaiseva-Admin-Portal-Web-App/docs/07-user-guides/ADMIN_USER_MANUAL.md)** and the **[`/docs` Hub](file:///d:/projects/Thaiseva-Admin-Portal-Web-App/docs/README.md)**.

## 🚀 Quick Navigation Map

### How to Find Any Feature

**Want to manage hotels?**
→ Sidebar: "Hotel Related" → "Hotels"
→ Route: `/dashboard/hotels`
→ Component: `pages/dashboard/adminDashboard/ourPartners/Hotels.jsx`

**Want to see bookings?**
→ Sidebar: "Hotel Related" → "Room Bookings" (for hotels)
→ Sidebar: "Travel Related" → "Sightseeing Bookings" (for travel)
→ Routes: `/dashboard/room-bookings`, `/dashboard/travel-bookings`

**Want to chat with customers?**
→ Sidebar: "Local Assistance" → "Customer Chat"
→ Route: `/dashboard/customer-chat`

**Want to manage notifications?**
→ Sidebar: "Primary Links" → "Manage Notifications"
→ Route: `/dashboard/notifications`

---

## 📊 Data Flow Patterns

### Pattern 1: Real-time Data (Partners, Bookings)
```
Firebase Collection (onSnapshot)
    ↓
PartnerProvider Context
    ↓
Dashboard Component
    ↓
UI Display
```

### Pattern 2: Paginated Data (Records, Users)
```
User Action (page change)
    ↓
Service Function (fetchBookings)
    ↓
Firestore Query (with cursor)
    ↓
Component State Update
    ↓
UI Display
```

### Pattern 3: Chat Messages
```
Firebase chatRooms Collection
    ↓
AdminChatProvider/PartnerChatProvider
    ↓
Chat Component
    ↓
Real-time Message Display
```

---

## 🔑 Key Context Providers

### When to use which provider?

**AuthProvider** - Use for:
- Checking user role (isAdmin, isPartner)
- Getting current user data
- Authentication state

**PartnerProvider** - Use for:
- Partner lists (hotels, restaurants, local partners)
- Booking data (room, travel, car, self-drive)
- Chat counts
- Partner status filtering

**RequirementsProvider** - Use for:
- Customer requirements
- Local/travel requirements

**NotificationsProvider** - Use for:
- Push notifications
- Unread notification counts

**StatisticsProvider** - Use for:
- Dashboard analytics
- Revenue data
- Booking statistics

---

## 🗂️ Firebase Collections Cheat Sheet

### User Management
- `users` - Customer accounts
- `agents` - Agent accounts
- `partners` - Service partners

### Partners
- `hotels` - Hotel partners
- `restaurants` - Restaurant partners
- `shops` - Shopping malls
- `clubs` - Nightlife venues

### Services
- `localServices` - Local assistance services
- `sightseeingPackages` - Travel packages
- `sightseeingPackagesDetails` - Package details
- `hotelPackages` - Room packages
- `hotelPackageDetails` - Room details
- `carDetails` - Taxi/car services

### Bookings
- `hotelBookingData` - Room bookings
- `travelBookingDetails` - Sightseeing bookings
- `car_bookings` - Taxi bookings
- `self_driving_bookings` - Self-drive bookings

### Communication
- `chatRooms` - Chat room metadata
- `chats` - Chat messages
- `allRequirements` - Customer requirements
- `travelRequirements` - Travel requirements

### Content
- `notifications` - Push notifications
- `foodMenu` - Restaurant menus
- `coupons` - Discount coupons

### Analytics
- `statistics` - General stats
- `hotel_statistics` - Hotel-specific stats
- `partner_invoices` - Payment records

---

## 🛠️ Common Development Tasks

### Task: Add a new navigation item

1. **Define the route** in `src/routes/Route.jsx`:
```javascript
{
  path: "/dashboard/my-new-feature",
  element: (
    <AdminRoute>
      <MyNewFeature />
    </AdminRoute>
  ),
}
```

2. **Add to navigation links** in `src/utils/RouteLinks.jsx`:
```javascript
export const newprimaryLinks = [
  // ... existing links
  {
    icon: <MyIcon />,
    link: "/dashboard/my-new-feature",
    label: "My New Feature"
  }
];
```

3. **Create the component** in `src/pages/dashboard/adminDashboard/`:
```javascript
// MyNewFeature.jsx
export default function MyNewFeature() {
  return <div>My New Feature</div>;
}
```

4. **Export from index** in `src/pages/index.js`:
```javascript
export { default as MyNewFeature } from "./dashboard/adminDashboard/MyNewFeature";
```

### Task: Fetch data from Firebase

**Option 1: Real-time (use in Context Provider)**
```javascript
import { onSnapshot } from "firebase/firestore";
import { myCollection } from "../firebase/firebase.config";

useEffect(() => {
  const unsubscribe = onSnapshot(myCollection, (snapshot) => {
    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    setMyData(data);
  });
  
  return () => unsubscribe();
}, []);
```

**Option 2: One-time fetch (use in Service)**
```javascript
import { getDocs, query, where } from "firebase/firestore";
import { myCollection } from "../firebase/firebase.config";

export const fetchMyData = async (filters) => {
  const q = query(
    myCollection,
    where("status", "==", filters.status)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};
```

### Task: Add a new Firebase collection

1. **Define in firebase.config.js**:
```javascript
const myNewCollection = collection(db, "myNewCollection");

export {
  // ... existing exports
  myNewCollection,
};
```

2. **Use in service or provider**:
```javascript
import { myNewCollection } from "../firebase/firebase.config";
```

### Task: Add a badge count to navigation

1. **Get count from Context** (e.g., PartnerProvider)
2. **Update RouteLinks.jsx** if needed
3. **Add badge in Dashboard.jsx**:
```javascript
{route.url === "/dashboard/my-feature" && (
  <Badge color="primary" badgeContent={`${myCount}`} />
)}
```

---

## 🔒 Route Guard Usage

### AdminRoute
Use for features only admins/sub-admins can access:
```javascript
<AdminRoute>
  <MyAdminFeature />
</AdminRoute>
```

### HeadAdminRoute
Use for features only head admin can access (e.g., Sub Admins):
```javascript
<HeadAdminRoute>
  <SubAdmins />
</HeadAdminRoute>
```

### PartnerRoute
Use for partner-specific features:
```javascript
<PartnerRoute>
  <MyServices />
</PartnerRoute>
```

### PrivetRouter
Use for any authenticated user:
```javascript
<PrivetRouter>
  <Dashboard />
</PrivetRouter>
```

---

## 📱 Component Naming Conventions

### Pages
- Location: `src/pages/dashboard/adminDashboard/`
- Pattern: `[FeatureName].jsx` (PascalCase)
- Example: `RoomBookings.jsx`, `Hotels.jsx`

### Components
- Location: `src/components/`
- Pattern: `[ComponentName].jsx` (PascalCase)
- Example: `SearchBar.jsx`, `ActionButtons.jsx`

### Services
- Location: `src/services/`
- Pattern: `[ServiceName].js` (PascalCase)
- Example: `Bookings.js`, `LocalRelated.js`

### Context Providers
- Location: `src/contextAPIs/`
- Pattern: `[Name]Provider.jsx` (PascalCase)
- Example: `AuthProvider.jsx`, `PartnerProvider.jsx`

---

## 🎨 Styling Guidelines

### TailwindCSS Classes (Primary)
```javascript
<div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-md">
```

### Material-UI Components
```javascript
import { Button, TextField } from "@mui/material";

<Button variant="contained" color="primary">
  Click Me
</Button>
```

### Custom CSS Variables (Dashboard theme)
```css
--primary-bg: /* Primary background */
--secondary-bg: /* Secondary background */
--drawer-inactive-color: /* Inactive menu item */
--drawer-hover-color: /* Menu hover state */
--drawer-heading-color: /* Section heading */
```

---

## 🐛 Common Issues & Solutions

### Issue: Route not working
**Solution**: 
1. Check route is defined in `Route.jsx`
2. Verify component is exported in `pages/index.js`
3. Ensure correct route guard is used

### Issue: Data not updating
**Solution**:
1. Check if using real-time listener (onSnapshot) or one-time fetch
2. Verify Firebase collection name matches
3. Check context provider is wrapping the component

### Issue: Navigation item not showing
**Solution**:
1. Verify link is added to correct array in `RouteLinks.jsx`
2. Check if role-based (isAdmin, isPartner) condition is met
3. Ensure icon is imported in `utils/Icons.jsx`

### Issue: Badge count not updating
**Solution**:
1. Verify count is coming from correct context provider
2. Check real-time listener is active
3. Ensure badge is conditionally rendered in `Dashboard.jsx`

---

## 📦 Import Shortcuts

### Common Imports
```javascript
// Firebase
import { db, myCollection } from "../firebase/firebase.config";
import { getDocs, query, where, onSnapshot } from "firebase/firestore";

// Context
import { useContext } from "react";
import { AuthContext } from "../contextAPIs/AuthProvider";
import { PartnerContext } from "../contextAPIs/PartnerProvider";

// Components
import Loading from "../components/Loading";
import SearchBar from "../components/SearchBar";
import PageHeading from "../components/PageHeading";

// MUI
import { Button, TextField, Badge } from "@mui/material";

// Icons
import { HomeIcon, NotificationsRounded } from "../utils/Icons";

// Router
import { Link, useNavigate } from "react-router-dom";
```

---

## 🔍 Debugging Tips

### Check user role
```javascript
const { isAdmin, isSubAdmin, isPartner, userData } = useContext(AuthContext);
console.log({ isAdmin, isSubAdmin, isPartner, userData });
```

### Check context data
```javascript
const { partners, hotels, roomBookings } = useContext(PartnerContext);
console.log({ partners, hotels, roomBookings });
```

### Check route params
```javascript
import { useLocation, useParams } from "react-router-dom";

const location = useLocation();
const params = useParams();
console.log({ location, params });
```

### Monitor Firebase queries
```javascript
const q = query(myCollection, where("status", "==", "active"));
console.log("Query:", q);

const snapshot = await getDocs(q);
console.log("Results:", snapshot.docs.length);
```

---

## 📚 File Structure Reference

```
src/
├── pages/
│   └── dashboard/
│       └── adminDashboard/
│           ├── AdminDashboard.jsx (Main dashboard)
│           ├── adminStatistics/ (Analytics)
│           ├── clientOrders/ (Bookings)
│           ├── notifications/ (Push notifications)
│           ├── ourPartners/ (Hotels, Restaurants)
│           ├── ourServices/ (Room, Travel, Local services)
│           ├── requirements/ (Customer requirements)
│           ├── subAdmins/ (Admin management)
│           ├── todayBookingData/ (Daily records)
│           └── userData/ (User management)
│
├── components/ (62 reusable components)
│   ├── Banner components (8 files)
│   ├── Form components (4 files)
│   ├── Chart components (2 files)
│   └── Utility components (48 files)
│
├── contextAPIs/ (7 providers)
│   ├── AuthProvider.jsx
│   ├── PartnerProvider.jsx (largest - 20KB)
│   ├── RequirementsProvider.jsx
│   ├── NotificationsProvider.jsx
│   ├── StatisticsProvider.jsx
│   ├── AdminChatProvider.jsx
│   └── PartnerChatProvider.jsx
│
├── services/ (8 service files)
│   ├── Bookings.js
│   ├── LocalRelated.js
│   ├── UserRecords.js
│   ├── DailyRecords.js
│   ├── Earning.js
│   ├── Notification.js
│   ├── AdminDashboard.js
│   └── DataEncrypter.js
│
├── routes/ (5 route files)
│   ├── Route.jsx (main routes)
│   ├── PrivetRouter.jsx
│   ├── AdminRoute.jsx
│   ├── PartnerRoute.jsx
│   └── HeadAdminRoute.jsx
│
└── utils/
    ├── RouteLinks.jsx (navigation definitions)
    ├── Icons.jsx (icon exports)
    └── constants.js (app constants)
```

---

*Quick Reference Guide - Thaiseva Admin Dashboard*
*Last Updated: 2025-11-23*

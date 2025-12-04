# Thaiseva Admin Dashboard - Technical Architecture Guide

> **Developer's Guide**: A comprehensive technical overview of the Admin Dashboard architecture, routing, component hierarchy, and data persistence layer.

---

## Table of Contents
1. [Routing Architecture](#1-routing-architecture)
2. [Component Hierarchy & Navigation](#2-component-hierarchy--navigation)
3. [Data Models & Persistence](#3-data-models--persistence)
4. [State Management Architecture](#4-state-management-architecture)
5. [Authentication & Authorization Flow](#5-authentication--authorization-flow)
6. [Data Flow Patterns](#6-data-flow-patterns)

---

## 1. Routing Architecture

### 1.1 Entry Point Flow

```
User Access
    ↓
main.jsx (Application Bootstrap)
    ↓
RouterProvider (React Router v6)
    ↓
Route Evaluation
    ↓
┌─────────────────────────────────────┐
│ Is user authenticated?              │
│ (checked by PrivetRouter)           │
└─────────────────────────────────────┘
    ↓ NO                    ↓ YES
Navigate to /login    Check User Role
                            ↓
                ┌───────────┴───────────┐
                ↓                       ↓
            isAdmin/isSubAdmin      isPartner
                ↓                       ↓
        Admin Dashboard Routes   Partner Dashboard Routes
```

### 1.2 Route Structure Breakdown

**File**: `src/routes/Route.jsx`

#### Root Level Routes

```javascript
// Route Configuration
createBrowserRouter([
  { path: "/", element: <Main /> },                    // Public landing
  { path: "/dashboard", element: <PrivetRouter><Dashboard /></PrivetRouter> },
  { path: "/login", element: <Login /> },
  { path: "/partner-onboarding", element: <PartnerOnboarding /> },
  { path: "/hotel-onboarding", element: <HotelOnboarding /> },
  { path: "*", element: <NotFound /> }
])
```

#### Admin Dashboard Route Tree

```
/dashboard (Protected by PrivetRouter)
├── Layout: Dashboard.jsx (MUI Drawer + AppBar)
│
├── PRIMARY SECTION (AdminRoute Guard)
│   ├── /dashboard → AdminDashboard.jsx
│   ├── /dashboard/notifications → NewNotficationsScreen.jsx
│   ├── /dashboard/admin-statistics → AdminStatistics.jsx (+ StatisticsProvider)
│   ├── /dashboard/bookings-record → TodayBookings.jsx
│   ├── /dashboard/user-data → UserData.jsx
│   └── /dashboard/sub-admins → SubAdmins.jsx (HeadAdminRoute)
│
├── HOTEL SECTION (AdminRoute Guard)
│   ├── /dashboard/hotels → Hotels.jsx
│   ├── /dashboard/room-services → RoomServices.jsx
│   ├── /dashboard/room-bookings → RoomBookings.jsx
│   └── /dashboard/hotel-chat → HotelSupport.jsx
│
├── TRAVEL SECTION (AdminRoute Guard)
│   ├── /dashboard/travel-services → TravelServices.jsx
│   ├── /dashboard/travel-bookings → TravelBookings.jsx
│   ├── /dashboard/car-bookings → CarBookings.jsx
│   └── /dashboard/self-drive-bookings → SelfDriveBookings.jsx
│
├── LOCAL ASSISTANCE SECTION (AdminRoute Guard)
│   ├── /dashboard/customer-chat → CustomerChat.jsx
│   ├── /dashboard/local-services → LocalServices.jsx
│   ├── /dashboard/local-requirements → LocalRequirements.jsx
│   ├── /dashboard/partner-chat → LocalPartnerSupport.jsx
│   └── /dashboard/local-partners → LocalPartners.jsx
│
├── PRIME LOCATIONS SECTION (AdminRoute Guard)
│   ├── /dashboard/shopping-malls → ShoppingMalls.jsx
│   └── /dashboard/clubs → Clubs.jsx
│
└── RESTAURANT SECTION (AdminRoute Guard)
    ├── /dashboard/restaurants → Restaurants.jsx
    └── /dashboard/restaurant-chat → RestaurantChat.jsx
```

### 1.3 Route Guard Implementation

#### Guard Hierarchy

```
PrivetRouter (Base Authentication)
    ↓
┌───────────────┴───────────────┐
│                               │
AdminRoute                  PartnerRoute
(isAdmin || isSubAdmin)     (isPartner)
    ↓                           ↓
HeadAdminRoute          Partner-specific routes
(isAdmin only)
```

#### Guard Logic Flow

**File**: `src/routes/AdminRoute.jsx`

```javascript
// Pseudo-code representation
function AdminRoute({ children }) {
  const { isAdmin, isSubAdmin, loading } = useContext(AuthContext);
  
  if (loading) return <Loading />;
  
  if (!isAdmin && !isSubAdmin) {
    return <Unauthorized />; // Shows error, doesn't redirect
  }
  
  return children;
}
```

**Key Difference**: Route guards show `<Unauthorized />` component instead of redirecting, allowing users to see they're logged in but lack permissions.

### 1.4 Route-to-Component Mapping Table

| Route Path | Component | Guard | Data Source | Purpose |
|------------|-----------|-------|-------------|---------|
| `/dashboard` | `AdminDashboard.jsx` | AdminRoute | PartnerProvider, StatisticsProvider | Main overview with widgets |
| `/dashboard/admin-statistics` | `AdminStatistics.jsx` | AdminRoute | StatisticsProvider | Revenue, bookings analytics |
| `/dashboard/room-bookings` | `RoomBookings.jsx` | AdminRoute | PartnerProvider.roomBookings | Hotel reservation management |
| `/dashboard/hotels` | `Hotels.jsx` | AdminRoute | PartnerProvider.hotels | Hotel partner CRUD |
| `/dashboard/local-partners` | `LocalPartners.jsx` | AdminRoute | PartnerProvider.localPartners | Partner verification workflow |
| `/dashboard/customer-chat` | `CustomerChat.jsx` | AdminRoute | AdminChatProvider | Real-time customer support |
| `/dashboard/notifications` | `NewNotficationsScreen.jsx` | AdminRoute | NotificationsProvider | Push notification management |

---

## 2. Component Hierarchy & Navigation

### 2.1 Layout Architecture

**File**: `src/layouts/Dashboard.jsx` (1299 lines - Main Layout Controller)

```
Dashboard.jsx (Root Layout)
├── CssBaseline (MUI Reset)
├── AppBar (Top Navigation Bar)
│   ├── Toolbar
│   │   ├── MenuIcon (Mobile Drawer Toggle)
│   │   ├── Typography (Dashboard Title)
│   │   └── Box (Right Side Actions)
│   │       ├── Badge (Notification Count)
│   │       │   └── NotificationsIcon
│   │       └── Avatar (User Profile)
│   │           └── Menu (Dropdown)
│   │               └── MenuItem (Logout)
│   │
├── Drawer (Sidebar Navigation) - Desktop Permanent
│   └── List (Navigation Items)
│       ├── Toolbar (Logo + Dashboard Type Label)
│       ├── Primary Links Section
│       ├── Hotel Related Section
│       ├── Travel Related Section
│       ├── Local Assistance Section
│       │   └── Collapse (Local Partners Submenu)
│       ├── Prime Locations Section
│       └── Restaurant Related Section
│
├── Drawer (Sidebar Navigation) - Mobile Temporary
│   └── [Same structure as Desktop]
│
└── Box (Main Content Area)
    ├── Toolbar (Spacing for AppBar)
    └── Outlet (React Router - Renders Child Routes)
        └── [Current Page Component]
```

### 2.2 Navigation Component Breakdown

#### Sidebar Navigation Structure

**File**: `src/layouts/Dashboard.jsx` (Lines 628-1050)

```javascript
// Simplified structure
const drawer = (
  <div className="dashboard-menu">
    {/* Header */}
    <div className="p-6">
      <img src={logo} />
      <div>{isAdmin ? "Admin Dashboard" : "Partner Dashboard"}</div>
    </div>
    
    {/* Navigation List */}
    <List>
      {/* Primary Links */}
      {newprimaryLinks.map(item => (
        <Link to={item.link}>
          <ListItem className={location.pathname === item.link ? "sidebar-active-tab" : ""}>
            {item.icon}
            <span>{item.label}</span>
          </ListItem>
        </Link>
      ))}
      
      {/* Section: Hotel Related */}
      <div className="section-heading">Hotel Related</div>
      {hotellinks.map(route => (
        <Link to={route.url}>
          <ListItem>
            {route.icon}
            <span>{route.lable}</span>
            {/* Badge for pending counts */}
            {route.url === "/dashboard/room-bookings" && (
              <Badge badgeContent={pendingRoomBookings.length} />
            )}
          </ListItem>
        </Link>
      ))}
      
      {/* Section: Local Assistance with Expandable Submenu */}
      <Link to="/dashboard/local-partners">
        <ListItem>
          <HandshakeIcon />
          <span>Local Partners</span>
          {location.pathname === "/dashboard/local-partners" ? <ExpandLess /> : <ExpandMore />}
        </ListItem>
      </Link>
      
      <Collapse in={location.pathname === "/dashboard/local-partners"}>
        <List disablePadding>
          {partnerStatus.map(item => (
            <ListItem onClick={() => handleChangeQueryText(item.queryText)}>
              {item.icon}
              <ListItemText primary={item.label} />
              {item.queryText === "Pending" && (
                <Badge badgeContent={totalRequest} />
              )}
            </ListItem>
          ))}
        </List>
      </Collapse>
      
      {/* ... other sections */}
    </List>
  </div>
);
```

#### Top Navigation Bar (AppBar)

**File**: `src/layouts/Dashboard.jsx` (Lines 1100-1200)

```javascript
<AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
  <Toolbar>
    {/* Mobile Menu Toggle */}
    <IconButton onClick={handleDrawerToggle} sx={{ mr: 2, display: { sm: 'none' } }}>
      <MenuIcon />
    </IconButton>
    
    {/* Dashboard Title */}
    <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
      {text} {/* "Admin Dashboard" | "Hotel Dashboard" | "Partner Dashboard" */}
    </Typography>
    
    {/* Notifications */}
    <IconButton onClick={handleNotificationClick}>
      <Badge badgeContent={notifications.filter(n => !n.read).length} color="error">
        <NotificationsIcon />
      </Badge>
    </IconButton>
    
    {/* User Profile Menu */}
    <IconButton onClick={handleProfileClick}>
      <Avatar src={user?.photoURL} alt={user?.displayName} />
    </IconButton>
    
    <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleClose}>
      <MenuItem onClick={handleLogOut}>Logout</MenuItem>
    </Menu>
  </Toolbar>
</AppBar>
```

### 2.3 Page Component Architecture

#### Example: Room Bookings Page

**File**: `src/pages/dashboard/adminDashboard/clientOrders/RoomBookings.jsx`

```
RoomBookings.jsx (Page Component)
├── PageHeading (Title: "Room Bookings")
├── SearchBar (Filter bookings)
├── DateRangePicker (Filter by date)
├── StatusFilter (Pending/Confirmed/Cancelled)
├── DataTable (MUI Table)
│   ├── TableHead
│   │   └── TableRow (Columns: Booking ID, Hotel, Customer, Dates, Status, Actions)
│   └── TableBody
│       └── TableRow[] (Booking data from PartnerProvider.roomBookings)
│           ├── TableCell (Booking details)
│           └── TableCell (Actions)
│               ├── ViewDetailsIcon (Opens modal)
│               ├── UpdateButton (Change status)
│               └── DeleteButton (Cancel booking)
└── Pagination (Page navigation)
```

#### Example: Hotels Management Page

**File**: `src/pages/dashboard/adminDashboard/ourPartners/Hotels.jsx`

```
Hotels.jsx (Page Component)
├── PageHeading (Title: "Hotel Partners")
├── ActionButtons
│   └── Button (onClick: openAddHotelModal)
│       └── "Add New Hotel"
├── SearchBar (Filter hotels by name/location)
├── Grid (Hotel Cards)
│   └── ShopsCard[] (Reused component)
│       ├── Hotel Image
│       ├── Hotel Name
│       ├── Location
│       ├── Status Badge (Verified/Pending/Denied)
│       └── Actions
│           ├── ViewDetailsIcon
│           ├── UpdateButton
│           └── DeleteButton
└── AddShopForm (Modal)
    ├── TextField (Hotel Name)
    ├── PlacesSearchBox (Location)
    ├── ImageButtons (Upload images)
    ├── CategoriesAndLogo (Service categories)
    └── Button (Submit)
```

### 2.4 Component Reusability Map

| Component | Used In | Purpose |
|-----------|---------|---------|
| `PageHeading` | All pages | Consistent page titles |
| `SearchBar` | Hotels, Restaurants, LocalPartners, Users | Filter lists |
| `ShopsCard` | Hotels, Restaurants, Shops, Clubs | Display partner cards |
| `ActionButtons` | Multiple pages | Add/Edit/Delete actions |
| `AddShopForm` | Hotels, Restaurants, Shops | Partner onboarding |
| `Loading` | All pages | Loading state |
| `ViewDetailsIcon` | All list pages | View full details |
| `UpdateButton` | All list pages | Edit functionality |
| `DeleteButton` | All list pages | Delete functionality |
| `Badge` | Navigation, Lists | Count indicators |

---

## 3. Data Models & Persistence

### 3.1 Firebase Firestore Schema

**File**: `src/firebase/firebase.config.js`

#### Collection Structure

```
Firestore Database
├── users (Customer accounts)
│   ├── {userId}
│   │   ├── email: string
│   │   ├── displayName: string
│   │   ├── phoneNumber: string
│   │   ├── createdAt: Timestamp
│   │   └── bookingHistory: array
│
├── partners (Local service partners)
│   ├── {partnerId}
│   │   ├── serviceCategory: string ("Local Assistance")
│   │   ├── businessName: string
│   │   ├── ownerName: string
│   │   ├── email: string
│   │   ├── phoneNumber: string
│   │   ├── location: GeoPoint
│   │   ├── address: string
│   │   ├── status: string ("Verified" | "Pending" | "Denied")
│   │   ├── createdAt: Timestamp
│   │   ├── verifiedAt: Timestamp | null
│   │   ├── documents: array (URLs)
│   │   └── isSuspended: boolean
│
├── hotels (Hotel partners)
│   ├── {hotelId}
│   │   ├── hotelName: string
│   │   ├── ownerUid: string (reference to partners)
│   │   ├── location: GeoPoint
│   │   ├── address: string
│   │   ├── images: array (URLs)
│   │   ├── amenities: array
│   │   ├── rating: number
│   │   ├── status: string
│   │   └── createdAt: Timestamp
│
├── restaurants (Restaurant partners)
│   ├── {restaurantId}
│   │   ├── restaurantName: string
│   │   ├── ownerUid: string
│   │   ├── location: GeoPoint
│   │   ├── cuisine: array
│   │   ├── images: array
│   │   └── status: string
│
├── hotelBookingData (Room reservations)
│   ├── {bookingId}
│   │   ├── hotelUid: string (reference)
│   │   ├── customerUid: string (reference)
│   │   ├── roomPackageId: string (reference)
│   │   ├── checkIn: Timestamp
│   │   ├── checkOut: Timestamp
│   │   ├── numberOfRooms: number
│   │   ├── numberOfGuests: number
│   │   ├── totalAmount: number
│   │   ├── status: string ("Pending" | "Confirmed" | "Cancelled" | "Completed")
│   │   ├── paymentStatus: string
│   │   ├── orderedAt: Timestamp
│   │   └── customerDetails: object
│
├── travelBookingDetails (Sightseeing bookings)
│   ├── {bookingId}
│   │   ├── packageId: string (reference)
│   │   ├── customerUid: string
│   │   ├── travelDate: Timestamp
│   │   ├── numberOfPeople: number
│   │   ├── totalAmount: number
│   │   ├── status: string
│   │   ├── orderedAt: Timestamp
│   │   └── pickupLocation: string
│
├── car_bookings (Taxi bookings)
│   ├── {bookingId}
│   │   ├── carId: string (reference)
│   │   ├── customerUid: string
│   │   ├── pickupLocation: GeoPoint
│   │   ├── dropLocation: GeoPoint
│   │   ├── pickupTime: Timestamp
│   │   ├── status: string ("pending" | "confirmed" | "completed")
│   │   ├── timestamp: Timestamp
│   │   └── fare: number
│
├── self_driving_bookings (Self-drive bookings)
│   ├── {bookingId}
│   │   ├── carId: string
│   │   ├── customerUid: string
│   │   ├── startDate: Timestamp
│   │   ├── endDate: Timestamp
│   │   ├── status: string
│   │   ├── time: Timestamp
│   │   └── totalAmount: number
│
├── localServices (Service listings)
│   ├── {serviceId}
│   │   ├── partnerUid: string
│   │   ├── serviceName: string
│   │   ├── category: string
│   │   ├── description: string
│   │   ├── price: number
│   │   └── images: array
│
├── sightseeingPackages (Travel packages)
│   ├── {packageId}
│   │   ├── packageName: string
│   │   ├── description: string
│   │   ├── duration: string
│   │   ├── price: number
│   │   ├── images: array
│   │   └── inclusions: array
│
├── hotelPackages (Room packages)
│   ├── {packageId}
│   │   ├── hotelUid: string
│   │   ├── roomType: string
│   │   ├── pricePerNight: number
│   │   ├── maxOccupancy: number
│   │   ├── amenities: array
│   │   └── images: array
│
├── chatRooms (Chat metadata)
│   ├── {roomId}
│   │   ├── type: string ("CustomerSupport" | "HotelSupport" | "LocalPartnerSupport")
│   │   ├── participants: array
│   │   ├── lastMessage: string
│   │   ├── lastMessageTime: Timestamp
│   │   └── unreadCount: object {userId: count}
│
├── chats (Chat messages)
│   ├── {chatId}
│   │   ├── roomId: string (reference)
│   │   ├── senderId: string
│   │   ├── message: string
│   │   ├── timestamp: Timestamp
│   │   └── read: boolean
│
├── allRequirements (Customer requirements)
│   ├── {requirementId}
│   │   ├── customerUid: string
│   │   ├── category: string
│   │   ├── description: string
│   │   ├── status: string ("Pending" | "Assigned" | "Completed")
│   │   ├── createdAt: Timestamp
│   │   └── assignedTo: string | null
│
├── notifications (Push notifications)
│   ├── {notificationId}
│   │   ├── title: string
│   │   ├── body: string
│   │   ├── imageUrl: string | null
│   │   ├── targetAudience: string ("All" | "Hotels" | "Customers")
│   │   ├── sentAt: Timestamp
│   │   └── createdBy: string (admin UID)
│
├── statistics (Analytics data)
│   ├── {date} (YYYY-MM-DD)
│   │   ├── totalBookings: number
│   │   ├── totalRevenue: number
│   │   ├── newUsers: number
│   │   ├── activePartners: number
│   │   └── categoryBreakdown: object
│
└── settings (App configuration)
    ├── Service_Categories
    │   ├── categories: array
    │   └── lastUpdated: Timestamp
    └── App_Config
        ├── maintenanceMode: boolean
        └── version: string
```

### 3.2 Data Persistence Patterns

#### Pattern 1: Real-time Listeners (Context Providers)

**File**: `src/contextAPIs/PartnerProvider.jsx`

```javascript
// Real-time partner data synchronization
useEffect(() => {
  const q = query(
    partnersCollection,
    where("serviceCategory", "==", "Local Assistance"),
    orderBy("createdAt", "desc")
  );
  
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    setLocalPartners(data);
    
    // Calculate pending requests count
    const pending = data.filter(p => p.status === "Pending").length;
    setTotalRequest(pending);
  });
  
  return () => unsubscribe(); // Cleanup on unmount
}, []);
```

**Used for**:
- Partner lists (hotels, restaurants, local partners)
- Booking lists (room, travel, car bookings)
- Chat messages
- Notification counts

**Advantages**:
- Instant UI updates when data changes
- No manual refresh needed
- Multiple admins see same data in real-time

#### Pattern 2: Paginated Fetches (Service Layer)

**File**: `src/services/Bookings.js`

```javascript
export const fetchBookings = async (
  setData,
  setLoading,
  category,
  startDate,
  endDate,
  lastDoc = [],
  setLastDocs,
  pageSize = 20,
  page = 0
) => {
  setLoading(true);
  
  // Determine collection and timestamp field
  let collectionRef, timestampField;
  switch (category) {
    case "Taxi Bookings":
      collectionRef = carBookingsCollection;
      timestampField = "timestamp";
      break;
    case "Room Bookings":
      collectionRef = roomBookingCollection;
      timestampField = "orderedAt";
      break;
    // ... other cases
  }
  
  // Build query with date range
  let q = query(
    collectionRef,
    where(timestampField, ">=", startDate),
    where(timestampField, "<=", endDate),
    orderBy(timestampField, "desc"),
    limit(pageSize)
  );
  
  // Pagination: Start after last document
  if (page > 0 && lastDoc[page - 1]) {
    q = query(
      collectionRef,
      where(timestampField, ">=", startDate),
      where(timestampField, "<=", endDate),
      orderBy(timestampField, "desc"),
      startAfter(lastDoc[page - 1]),
      limit(pageSize)
    );
  }
  
  try {
    const snapshot = await getDocs(q);
    const list = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Save last document for next page
    const lastDocument = snapshot.docs[snapshot.docs.length - 1];
    setLastDocs(prev => {
      const updated = [...prev];
      updated[page] = lastDocument;
      return updated;
    });
    
    setData(list);
  } catch (error) {
    console.error("Error fetching bookings:", error);
  } finally {
    setLoading(false);
  }
};
```

**Used for**:
- Booking records (large datasets)
- User data tables
- Daily records

**Advantages**:
- Efficient for large datasets
- Reduces Firestore read costs
- Better performance

#### Pattern 3: CRUD Operations

**Example: Update Partner Status**

```javascript
// File: src/pages/dashboard/adminDashboard/ourPartners/LocalPartners.jsx

const handleApprovePartner = async (partnerId) => {
  try {
    const partnerRef = doc(partnersCollection, partnerId);
    
    await updateDoc(partnerRef, {
      status: "Verified",
      verifiedAt: serverTimestamp(),
      verifiedBy: user.uid
    });
    
    // Real-time listener in PartnerProvider will auto-update UI
    enqueueSnackbar("Partner approved successfully", { variant: "success" });
  } catch (error) {
    console.error("Error approving partner:", error);
    enqueueSnackbar("Failed to approve partner", { variant: "error" });
  }
};
```

**Example: Create Notification**

```javascript
// File: src/pages/dashboard/adminDashboard/notifications/NewNotficationsScreen.jsx

const handleSendNotification = async (formData) => {
  try {
    await addDoc(notificationsCollection, {
      title: formData.title,
      body: formData.body,
      imageUrl: formData.imageUrl || null,
      targetAudience: formData.targetAudience, // "All" | "Hotels" | "Customers"
      sentAt: serverTimestamp(),
      createdBy: user.uid
    });
    
    // Trigger Firebase Cloud Function to send push notifications
    // (Function listens to notificationsCollection)
    
    enqueueSnackbar("Notification sent successfully", { variant: "success" });
  } catch (error) {
    console.error("Error sending notification:", error);
    enqueueSnackbar("Failed to send notification", { variant: "error" });
  }
};
```

### 3.3 Firebase Storage Integration

**File**: `src/components/ImageButtons.jsx`

```javascript
// Image upload flow
const handleImageUpload = async (file) => {
  try {
    // Create storage reference
    const storageRef = ref(storage, `partners/${partnerId}/${Date.now()}_${file.name}`);
    
    // Upload file
    const uploadTask = uploadBytesResumable(storageRef, file);
    
    // Monitor upload progress
    uploadTask.on('state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
      },
      (error) => {
        console.error("Upload error:", error);
      },
      async () => {
        // Get download URL
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        
        // Save URL to Firestore
        await updateDoc(doc(partnersCollection, partnerId), {
          images: arrayUnion(downloadURL)
        });
        
        setUploadProgress(0);
      }
    );
  } catch (error) {
    console.error("Error uploading image:", error);
  }
};
```

---

## 4. State Management Architecture

### 4.1 Context API Structure

**Provider Hierarchy** (from `src/main.jsx`):

```javascript
<AuthProvider>                      // Level 1: Authentication
  <PartnerProvider>                 // Level 2: Business data
    <RequirementsProvider>          // Level 3: Customer requirements
      <AdminChatProvider>           // Level 4: Admin chat
        <NotificationsProvider>     // Level 5: Notifications
          <PartnerChatProvider>     // Level 6: Partner chat
            <SnackbarProvider>      // Level 7: Toast notifications
              <LoadScript>          // Level 8: Google Maps
                <RouterProvider />  // Level 9: Routing
              </LoadScript>
            </SnackbarProvider>
          </PartnerChatProvider>
        </NotificationsProvider>
      </AdminChatProvider>
    </RequirementsProvider>
  </PartnerProvider>
</AuthProvider>
```

### 4.2 Provider Responsibilities

#### AuthProvider (Authentication & Authorization)

**File**: `src/contextAPIs/AuthProvider.jsx`

```javascript
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Derived state
  const isAdmin = userData?.role === "admin";
  const isSubAdmin = userData?.role === "subAdmin";
  const isPartner = userData?.role === "partner";
  
  useEffect(() => {
    // Firebase auth state listener
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // Fetch user profile from Firestore
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        setUserData(userDoc.data());
      } else {
        setUserData(null);
      }
      
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, []);
  
  const logOut = async () => {
    await signOut(auth);
    setUser(null);
    setUserData(null);
  };
  
  const value = {
    user,
    userData,
    isAdmin,
    isSubAdmin,
    isPartner,
    loading,
    logOut
  };
  
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
```

**Consumed by**: All route guards, all pages

#### PartnerProvider (Business Data Hub)

**File**: `src/contextAPIs/PartnerProvider.jsx` (20KB - Largest provider)

```javascript
const PartnerProvider = ({ children }) => {
  // Partner data
  const [partners, setPartners] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [localPartners, setLocalPartners] = useState([]);
  
  // Booking data
  const [roomBookings, setRoomBookings] = useState([]);
  const [travelBookings, setTravelBookings] = useState([]);
  const [carBookings, setCarBookings] = useState([]);
  const [selfDriveBookings, setSelfDriveBookings] = useState([]);
  
  // Chat counts
  const [chatCount, setChatCount] = useState(0);
  const [hotelChatCount, setHotelChatCount] = useState(0);
  const [restaurantChatCount, setRestaurantChatCount] = useState(0);
  
  // Filters
  const [queryText, setQueryText] = useState("Verified");
  const [chatRoom, setChatRoom] = useState("CustomerSupport");
  
  // Real-time listeners for all collections
  useEffect(() => {
    // Hotels listener
    const hotelsQuery = query(hotelsCollection, orderBy("createdAt", "desc"));
    const unsubHotels = onSnapshot(hotelsQuery, (snapshot) => {
      setHotels(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    
    // Room bookings listener
    const bookingsQuery = query(roomBookingCollection, orderBy("orderedAt", "desc"));
    const unsubBookings = onSnapshot(bookingsQuery, (snapshot) => {
      setRoomBookings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    
    // ... similar listeners for other collections
    
    return () => {
      unsubHotels();
      unsubBookings();
      // ... cleanup all listeners
    };
  }, []);
  
  // Computed values
  const totalRequest = useMemo(() => {
    return localPartners.filter(p => p.status === "Pending").length;
  }, [localPartners]);
  
  const value = {
    partners,
    hotels,
    restaurants,
    localPartners,
    roomBookings,
    travelBookings,
    carBookings,
    selfDriveBookings,
    chatCount,
    hotelChatCount,
    restaurantChatCount,
    totalRequest,
    queryText,
    setQueryText,
    chatRoom,
    setChatRoom
  };
  
  return <PartnerContext.Provider value={value}>{children}</PartnerContext.Provider>;
};
```

**Consumed by**: All admin dashboard pages, navigation (for badge counts)

#### StatisticsProvider (Analytics Data)

**File**: `src/contextAPIs/StatisticsProvider.jsx`

```javascript
const StatisticsProvider = ({ children }) => {
  const [statistics, setStatistics] = useState({
    totalRevenue: 0,
    totalBookings: 0,
    newUsers: 0,
    activePartners: 0,
    revenueByCategory: {},
    bookingsTrend: []
  });
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchStatistics = async () => {
      try {
        // Fetch from statistics collection
        const statsDoc = await getDoc(doc(statisticsCollection, "current"));
        setStatistics(statsDoc.data());
      } catch (error) {
        console.error("Error fetching statistics:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchStatistics();
  }, []);
  
  const value = { statistics, loading };
  
  return <StatisticsContext.Provider value={value}>{children}</StatisticsContext.Provider>;
};
```

**Consumed by**: `AdminStatistics.jsx` page only

### 4.3 State Update Flow Example

**Scenario**: Admin approves a pending partner

```
1. User Action
   └─> Admin clicks "Approve" button in LocalPartners.jsx

2. Component Handler
   └─> handleApprovePartner(partnerId) called

3. Firestore Update
   └─> updateDoc(partnersCollection, partnerId, { status: "Verified" })

4. Real-time Listener Triggered
   └─> PartnerProvider's onSnapshot listener detects change

5. Context State Update
   └─> setLocalPartners([...updated partners])
   └─> setTotalRequest(newPendingCount)

6. UI Re-render
   ├─> LocalPartners.jsx updates partner list
   └─> Dashboard.jsx sidebar updates badge count

7. Toast Notification
   └─> enqueueSnackbar("Partner approved")
```

---

## 5. Authentication & Authorization Flow

### 5.1 Login Flow

```
User enters credentials in Login.jsx
    ↓
signInWithEmailAndPassword(auth, email, password)
    ↓
Firebase Authentication validates
    ↓
onAuthStateChanged listener in AuthProvider triggers
    ↓
Fetch user profile from Firestore users/{uid}
    ↓
Set user and userData in AuthContext
    ↓
Determine role (isAdmin, isSubAdmin, isPartner)
    ↓
PrivetRouter allows access to /dashboard
    ↓
AdminRoute/PartnerRoute checks role
    ↓
Render appropriate dashboard
```

### 5.2 Role-Based Access Control (RBAC)

**User Roles** (stored in Firestore `users` collection):

```javascript
{
  uid: "user-id",
  email: "admin@thaiseva.com",
  role: "admin" | "subAdmin" | "partner" | "customer",
  permissions: {
    canManagePartners: boolean,
    canViewAnalytics: boolean,
    canSendNotifications: boolean,
    canManageSubAdmins: boolean  // Only for head admin
  },
  isSuspended: boolean
}
```

**Permission Matrix**:

| Feature | Admin | Sub-Admin | Partner | Customer |
|---------|-------|-----------|---------|----------|
| View Dashboard | ✅ | ✅ | ✅ | ❌ |
| Manage Partners | ✅ | ✅ | ❌ | ❌ |
| Approve Bookings | ✅ | ✅ | ❌ | ❌ |
| View Analytics | ✅ | ✅ | ❌ | ❌ |
| Send Notifications | ✅ | ✅ | ❌ | ❌ |
| Manage Sub-Admins | ✅ | ❌ | ❌ | ❌ |
| Manage Own Services | ❌ | ❌ | ✅ | ❌ |
| Chat with Admin | ❌ | ❌ | ✅ | ✅ |

### 5.3 Security Rules (Firestore)

**File**: `firestore.rules`

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper function to check if user is admin
    function isAdmin() {
      return request.auth != null && 
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'subAdmin'];
    }
    
    // Partners collection
    match /partners/{partnerId} {
      allow read: if isAdmin();
      allow write: if isAdmin();
    }
    
    // Bookings collections
    match /hotelBookingData/{bookingId} {
      allow read: if isAdmin() || 
                     resource.data.customerUid == request.auth.uid ||
                     resource.data.hotelUid == request.auth.uid;
      allow write: if isAdmin();
    }
    
    // Chat rooms
    match /chatRooms/{roomId} {
      allow read: if isAdmin() || 
                     request.auth.uid in resource.data.participants;
      allow write: if isAdmin() || 
                      request.auth.uid in resource.data.participants;
    }
    
    // Notifications
    match /notifications/{notificationId} {
      allow read: if true; // Public read
      allow write: if isAdmin(); // Only admins can create
    }
  }
}
```

---

## 6. Data Flow Patterns

### 6.1 Complete Data Flow: Room Booking Management

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE                            │
│  RoomBookings.jsx (Admin Dashboard Page)                        │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                     CONTEXT LAYER                                │
│  PartnerProvider.jsx                                             │
│  - Real-time listener on roomBookingCollection                   │
│  - Provides: roomBookings array                                  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                   FIREBASE FIRESTORE                             │
│  Collection: hotelBookingData                                    │
│  - onSnapshot listener active                                    │
│  - Auto-updates on any document change                           │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                    DATA TRANSFORMATION                           │
│  snapshot.docs.map(doc => ({                                     │
│    id: doc.id,                                                   │
│    ...doc.data(),                                                │
│    checkInDate: doc.data().checkIn.toDate(),                     │
│    checkOutDate: doc.data().checkOut.toDate()                    │
│  }))                                                             │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                      UI RENDERING                                │
│  - Filter bookings by status                                     │
│  - Display in MUI DataTable                                      │
│  - Show action buttons (Approve/Reject)                          │
└─────────────────────────────────────────────────────────────────┘

                    USER CLICKS "APPROVE"
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                    ACTION HANDLER                                │
│  handleApproveBooking(bookingId)                                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                   FIRESTORE UPDATE                               │
│  updateDoc(doc(roomBookingCollection, bookingId), {              │
│    status: "Confirmed",                                          │
│    confirmedAt: serverTimestamp(),                               │
│    confirmedBy: adminUid                                         │
│  })                                                              │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                REAL-TIME UPDATE PROPAGATION                      │
│  1. Firestore triggers onSnapshot listener                       │
│  2. PartnerProvider updates roomBookings state                   │
│  3. React re-renders RoomBookings.jsx                            │
│  4. UI shows updated status instantly                            │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Chat System Data Flow

```
Admin opens CustomerChat.jsx
    ↓
AdminChatProvider initializes
    ↓
Fetch chat rooms from Firestore
    ├─> CustomerSupport room
    ├─> HotelSupport room
    └─> LocalPartnerSupport room
    ↓
Display chat room list with unread counts
    ↓
Admin selects a chat room
    ↓
dispatch({ type: "CHANGE_USER", payload: selectedRoom })
    ↓
Real-time listener on chats collection
    where("roomId", "==", selectedRoomId)
    orderBy("timestamp", "asc")
    ↓
Display messages in chat UI
    ↓
Admin types message and sends
    ↓
addDoc(chatsCollection, {
    roomId: selectedRoomId,
    senderId: adminUid,
    message: messageText,
    timestamp: serverTimestamp(),
    read: false
})
    ↓
Real-time listener updates chat UI
    ↓
Update chatRooms collection with last message
    ↓
Increment unread count for recipient
```

### 6.3 Notification System Data Flow

```
Admin opens NewNotficationsScreen.jsx
    ↓
Fill notification form:
    - Title
    - Body
    - Image (optional)
    - Target Audience (All/Hotels/Customers)
    ↓
Click "Send Notification"
    ↓
handleSendNotification(formData)
    ↓
Upload image to Firebase Storage (if provided)
    ↓
Get image download URL
    ↓
Create notification document:
addDoc(notificationsCollection, {
    title: formData.title,
    body: formData.body,
    imageUrl: downloadURL,
    targetAudience: formData.targetAudience,
    sentAt: serverTimestamp(),
    createdBy: adminUid
})
    ↓
Firebase Cloud Function triggered (onCreate)
    ↓
Function fetches target user tokens from Firestore
    ↓
Send push notification via FCM (Firebase Cloud Messaging)
    ↓
Users receive notification on their devices
    ↓
NotificationsProvider updates notification list
    ↓
Admin sees notification in sent notifications list
```

---

## 7. Performance Optimizations

### 7.1 Implemented Optimizations

1. **Lazy Loading**
   ```javascript
   // Route.jsx
   const AdminDashboard = lazy(() => import("../pages/dashboard/adminDashboard/AdminDashboard"));
   
   <Suspense fallback={<Loading />}>
     <AdminDashboard />
   </Suspense>
   ```

2. **Pagination**
   - Firestore cursor-based pagination
   - Reduces initial load time
   - Limits read operations

3. **Memoization**
   ```javascript
   // PartnerProvider.jsx
   const totalRequest = useMemo(() => {
     return localPartners.filter(p => p.status === "Pending").length;
   }, [localPartners]);
   ```

4. **Firestore Indexes**
   - Composite indexes for complex queries
   - Defined in `firestore.indexes.json`

### 7.2 Potential Improvements

1. **Virtual Scrolling** for large lists
2. **Debounced Search** to reduce Firestore reads
3. **Cached Data** with React Query or SWR
4. **Image Optimization** (lazy loading, compression)
5. **Code Splitting** by route

---

## 8. Development Workflow

### 8.1 Adding a New Admin Feature

**Example**: Add "Coupons Management" page

1. **Create Page Component**
   ```bash
   src/pages/dashboard/adminDashboard/coupons/Coupons.jsx
   ```

2. **Define Route**
   ```javascript
   // src/routes/Route.jsx
   {
     path: "/dashboard/coupons",
     element: (
       <AdminRoute>
         <Coupons />
       </AdminRoute>
     ),
   }
   ```

3. **Add Navigation Link**
   ```javascript
   // src/utils/RouteLinks.jsx
   export const newprimaryLinks = [
     // ... existing links
     {
       icon: <LocalOfferIcon />,
       link: "/dashboard/coupons",
       label: "Coupons"
     }
   ];
   ```

4. **Export Component**
   ```javascript
   // src/pages/index.js
   export { default as Coupons } from "./dashboard/adminDashboard/coupons/Coupons";
   ```

5. **Create Service (if needed)**
   ```javascript
   // src/services/Coupons.js
   export const fetchCoupons = async () => {
     const snapshot = await getDocs(couponsCollection);
     return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
   };
   ```

6. **Add to Context (if real-time needed)**
   ```javascript
   // src/contextAPIs/PartnerProvider.jsx
   const [coupons, setCoupons] = useState([]);
   
   useEffect(() => {
     const unsubscribe = onSnapshot(couponsCollection, (snapshot) => {
       setCoupons(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
     });
     return () => unsubscribe();
   }, []);
   ```

---

## 9. Testing Considerations

### 9.1 Unit Testing

**Test Context Providers**:
```javascript
// AuthProvider.test.jsx
import { renderHook } from '@testing-library/react-hooks';
import { AuthProvider, useAuth } from './AuthProvider';

test('provides authentication state', () => {
  const { result } = renderHook(() => useAuth(), {
    wrapper: AuthProvider
  });
  
  expect(result.current.user).toBeNull();
  expect(result.current.loading).toBe(true);
});
```

**Test Route Guards**:
```javascript
// AdminRoute.test.jsx
import { render } from '@testing-library/react';
import AdminRoute from './AdminRoute';

test('shows unauthorized for non-admin', () => {
  const { getByText } = render(
    <AuthContext.Provider value={{ isAdmin: false, isSubAdmin: false }}>
      <AdminRoute>
        <div>Protected Content</div>
      </AdminRoute>
    </AuthContext.Provider>
  );
  
  expect(getByText(/unauthorized/i)).toBeInTheDocument();
});
```

### 9.2 Integration Testing

**Test Complete Flows**:
```javascript
// RoomBookings.integration.test.jsx
test('admin can approve booking', async () => {
  const { getByText, getByRole } = render(<RoomBookings />);
  
  // Wait for bookings to load
  await waitFor(() => expect(getByText(/pending/i)).toBeInTheDocument());
  
  // Click approve button
  fireEvent.click(getByRole('button', { name: /approve/i }));
  
  // Verify status updated
  await waitFor(() => expect(getByText(/confirmed/i)).toBeInTheDocument());
});
```

---

## 10. Deployment Architecture

### 10.1 Firebase Hosting

```
Build Process:
  npm run build
    ↓
  Vite bundles React app
    ↓
  Output: dist/ folder
    ↓
  firebase deploy --only hosting
    ↓
  Deployed to: https://thaiseva-85cda.web.app
```

### 10.2 Environment Configuration

```javascript
// .env
VITE_Google_Api_Key=your-google-maps-key

// firebase.config.js (should use env vars)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_apiKey,
  authDomain: import.meta.env.VITE_authDomain,
  projectId: import.meta.env.VITE_projectId,
  // ... other config
};
```

---

## Conclusion

This admin dashboard is built with a **modular, scalable architecture** using:

- **React Router v6** for declarative routing
- **Material-UI** for consistent UI components
- **Firebase Firestore** for real-time data synchronization
- **Context API** for centralized state management
- **Role-based access control** for security
- **Real-time listeners** for instant updates across admin sessions

The architecture supports **multiple admin roles**, **real-time collaboration**, and **efficient data management** for a travel/hospitality booking platform.

---

*Technical Architecture Guide - Thaiseva Admin Dashboard*  
*Version: 1.0*  
*Last Updated: 2025-11-23*

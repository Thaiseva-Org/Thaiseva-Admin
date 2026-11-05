# Active and inactive listings

Implemented 12 October 2026 for hotels, sightseeing packages and hotel room packages. The website displays active listings; admins can manage both states.

## Admin workflow

Hotels and sightseeing packages have status switches in table and card views, an image badge, and Total / Active / Inactive counts. All / Active / Inactive filters work alongside search and pagination. Room Services and the hotel room manager have table switches and filters. The room status modal and all hotel/tour/room creation and edit forms save visibility. New records default to active.

Switches update immediately, disable while saving and show success or failure notifications. Failed writes restore the previous state. Firestore listeners reflect changes made by other admin sessions without refreshing the page.

## Data contract

| Record | Fields and persistence |
| --- | --- |
| `HotelDB/{hotelId}` | Root `isActive`, `status` and nested `hotel.isActive`, `hotel.status`, in one update |
| Sightseeing package | `sightseeingPackages/{id}` and `sightseeingPackagesDetails/{id}` in one atomic batch |
| Hotel room package | `hotelPackageDetails/{id}` and `HotelDB/{hotelUid}/rooms/{id}` in one atomic batch |

`isActive` is a boolean; `status` is `Active` or `Inactive`. Updates also set `updatedAt`. Root boolean takes precedence, then nested hotel boolean, then a case-insensitive `Inactive` status. Missing visibility fields and legacy `Verified`, `Approved` or `Pending` statuses remain active. This does not change booking statuses or account verification statuses. Changing listing visibility overwrites the catalog's legacy status label only.

The hotel form also mirrors its room documents into `hotelPackageDetails`. Removing a room in that form deletes both copies. Room IDs and the parent hotel ID must identify the same room in both collections. Existing records need no bulk migration to remain visible.

## Public website and booking

Public hotel/tour DTOs reject inactive records. Embedded and subcollection rooms are filtered before display, room selection and price calculations. Public listing listeners remove and restore hotels/tours in real time; hotel room listeners also refresh listing prices. Inactive detail pages show the existing unavailable/not-found state. Generated sitemaps exclude inactive entries at the next website build.

Booking and stock APIs reject inactive hotels/rooms and new inactive tour bookings. Existing customer booking records are retained. The website and admin backend sources contain the same visibility precedence policy.

## Verification

- Both frontend production builds pass; existing dependency/chunk warnings remain.
- Website backend regression suite: 44 passed, plus two visibility tests.
- Admin backend regression suite including visibility: 28 passed; TypeScript compilation passes.
- Public mapper tests: 3 passed, covering hidden records, legacy defaults, reactivation, embedded rooms and filter partitioning.
- Browser using the actual status controls and mutation hook against local Firestore: root/nested hotel persistence, atomic tour and room writes, reactivation, pending controls, filter counts, and failed-write rollback passed. Production customer data was not changed for testing.
- Existing admin component lint findings remain outside this change; new shared status modules pass lint.

Deployment results are recorded in `LISTING_STATUS_DEPLOYMENT.md` after rollout.

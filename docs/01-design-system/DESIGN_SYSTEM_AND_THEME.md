# Design System, Theming & UI Style Guide

This document defines the visual design system, color palettes, Tailwind CSS design tokens, CSS custom properties, and UI component standards for the Thaiseva Admin Portal and related frontend surfaces.

---

## 1. Design Principles & Tokens

The Thaiseva Admin Portal utilizes a curated, enterprise-grade design system built on **Tailwind CSS** with custom CSS variables defined in [src/index.css](file:///d:/projects/Thaiseva-Admin-Portal-Web-App/src/index.css).

- **Clarity & Hierarchy:** Deep blues for primary actions and brand presence, high-contrast slate neutrals for readability, and functional alert colors for real-time status feedback.
- **Glassmorphism & Depth:** Soft atmospheric backdrop blurs (`.glass`, `.glass-dark`) and elevation shadows (`.modern-card`) provide modern physical depth without cluttering dense tabular workflows.
- **Micro-Interactions:** Subtle hover lifts, smooth transitions (`150ms-200ms ease-in-out`), and active depression feedback ensure the interface feels responsive and alive.

---

## 2. Color System & Palettes

Defined in `tailwind.config.js` under `theme.extend.colors` and mirrored in root CSS variables.

### 2.1 Primary Brand (Blue)
Primary brand color used for navigation, active sidebar highlights, buttons, links, and key metric badges.
- **`50`**: `#eff6ff` (Light background wash, active menu backgrounds)
- **`100`**: `#dbeafe` (Subtle selection badges, borders)
- **`200`**: `#bfdbfe`
- **`300`**: `#93c5fd`
- **`400`**: `#60a5fa`
- **`500`**: `#3b82f6` (Base Interactive Blue)
- **`600`**: `#2563eb` (Hover State)
- **`700`**: `#1d4ed8` (Active Pressed State)
- **`800`**: `#1e40af` (Primary Surface Headers)
- **`900`**: `#1e3a8a` (Main Page Titles & Strong Typography)
- **`950`**: `#172554` (Deep Contrast Accents)

### 2.2 Secondary Accent (Orange)
Used for calls to action, warm highlights, promotions, and secondary attention markers.
- **`50`**: `#fff7ed`
- **`100`**: `#ffedd5`
- **`200`**: `#fed7aa`
- **`300`**: `#fdba74`
- **`400`**: `#fb923c`
- **`500`**: `#f97316` (Base Secondary Orange)
- **`600`**: `#ea580c`
- **`700`**: `#c2410c`
- **`800`**: `#9a3412`
- **`900`**: `#7c2d12`

### 2.3 Feature Highlight (Purple)
Special features, promotional badges, and distinct category tagging.
- **`50`**: `#fdf4ff`
- **`100`**: `#fae8ff`
- **`200`**: `#f5d0fe`
- **`300`**: `#f0abfc`
- **`400`**: `#e879f9`
- **`500`**: `#d946ef` (Base Purple)
- **`600`**: `#c026d3`
- **`700`**: `#a21caf`
- **`800`**: `#86198f`
- **`900`**: `#701a75`

### 2.4 Functional & Status Colors

| State | Base Color | Hex Code | Tint (50) | Usage |
|---|---|---|---|---|
| **Success** | Green 500 | `#22c55e` | `#f0fdf4` | Verified status, accepted bookings, paid invoices |
| **Warning** | Amber 500 | `#f59e0b` | `#fffbeb` | Pending approvals, temporary holds, soft warnings |
| **Danger** | Red 500 | `#ef4444` | `#fef2f2` | Cancellations, deletions, error alerts, rejections |
| **Neutral** | Gray 500 | `#737373` | `#fafafa` | Secondary text, borders, table row dividers |

---

## 3. CSS Variables & Semantic Mapping

Defined in `:root` inside [src/index.css](file:///d:/projects/Thaiseva-Admin-Portal-Web-App/src/index.css) for global component consistency:

```css
:root {
  /* Surfaces & Backgrounds */
  --main-bg-color: #f8fafc;
  --main-headings-color: #1e3a8a;
  --primary-bg: #1e40af;
  --primary-text-color: #171717;
  --secondary-text-color: #525252;

  /* Sidebar & Navigation Drawer */
  --drawer-heading-color: #1e3a8a;
  --drawer-main-color: #2563eb;
  --drawer-inactive-color: #64748b;
  --drawer-icon-color: #3b82f6;
  --drawer-secondary-color: #eff6ff;
  --drawer-active-bg: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);

  /* Action Buttons */
  --button-bg-color: #3b82f6;
  --button-hover-bg-color: #2563eb;
  --button-active-bg-color: #1d4ed8;
  --delete-button-bg-color: #ef4444;
  --edit-button-bg-color: #f59e0b;
  --accept-button-bg-color: #22c55e;

  /* Chat & Messaging Subsystem */
  --chat-top-color: #eff6ff;
  --msg-text-bg-color: #3b82f6;
  --msg-text-color: #ffffff;
  --msg-bg-color: #f8fafc;
  --all-user-bg-color: #f3f4f6;
}
```

---

## 4. Reusable UI Components & Utility Classes

The application standardizes key visual patterns using dedicated utility classes:

### 4.1 Status Badges
```html
<span class="badge-success">Verified</span>
<span class="badge-warning">Pending Review</span>
<span class="badge-danger">Cancelled</span>
<span class="badge-primary">Active</span>
```

### 4.2 Standard Interactive Buttons
- **`.add-new-btn`**: Primary gradient blue button (`linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)`) with uppercase bold label and elevation shadow.
- **`.input-add-btn`**: Compact action button for input attachments and inline forms.
- **`.cross-btn` / `.image-clear-btn`**: Circular danger button for removing uploaded photos or resetting selections.
- **`.location-btn`**: Dedicated map picker trigger with coordinate pin icon.

### 4.3 Cards & Surface Elevation
- **`.modern-card`**: Clean white surface, `16px` border radius (`rounded-2xl`), subtle border (`border-slate-100`), soft box shadow, and a micro-lift on hover:
  ```css
  .modern-card {
    background: #ffffff;
    border-radius: 1rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  .modern-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.04);
  }
  ```
- **`.glass`**: Background `rgba(255, 255, 255, 0.85)` with `backdrop-filter: blur(12px)`.
- **`.glass-dark`**: Background `rgba(15, 23, 42, 0.85)` with `backdrop-filter: blur(12px)`.

---

## 5. Typography & Form Conventions

- **Font Family:** `Inter`, system-ui, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Roboto`, sans-serif.
- **Headings Hierarchy:**
  - `h1`: 24px - 30px (`text-2xl` to `text-3xl`), font weight `700` (`font-bold`), color `--main-headings-color`.
  - `h2`: 18px - 20px (`text-lg` to `text-xl`), font weight `600` (`font-semibold`).
  - `h3` / section headers: 14px - 16px (`text-sm` to `text-base`), font weight `600`.
- **Form Controls:** Inputs feature `px-4 py-2.5`, `rounded-xl`, `border-slate-200`, focus ring `focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500`, and clear label typography.

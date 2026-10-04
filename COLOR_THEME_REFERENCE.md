# Color Theme Reference

> [!NOTE]
> **Consolidated Specification:** This design and theming reference has been unified into the authoritative **[Design System, Theming & UI Style Guide](file:///d:/projects/Thaiseva-Admin-Portal-Web-App/docs/01-design-system/DESIGN_SYSTEM_AND_THEME.md)**. Refer to that document for the master design tokens, CSS variables, and utility classes.

This document serves as a reference for the color palette, design tokens, and utility classes used in the `Thaiseva-Admin-Portal-Web-App`. The project utilizes **Tailwind CSS** with an extended configuration and **CSS Custom Properties** (Variables) for consistent theming.

## Tailwind CSS Configuration

The following color palettes are defined in `tailwind.config.js` under `theme.extend.colors`. These are the primary sources of truth for the application's color system.

### Primary Blue
Used for main actions, links, and branding.
- **50**: `#eff6ff`
- **100**: `#dbeafe`
- **200**: `#bfdbfe`
- **300**: `#93c5fd`
- **400**: `#60a5fa`
- **500**: `#3b82f6` (Base)
- **600**: `#2563eb`
- **700**: `#1d4ed8`
- **800**: `#1e40af`
- **900**: `#1e3a8a`
- **950**: `#172554`

### Secondary Orange
Used for highlights, secondary actions, and warmth.
- **50**: `#fff7ed`
- **100**: `#ffedd5`
- **200**: `#fed7aa`
- **300**: `#fdba74`
- **400**: `#fb923c`
- **500**: `#f97316` (Base)
- **600**: `#ea580c`
- **700**: `#c2410c`
- **800**: `#9a3412`
- **900**: `#7c2d12`

### Accent Purple
Used for creative elements or distinct feature highlighting.
- **50**: `#fdf4ff`
- **100**: `#fae8ff`
- **200**: `#f5d0fe`
- **300**: `#f0abfc`
- **400**: `#e879f9`
- **500**: `#d946ef` (Base)
- **600**: `#c026d3`
- **700**: `#a21caf`
- **800**: `#86198f`
- **900**: `#701a75`

### Status Colors

#### Success (Green)
- **50**: `#f0fdf4`
- **500**: `#22c55e` (Base)
- **600**: `#16a34a`
- **700**: `#15803d`

#### Warning (Amber)
- **50**: `#fffbeb`
- **500**: `#f59e0b` (Base)
- **600**: `#d97706`
- **700**: `#b45309`

#### Danger (Red)
- **50**: `#fef2f2`
- **100**: `#fee2e2`
- **400**: `#f87171`
- **500**: `#ef4444` (Base)
- **600**: `#dc2626`
- **700**: `#b91c1c`

#### Neutral (Grays)
- **50**: `#fafafa`
- **100**: `#f5f5f5`
- **200**: `#e5e5e5`
- **300**: `#d4d4d4`
- **400**: `#a3a3a3`
- **500**: `#737373`
- **600**: `#525252`
- **700**: `#404040`
- **800**: `#262626`
- **900**: `#171717`
- **950**: `#0a0a0a`

---

## CSS Variables (Root)

Defined in `src/index.css`, these variables often map to the Tailwind colors or provide semantic naming for specific UI components.

### Core Token Mapping
| Variable | Value | Description |
| :--- | :--- | :--- |
| `--primary-50` ... `--primary-900` | (Matches Tailwind Primary) | Core Blue Scale |
| `--secondary-50` ... `--secondary-700` | (Matches Tailwind Secondary) | Core Orange Scale |
| `--success-50` ... `--success-700` | (Matches Tailwind Success) | Status Green Scale |
| `--danger-50` ... `--danger-700` | (Matches Tailwind Danger) | Status Red Scale |
| `--warning-50` ... `--warning-600` | (Matches Tailwind Warning) | Status Amber Scale |
| `--neutral-50` ... `--neutral-900` | (Matches Tailwind Neutral) | Grey Scale |

### Semantic UI Variables

#### Text & Backgrounds
- `--main-bg-color`: `#f8fafc` (Slate 50)
- `--main-headings-color`: `#1e3a8a` (Primary 900)
- `--primary-bg`: `#1e40af` (Primary 800)
- `--primary-text-color`: `#171717` (Neutral 900)
- `--secondary-text-color`: `#525252` (Neutral 600)

#### Drawer / Sidebar
- `--drawer-heading-color`: `#1e3a8a`
- `--drawer-main-color`: `#2563eb`
- `--drawer-inactive-color`: `#64748b`
- `--drawer-icon-color`: `#3b82f6`
- `--drawer-secondary-color`: `#eff6ff`
- `--drawer-active-bg`: `linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)`

#### Buttons
- `--button-bg-color`: `#3b82f6`
- `--button-hover-bg-color`: `#2563eb`
- `--button-active-bg-color`: `#1d4ed8`
- `--delete-button-bg-color`: `#ef4444`
- `--edit-button-bg-color`: `#f59e0b`
- `--accept-button-bg-color`: `#22c55e`

#### Chat Interface
- `--chat-top-color`: `#eff6ff`
- `--msg-text-bg-color`: `#3b82f6`
- `--msg-text-color`: `#ffffff`
- `--msg-bg-color`: `#f8fafc`
- `--all-user-bg-color`: `#f3f4f6`

---

## Utility Classes & Components

The project includes custom utility classes in `src/index.css` for consistent styling patterns.

### Badges
Used for status indicators.
- `.badge-success` (Green bg/text)
- `.badge-danger` (Red bg/text)
- `.badge-warning` (Amber bg/text)
- `.badge-primary` (Blue bg/text)

### Buttons
- `.input-add-btn`: Gradient Blue with shadow.
- `.add-new-btn`: Gradient Blue, uppercase text.
- `.cross-btn` / `.image-clear-btn`: Red circular buttons for removal actions.
- `.location-btn`: Gradient Blue for map actions.

### Cards & Layout
- `.modern-card`: White bg, rounded corners, soft shadow, hover lift effect.
- `.glass`: White transparency with blur.
- `.glass-dark`: Dark transparency with blur.
- `.banner-layout`: Standard padding and shadow for dashboards.

### Gradients
- `.gradient-primary`: Blue gradient.
- `.gradient-secondary`: Orange gradient.
- `.gradient-success`: Green gradient.
- `.gradient-danger`: Red gradient.

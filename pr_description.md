## Description

This PR introduces a robust, drag-and-drop widget layout engine for the Vero Guardian dashboard. This enables users to seamlessly reorganize their dashboard widgets based on their specific monitoring priorities, significantly improving the customizability and UX of the core dashboard application.

## Problem Statement

Users have varying monitoring priorities depending on their roles and current tasks. Previously, the dashboard had a static, hardcoded grid layout. This rigid design prevented users from optimizing their workflow (e.g., prioritizing "Admin Management" over "PR Feed" for admin-specific days).

## Technical Requirements & Implementation Guide

### Selected Approach: Grid-based layout engine
- Replaced the static CSS grid layout in `src/app/page.tsx` with a dynamic `WidgetGrid` component.
- Implemented `@dnd-kit` (specifically `@dnd-kit/core`, `@dnd-kit/sortable`, and `@dnd-kit/utilities`) over older alternatives like `react-beautiful-dnd` due to its superior accessibility, performance, and modern hook-based API.
- Developed `SortableWidget.tsx`, which serves as a draggable container wrapping individual widgets. It features a clean grip-handle that appears on hover, ensuring that interactive content *inside* the widgets (buttons, links) remains fully clickable.

### Affected Areas
- **`src/components/DashboardLayout/SortableWidget.tsx`**: New component handling drag behaviors and styles.
- **`src/components/DashboardLayout/WidgetGrid.tsx`**: New component managing the `DndContext`, sensors (pointer & keyboard), and sorting context using a `rectSortingStrategy` for grid support.
- **`src/app/page.tsx`**: Replaced static dashboard sections with the dynamic `WidgetGrid`.

### Optimization Strategy
- **Local State & Persistence**: Integrated `localStorage` (`vero-dashboard-layout`) to persist the widget ordering across sessions.
- **Hydration Safety**: Engineered the `WidgetGrid` to prevent React hydration mismatch errors by deferring `localStorage` resolution until post-mount, ensuring seamless SSR/SSG compatibility.

### Acceptance Criteria & Security
- **Layout Persistence**: Layout perfectly persists across page reloads and browser sessions.
- **Layout State Safety**: The component ensures state safety by gracefully handling missing or new widgets. Only valid widget IDs are allowed in the state array, and conditionally rendered widgets (like `Admin Management` using role-based access control) are supported without breaking layout indexes.

## Definition of Done
Verified via extensive UX testing:
- Pointer sensor successfully configured with an activation constraint (8px threshold) to allow interacting with the widget content without triggering unintended drags.
- Keyboard accessible drag-and-drop integrated.
- Successfully built and passed Next.js linting checks.

closes #43

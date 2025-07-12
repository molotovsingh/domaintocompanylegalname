
# Client Source Code

*Created: July 12, 2025 at 2:52 AM UTC*

This directory contains the React + TypeScript source code for the Domain Intelligence Platform frontend application.

## Directory Structure

### **`/components/`**
React component library organized by functionality and hierarchy:
- **`/ui/`** - shadcn/ui design system components
- **Feature Components** - Domain-specific application components
- **README.md** - Component organization and usage guide

### **`/pages/`**
Application page components for different sections:
- **`dashboard.tsx`** - Main application dashboard
- **`analytics.tsx`** - Analytics and insights
- **`beta-testing.tsx`** - Beta extraction method testing
- **Testing Pages** - Various testing interfaces
- **Reference Pages** - Documentation and guides

### **`/hooks/`**
Custom React hooks for shared functionality:
- **`use-toast.ts`** - Toast notification management
- **`use-mobile.tsx`** - Mobile device detection

### **`/lib/`**
Core libraries and utilities:
- **`queryClient.ts`** - React Query configuration
- **`utils.ts`** - Common utility functions

## Core Application Files

### **`App.tsx`**
Main application component with routing and layout structure.

### **`main.tsx`**
Application entry point with React Router and provider setup.

### **`index.css`**
Global CSS styles with Tailwind CSS imports and custom styles.

## Development Patterns

### **Component Organization**
- UI components in `/ui/` for reusable design system elements
- Feature components in root `/components/` for domain-specific functionality
- Page components in `/pages/` for route-level components

### **State Management**
- React Query for server state management
- React hooks for local component state
- Context API for global application state

### **Styling Approach**
- Tailwind CSS for utility-first styling
- shadcn/ui for consistent component design
- Custom CSS for complex layouts

This source directory provides the complete frontend implementation for the Domain Intelligence Platform with modern React patterns and TypeScript type safety.

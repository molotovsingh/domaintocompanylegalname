
# React Hooks

*Created: July 12, 2025 at 2:52 AM UTC*

This directory contains custom React hooks that provide reusable functionality across the Domain Intelligence Platform frontend.

## Available Hooks

### **`use-toast.ts`**
Toast notification management hook for user feedback:

```typescript
import { useToast } from "./use-toast"

const { toast } = useToast()

toast({
  title: "Success",
  description: "Operation completed successfully"
})
```

**Features:**
- Success, error, warning, and info toast types
- Automatic dismissal with configurable timing
- Queue management for multiple toasts
- Accessible toast notifications

### **`use-mobile.tsx`**
Mobile device detection hook for responsive behavior:

```typescript
import { useIsMobile } from "./use-mobile"

const isMobile = useIsMobile()

return (
  <div className={isMobile ? "mobile-layout" : "desktop-layout"}>
    {/* Responsive content */}
  </div>
)
```

**Features:**
- Breakpoint-based mobile detection
- Window resize event handling
- Server-side rendering compatibility
- Tailwind CSS breakpoint alignment

## Hook Development Patterns

### **Custom Hook Structure**
```typescript
import { useState, useEffect } from 'react'

export function useCustomHook() {
  const [state, setState] = useState(initialValue)
  
  useEffect(() => {
    // Side effects and cleanup
  }, [dependencies])
  
  return { state, actions }
}
```

### **TypeScript Integration**
- Full type safety for hook parameters and return values
- Interface definitions for complex hook state
- Generic hooks for reusable patterns

### **Performance Optimization**
- Memoization with useMemo and useCallback
- Debouncing for expensive operations
- Cleanup functions for subscriptions

## Integration with Application

### **Toast Integration**
Connected to the global toast provider in the application root for consistent notification handling across all components.

### **Mobile Detection Usage**
Used throughout components for:
- Responsive layout decisions
- Touch vs mouse interaction handling
- Mobile-specific feature toggling
- Screen size dependent component rendering

These hooks provide essential cross-cutting functionality that enhances the user experience and development efficiency of the Domain Intelligence Platform.


# Components - Frontend UI Architecture

*Last Updated: January 18, 2025 at 10:35 PM*

## Purpose
This folder contains all React components that power the Domain Intelligence Platform frontend. Components are organized by function and follow modern React patterns with TypeScript, shadcn/ui design system, and TanStack Query for state management.

## Component Categories

### **UI Foundation (`ui/` folder)**
Complete shadcn/ui component library providing:
- **Form Controls**: `input.tsx`, `button.tsx`, `checkbox.tsx`, `radio-group.tsx`, `select.tsx`, `textarea.tsx`
- **Layout Components**: `card.tsx`, `dialog.tsx`, `sheet.tsx`, `tabs.tsx`, `accordion.tsx`, `separator.tsx`
- **Navigation**: `navigation-menu.tsx`, `breadcrumb.tsx`, `menubar.tsx`, `sidebar.tsx`
- **Feedback**: `alert.tsx`, `toast.tsx`, `progress.tsx`, `skeleton.tsx`, `badge.tsx`
- **Data Display**: `table.tsx`, `chart.tsx`, `calendar.tsx`, `avatar.tsx`, `tooltip.tsx`
- **Interaction**: `dropdown-menu.tsx`, `context-menu.tsx`, `hover-card.tsx`, `popover.tsx`, `command.tsx`

### **Core Application Components**

#### **Data Management & Upload**
- **`file-upload.tsx`** - Drag-and-drop file interface with validation
  - Supports CSV, TXT file formats
  - Real-time file validation and preview
  - Integration with batch processing pipeline

#### **Results & Analytics**
- **`results-table.tsx`** - Comprehensive domain results display
  - Sortable columns with extraction confidence
  - Status filtering (success/failed/pending)
  - GLEIF entity validation indicators
  - Pagination and search functionality

- **`session-results.tsx`** - Real-time processing session viewer
  - Live updates during batch processing
  - Progress tracking with detailed metrics
  - Individual domain status monitoring

- **`stats-cards.tsx`** - Key performance metrics dashboard
  - Success rates and processing statistics
  - GLEIF enhancement coverage
  - Business intelligence categorization breakdown

#### **Processing & Status**
- **`processing-status.tsx`** - Real-time batch processing monitor
  - Live progress indicators
  - Concurrent domain processing status
  - Error handling and retry mechanisms
  - Circuit breaker pattern visualization

- **`activity-feed.tsx`** - System activity timeline
  - Recent batch processing events
  - User actions and system responses
  - Error logs and resolution tracking

#### **Analytics & Intelligence**
- **`analytics-dashboard.tsx`** - Comprehensive processing analytics
  - Success rate trending over time
  - Method effectiveness comparison
  - Geographic distribution analysis
  - Performance optimization insights

- **`level2-analytics-dashboard.tsx`** - GLEIF integration analytics
  - Level 2 enhancement success rates
  - Entity validation accuracy metrics
  - Knowledge base growth tracking
  - Corporate relationship discovery

#### **GLEIF Integration Components**
- **`gleif-candidates-modal.tsx`** - GLEIF entity candidate selection
  - Multi-candidate entity matching interface
  - Confidence scoring visualization
  - Manual verification workflow
  - False positive prevention

- **`gleif-knowledge-graph.tsx`** - Entity relationship visualization
  - Corporate structure mapping
  - Parent-subsidiary relationships
  - Cross-domain entity connections
  - Interactive graph navigation

- **`raw-gleif-display.tsx`** - Raw GLEIF API response viewer
  - Complete entity data inspection
  - JSON response formatting
  - Legal entity validation details
  - Jurisdictional information display

#### **Testing & Development**
- **`single-domain-test.tsx`** - Individual domain testing interface
  - Real-time extraction testing
  - Method comparison (Axios vs Puppeteer vs Playwright)
  - Performance benchmarking
  - Debug information display

- **`batch-logs.tsx`** - Comprehensive batch processing logs
  - Detailed extraction logs per domain
  - Error analysis and debugging
  - Performance metrics tracking
  - AI-ready log generation

#### **System Monitoring**
- **`recent-changes.tsx`** - Code change tracking display
  - Assistant-driven development history
  - Feature implementation timeline
  - Bug fix and enhancement tracking
  - System evolution monitoring

## Component Architecture Patterns

### **State Management Strategy**
- **TanStack Query**: Server state management for API calls
- **React Hooks**: Local component state (useState, useEffect)
- **Context Pattern**: Minimal use for theme and auth state
- **Props Down**: Data flow through component hierarchy

### **TypeScript Integration**
- **Interface Definitions**: Strong typing for all component props
- **API Response Types**: Shared schemas from `shared/` directory
- **Event Handling**: Typed event handlers and callbacks
- **Generic Components**: Reusable components with type parameters

### **Design System Compliance**
- **shadcn/ui Foundation**: Consistent design language
- **Tailwind CSS**: Utility-first styling approach
- **Responsive Design**: Mobile-first responsive patterns
- **Accessibility**: ARIA compliance and keyboard navigation

## Real-Time Features

### **Live Updates**
- **WebSocket Integration**: Real-time processing updates
- **Query Invalidation**: Automatic data refresh
- **Optimistic Updates**: Immediate UI feedback
- **Error Boundaries**: Graceful error handling

### **Processing Visualization**
- **Progress Indicators**: Visual processing status
- **Success/Failure States**: Clear result indication
- **Performance Metrics**: Real-time timing data
- **Batch Coordination**: Multi-domain processing tracking

## Business Intelligence Integration

### **Classification Display**
- **Entity Categories**: Technology, Financial, Healthcare, Manufacturing
- **Acquisition Targets**: Good Target vs Skip vs Manual Review
- **Geographic Intelligence**: Country detection with confidence
- **Legal Entity Validation**: Corporate suffix requirements

### **GLEIF Enhancement Visualization**
- **Validation Status**: Official entity verification indicators
- **Confidence Scoring**: Multi-level validation confidence
- **Corporate Relationships**: Parent-subsidiary discovery
- **Knowledge Accumulation**: Cross-batch intelligence building

## Performance Optimization

### **Rendering Optimization**
- **React.memo**: Prevent unnecessary re-renders
- **useMemo/useCallback**: Expensive calculation memoization
- **Virtual Scrolling**: Large dataset handling
- **Lazy Loading**: Code splitting for optimal bundle size

### **Data Loading Strategy**
- **Suspense Boundaries**: Loading state management
- **Error Boundaries**: Error state isolation
- **Infinite Queries**: Paginated data loading
- **Background Refetching**: Keep data fresh without blocking UI

## Usage Guidelines

### **Component Development**
1. Follow the existing TypeScript interface patterns
2. Use shadcn/ui components as building blocks
3. Implement proper error boundaries and loading states
4. Include accessibility attributes (ARIA labels, roles)
5. Use TanStack Query for server state management

### **State Management Best Practices**
- Keep server state in TanStack Query
- Use local state for UI-only concerns
- Lift state up when sharing between components
- Avoid prop drilling with context when necessary

### **Testing Strategy**
- Unit tests for individual component logic
- Integration tests for component interactions
- E2E tests for critical user workflows
- Visual regression testing for UI consistency

### **Performance Considerations**
- Monitor bundle size impact of new components
- Use React DevTools Profiler for performance analysis
- Implement proper memoization for expensive operations
- Consider virtualization for large data sets

## Integration Patterns

### **API Integration**
- All server communication through TanStack Query
- Consistent error handling across components
- Automatic retry logic for failed requests
- Optimistic updates for better user experience

### **Router Integration**
- Wouter for client-side routing
- URL state management for shareable links
- Navigation guards for authentication
- Deep linking support for application state

### **Theme Integration**
- CSS variables for consistent theming
- Dark/light mode support
- Responsive breakpoint patterns
- Accessible color contrast ratios

This component architecture provides a scalable foundation for the Domain Intelligence Platform frontend with enterprise-grade reliability and modern React development patterns.


# Frontend Application

*Created: July 12, 2025 at 2:52 AM UTC*

This folder contains the React + TypeScript frontend application for the Domain Intelligence Platform.

## Application Architecture

### **Technology Stack**
- **React 18** - Modern React with hooks and concurrent features
- **TypeScript** - Type-safe development environment
- **Vite** - Fast development server and build tool
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - High-quality UI component library
- **React Query** - Server state management and caching

### **Build System**
- **Development**: Vite dev server on port 3000
- **Production**: Optimized static build with code splitting
- **Hot Reload**: Instant updates during development
- **TypeScript**: Compile-time type checking

## Project Structure

### **`/src/components/`**
React components organized by functionality:

#### **UI Components (`/ui/`)**
- Complete shadcn/ui component library
- Accessible, customizable design system
- Form controls, navigation, data display
- Consistent styling and behavior patterns

#### **Feature Components**
- **`analytics-dashboard.tsx`** - Comprehensive analytics visualization
- **`batch-logs.tsx`** - Real-time batch processing logs
- **`file-upload.tsx`** - Domain list upload interface
- **`gleif-knowledge-graph.tsx`** - Interactive entity relationship visualization
- **`processing-status.tsx`** - Live processing status updates
- **`results-table.tsx`** - Domain extraction results display
- **`single-domain-test.tsx`** - Individual domain testing interface

### **`/src/pages/`**
Application page components:

#### **Core Pages**
- **`dashboard.tsx`** - Main application dashboard
- **`analytics.tsx`** - Advanced analytics and insights
- **`batch-logs.tsx`** - Processing logs and monitoring
- **`knowledge-graph.tsx`** - GLEIF entity relationship explorer

#### **Testing & Development**
- **`beta-testing.tsx`** - Beta extraction method testing
- **`gleif-testing.tsx`** - GLEIF API integration testing
- **`perplexity-testing.tsx`** - AI-powered extraction testing
- **`scraping-testing.tsx`** - Web scraping method validation
- **`smoke-testing.tsx`** - Quick validation testing

#### **Reference & Guidance**
- **`jurisdictional-guide.tsx`** - Global jurisdiction information
- **`parsing-rules.tsx`** - Domain parsing rule documentation
- **`global-expansion-status.tsx`** - International coverage status

### **`/src/hooks/`**
Custom React hooks:
- **`use-toast.ts`** - Toast notification management
- **`use-mobile.tsx`** - Mobile responsiveness detection

### **`/src/lib/`**
Utility libraries:
- **`queryClient.ts`** - React Query configuration
- **`utils.ts`** - Common utility functions and helpers

## Key Features

### **Domain Intelligence Dashboard**
- **Batch Processing**: Upload and process large domain lists
- **Real-time Status**: Live updates on processing progress
- **Results Analysis**: Comprehensive extraction results with confidence scoring
- **Export Capabilities**: Download results in multiple formats

### **GLEIF Integration Interface**
- **Entity Search**: Search and validate legal entities
- **Knowledge Graph**: Visual relationship mapping
- **Corporate Intelligence**: Detailed entity information and relationships
- **Validation Tools**: Verify extraction accuracy against authoritative data

### **Beta Testing Platform**
- **Method Comparison**: Side-by-side extraction method testing
- **Performance Analysis**: Speed and accuracy benchmarking
- **AI Testing**: Perplexity and LLM-based extraction validation
- **Development Tools**: Testing interfaces for new extraction methods

### **Analytics & Monitoring**
- **Processing Metrics**: Batch success rates and performance trends
- **Geographic Analysis**: Domain distribution and regional insights
- **Confidence Scoring**: Extraction quality assessment
- **Error Analysis**: Failed extraction categorization and debugging

## Development Workflow

### **Component Development**
1. **Create Component**: Add new component in appropriate directory
2. **Type Safety**: Use TypeScript interfaces for props and state
3. **Styling**: Use Tailwind CSS classes for consistent design
4. **Testing**: Ensure component works across different data states
5. **Integration**: Connect to backend APIs via React Query

### **API Integration**
```typescript
// Example API integration pattern
const { data, isLoading, error } = useQuery({
  queryKey: ['batches'],
  queryFn: () => fetch('/api/batches').then(res => res.json()),
  refetchInterval: 3000 // Real-time updates
});
```

### **State Management**
- **Server State**: React Query for API data caching and synchronization
- **UI State**: React hooks (useState, useReducer) for component state
- **Global State**: Context API for cross-component shared state
- **Form State**: Controlled components with validation

## UI/UX Design Principles

### **Responsive Design**
- **Mobile First**: Optimized for mobile devices
- **Breakpoint System**: Tailwind responsive utilities
- **Touch Friendly**: Appropriate touch targets and interactions
- **Performance**: Optimized for all device types

### **Accessibility**
- **Keyboard Navigation**: Full keyboard accessibility
- **Screen Readers**: ARIA labels and semantic HTML
- **Color Contrast**: WCAG compliant color schemes
- **Focus Management**: Clear focus indicators

### **User Experience**
- **Real-time Updates**: Live processing status and results
- **Loading States**: Clear feedback during operations
- **Error Handling**: User-friendly error messages
- **Progressive Enhancement**: Works without JavaScript basics

## API Communication

### **REST API Integration**
- **Base URL**: `/api/` for all backend endpoints
- **Authentication**: Header-based API key authentication
- **Error Handling**: Standardized error response processing
- **Caching**: Intelligent caching with React Query

### **Real-time Features**
- **Polling**: 3-second interval for live updates
- **WebSocket Ready**: Architecture prepared for WebSocket integration
- **Optimistic Updates**: Immediate UI updates with background sync
- **Offline Support**: Graceful degradation when offline

## Performance Optimization

### **Bundle Optimization**
- **Code Splitting**: Route-based lazy loading
- **Tree Shaking**: Unused code elimination
- **Asset Optimization**: Image and asset compression
- **Caching Strategy**: Intelligent browser caching

### **Runtime Performance**
- **Virtualization**: Large data set rendering optimization
- **Memoization**: React.memo and useMemo for expensive operations
- **Debouncing**: Input handling optimization
- **Lazy Loading**: Component and route lazy loading

## Testing Strategy

### **Component Testing**
- **Unit Tests**: Individual component functionality
- **Integration Tests**: Component interaction testing
- **Accessibility Tests**: ARIA and keyboard navigation
- **Visual Regression**: UI consistency testing

### **User Experience Testing**
- **End-to-End**: Complete user workflow testing
- **Performance Testing**: Load time and responsiveness
- **Cross-Browser**: Compatibility across browsers
- **Mobile Testing**: Touch and responsive behavior

## Deployment Configuration

### **Build Process**
- **Development**: `npm run dev` - Vite dev server
- **Production**: `npm run build` - Optimized static build
- **Preview**: `npm run preview` - Production build preview
- **Type Check**: `npm run type-check` - TypeScript validation

### **Environment Configuration**
- **API Endpoints**: Environment-based backend URLs
- **Feature Flags**: Conditional feature enabling
- **Analytics**: User behavior tracking configuration
- **Error Reporting**: Crash and error monitoring

## Integration Points

### **Backend Services**
- **Domain Processing**: Upload and batch processing
- **GLEIF API**: Legal entity validation and intelligence
- **Beta Testing**: Experimental extraction method testing
- **Analytics**: Processing metrics and insights

### **External Services**
- **File Upload**: Domain list file processing
- **Export Services**: Results download and formatting
- **Monitoring**: Application performance tracking
- **User Feedback**: Error reporting and user insights

This React frontend provides a comprehensive, user-friendly interface for the Domain Intelligence Platform, enabling efficient domain processing, analysis, and validation with real-time updates and advanced analytics capabilities.

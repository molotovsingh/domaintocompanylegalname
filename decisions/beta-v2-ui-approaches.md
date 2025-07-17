# Beta Platform v2 UI Design Approaches

This document stores different UI approach options for the Beta Platform v2. The chosen approach is the **Minimalist Developer UI**.

## Chosen Approach: Minimalist Developer UI

```
Domain: [___________] 
Method: [Playwright Dump ▼]
[Start Dump]

Status: Collecting...
Progress: HTML ✓ | Screenshots ⚡ | Network ○
```

**Characteristics:**
- Single purpose interface
- Minimal visual noise
- Focus on core functionality
- Quick status indicators
- No unnecessary features

## Alternative Approaches (For Reference)

### Debug-Focused UI

```
Domain: [___________]
[Start] [View Logs] [Download Raw]

=== Live Console ===
[2025-01-12 10:15:01] Starting browser...
[2025-01-12 10:15:02] Navigating to domain...
[2025-01-12 10:15:03] Collecting HTML...
[2025-01-12 10:15:04] Page loaded, collecting screenshots...
[2025-01-12 10:15:05] Network: 134 requests captured
[2025-01-12 10:15:06] Console: 12 messages logged
[2025-01-12 10:15:07] Dump complete: 2.3MB collected
```

**Benefits:**
- Real-time visibility into collection process
- Helpful for debugging issues
- Detailed logging for troubleshooting
- Direct download access

### Data Inspector UI

```
Domain: example.com
Method: Playwright Dump
Status: Complete

[Input Section]
[Results Tree View]
  ├─ HTML (2.3 MB) [View] [Download]
  ├─ Screenshots (5) [Expand ▼]
  │  ├─ full-page.png (1.2 MB)
  │  ├─ above-fold.png (800 KB)
  │  └─ ...
  ├─ Network Logs (134 requests) [View JSON]
  ├─ Console Output (12 messages) [View]
  └─ Metadata [View]
     ├─ Collection Time: 4.2s
     ├─ Browser: Chromium 120
     └─ Viewport: 1920x1080

[Export All] [Export Selected]
```

**Benefits:**
- Detailed data exploration
- Selective viewing/downloading
- Good for analyzing what was collected
- Tree structure shows data hierarchy

### Workflow UI

```
Beta Platform v2 - Data Collection

Step 1: Choose Collection Method
┌─────────────────────────┐
│ ○ Playwright Dump       │
│ ○ Scrapy Crawl         │
│ ○ Crawlee Extract      │
└─────────────────────────┘

Step 2: Configure Collection
┌─────────────────────────┐
│ Domain: [____________]  │
│ □ Include screenshots   │
│ □ Capture network logs  │
└─────────────────────────┘

Step 3: Review Results
┌─────────────────────────┐
│ Collection complete!    │
│ [View Data] [Download]  │
└─────────────────────────┘

[← Previous] [Next →] [Start Over]
```

**Benefits:**
- Guided process
- Clear steps
- Good for new users
- Configurable options

### Dashboard Style UI

```
╔════════════════════════════════════════════╗
║        Beta Platform v2 - Collection Hub    ║
╠════════════════════════════════════════════╣
║                                            ║
║  Recent Collections                        ║
║  ┌────────────────────────────────────┐   ║
║  │ apple.com    | Playwright | 2.3MB  │   ║
║  │ google.com   | Scrapy     | 1.1MB  │   ║
║  │ amazon.com   | Crawlee    | 5.2MB  │   ║
║  └────────────────────────────────────┘   ║
║                                            ║
║  Quick Collection                          ║
║  Domain: [__________] Method: [____▼]      ║
║  [Start Collection]                        ║
║                                            ║
║  Statistics                                ║
║  • Total Dumps: 1,234                      ║
║  • Storage Used: 4.5 GB                    ║
║  • Active Methods: 3                       ║
╚════════════════════════════════════════════╝
```

**Benefits:**
- Overview of all activity
- Quick access to history
- Statistics at a glance
- Professional appearance

## Design Principles for v2

1. **Focus on Function**: UI should not distract from core purpose
2. **Developer-First**: Assume technical users who understand the process
3. **Speed**: Minimal clicks to start a collection
4. **Clarity**: Clear indication of what's happening
5. **No Analysis**: Just collection, no interpretation in UI
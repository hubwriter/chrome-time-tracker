# Chrome Time Tracker - Product Requirements Document

**Last updated**: October 1, 2025
**Status**: Current Implementation
**Version**: 1.0

## Overview

Chrome Time Tracker is a browser extension that automatically tracks time spent on different websites, providing users with detailed insights into their browsing habits. The extension captures website URLs (normalized by removing query parameters and fragments), measures active time spent on each site with a 3-second minimum threshold, and offers a calendar-based interface with real-time data updates to view historical browsing data. It solves the problem of understanding where time is spent online, helping users make informed decisions about their digital habits and productivity.

## User Scenarios & Testing

### Primary User Story
A productivity-conscious professional wants to understand their browsing habits to optimize their work time. They install the Chrome Time Tracker extension, configure their preferences through the extension options, and the system automatically begins tracking their website usage. They can view daily statistics through an interactive calendar interface with real-time updates, temporarily pause tracking with an auto-resume feature when needed, and customize their startup experience.

### Acceptance Scenarios
1. **Given** a new user installs the extension, **When** they click the extension icon, **Then** they see a welcome page with feature explanations and startup preference controls
2. **Given** the extension is tracking, **When** a user browses websites for 3+ seconds, **Then** time is automatically recorded and displayed in daily statistics with normalized URLs
3. **Given** a user wants privacy, **When** they disable tracking, **Then** they can optionally enable a 10-minute auto-resume timer with visual countdown
4. **Given** a user views statistics, **When** they select any past date from the calendar, **Then** they see detailed time breakdowns with interactive pie charts
5. **Given** a user wants current data, **When** auto-refresh is enabled, **Then** statistics update automatically every 10 seconds with change notifications
6. **Given** a user wants to customize settings, **When** they access extension options, **Then** they can control welcome page behavior and other preferences

### Edge Cases
- What happens when tracking is disabled and the 10-minute auto-resume timer expires?
- How does the system handle rapid tab switching or visits shorter than 3 seconds?
- What occurs when storage quota is reached or data corruption happens?
- How are URLs with different query parameters or fragments consolidated?

## Requirements

### Functional Requirements

#### Core Tracking System
- **FR-001**: System MUST automatically track time spent on websites when Chrome has focus
- **FR-002**: System MUST record full URL paths normalized by removing query parameters and fragments
- **FR-003**: System MUST exclude Chrome internal pages (chrome://) and extension pages
- **FR-004**: System MUST apply a 3-second minimum threshold before recording page visits
- **FR-005**: System MUST persist tracking state across browser sessions
- **FR-006**: System MUST handle tab switching and window focus changes accurately

#### URL Normalization
- **FR-007**: System MUST normalize URLs by removing query parameters (everything after ?)
- **FR-008**: System MUST normalize URLs by removing fragments (everything after #)
- **FR-009**: System MUST preserve protocol, hostname, and pathname in normalized URLs
- **FR-010**: System MUST aggregate time for different variations of the same normalized URL

#### User Interface & Navigation
- **FR-011**: System MUST provide a monthly calendar interface for date selection
- **FR-012**: System MUST allow navigation to previous months (current month + 2 months back)
- **FR-013**: System MUST disable future dates and show visual indicators for days with data
- **FR-014**: System MUST display statistics in both tabular format (top 20 + expandable) and interactive pie charts
- **FR-015**: System MUST provide bookmarkable URLs for specific dates (e.g., ?date=2025-01-15)

#### Real-Time Features
- **FR-016**: System MUST provide auto-refresh functionality updating data every 10 seconds
- **FR-017**: System MUST allow users to toggle auto-refresh on/off
- **FR-018**: System MUST provide manual refresh button with visual feedback
- **FR-019**: System MUST show change notifications when auto-refresh detects data updates
- **FR-020**: System MUST respect page visibility (pause auto-refresh when page is hidden)

#### Privacy & Control Features
- **FR-021**: System MUST provide tracking enable/disable toggle with immediate effect
- **FR-022**: System MUST offer 10-minute auto-resume timer when tracking is disabled
- **FR-023**: System MUST display countdown timer with cancel/restart functionality
- **FR-024**: System MUST save current tracking session before disabling (if meets 3s threshold)

#### Data Visualization
- **FR-025**: System MUST generate pie charts showing websites with ≥1% of total time
- **FR-026**: System MUST use domain-consistent colors for related websites
- **FR-027**: System MUST allow users to hide/show chart entries via legend clicks
- **FR-028**: System MUST display time in natural format: "2 hours, 34 minutes, 58 seconds"
- **FR-029**: System MUST shorten long URLs for display while preserving meaning
- **FR-030**: System MUST hide chart when "Show All URLs" mode is active

#### Extension Options & Preferences
- **FR-031**: System MUST provide Chrome-integrated options page accessible from extension management
- **FR-032**: System MUST allow users to control welcome page startup behavior
- **FR-033**: System MUST sync preferences between welcome page and options page
- **FR-034**: System MUST remember user preferences across extension updates
- **FR-035**: System MUST provide save functionality with success/error feedback

#### Welcome Page Experience
- **FR-036**: System MUST provide comprehensive feature overview with visual elements
- **FR-037**: System MUST include startup preference checkbox (checked by default)
- **FR-038**: System MUST save startup preference changes immediately
- **FR-039**: System MUST provide smooth navigation to statistics page

#### Data Management
- **FR-040**: System MUST automatically clean up data older than 3 months (current + 2 previous months)
- **FR-041**: System MUST run cleanup every 6 hours transparently in background
- **FR-042**: System MUST store daily data in format: data_YYYY-MM-DD
- **FR-043**: System MUST maintain cleanup metadata for debugging and monitoring

### Key Entities

- **Daily Time Data**: Website URL (normalized) mapped to milliseconds spent, stored per date
- **Tracking State**: Boolean flag controlling active/inactive tracking with persistence
- **Auto-Resume Timer**: Active timer with start time, end time, and countdown display
- **User Preferences**: Welcome page display settings, auto-refresh preferences, and options
- **Chart State**: Hidden items set, visibility preferences, and interactive state
- **Cleanup Metadata**: Last cleanup timestamp, removed entries count, and cutoff dates
- **Normalized URLs**: URLs with query parameters and fragments removed for aggregation

## Technical Architecture

### System Components
- **Background Service Worker**: Handles time tracking, tab monitoring, auto-resume timers, URL normalization, and automatic data cleanup
- **Statistics Page**: Interactive calendar interface with real-time data visualization and user controls
- **Welcome Page**: Onboarding interface with feature explanations and preference settings
- **Options Page**: Chrome-integrated settings page for extension configuration

### Data Storage Structure
```
Chrome Local Storage:
├── data_YYYY-MM-DD: { "normalizedURL": milliseconds, ... }
├── isTracking: boolean
├── autoResumeTimer: { endTime, active, startTime }
├── showWelcomeOnStartup: boolean
└── lastAutomaticCleanup: { timestamp, removedEntries, cutoffDate }
```

### Message Passing System
- **getTrackingState**: Returns current tracking enabled/disabled status
- **enableTracking**: Activates tracking and starts monitoring current tab
- **disableTracking**: Saves current session and deactivates tracking
- **startAutoResumeTimer**: Coordinates 10-minute timer between UI and background
- **cancelAutoResumeTimer**: Stops active auto-resume timer

### URL Normalization Process
```javascript
Input: "https://docs.github.com/en/copilot/tutorials#section?param=value"
Process: Remove query parameters (?param=value) and fragments (#section)
Output: "https://docs.github.com/en/copilot/tutorials"
Storage: All variations stored under normalized URL
```

## User Experience Features

### Welcome Page Experience
- **Comprehensive Overview**: Feature explanations with visual icon and clear descriptions
- **Usage Instructions**: Step-by-step guidance for accessing statistics
- **Repository Information**: Extension details and source code links
- **Startup Control**: Checkbox to control welcome page display on startup (checked by default)
- **Smooth Navigation**: Direct link to statistics page with proper button styling

### Statistics Page Experience
- **Real-Time Updates**: Auto-refresh every 10 seconds with toggle control and change notifications
- **Interactive Calendar**: Monthly view with navigation controls (current + 2 months back)
- **Comprehensive Data Display**: Table view (top 20 + expand all) with time sorting
- **Interactive Charts**: Pie charts with click-to-hide legend items and 1% threshold filtering
- **Manual Controls**: Refresh button with progress indicators and tracking toggle
- **Auto-Resume Interface**: 10-minute countdown timer with cancel/restart functionality

### Extension Options Experience
- **Chrome Integration**: Accessible from chrome://extensions/ management page
- **Clear Preferences**: Startup behavior control with descriptive explanations
- **Visual Feedback**: Save functionality with success/error status messages
- **Keyboard Support**: Ctrl+S / Cmd+S shortcuts for saving preferences

### Privacy & Control Experience
- **Immediate Feedback**: One-click tracking toggle with instant visual confirmation
- **Transparent Timers**: Auto-resume countdown with real-time display and control
- **Data Threshold**: 3-second minimum ensures only meaningful visits are recorded
- **Automatic Cleanup**: 6-hour cleanup cycle with no user intervention required
- **URL Privacy**: Query parameters and fragments removed to protect sensitive data

### Real-Time Features
- **Auto-Refresh System**: 10-second updates with page visibility detection
- **Change Detection**: Notifications when new data is detected
- **Manual Override**: User-controlled refresh with visual progress indication
- **Performance Optimization**: Pauses when page is not visible to save resources

## Implementation Status

### Completed Features
- ✅ Automatic time tracking with 3-second threshold
- ✅ URL normalization (removes query parameters and fragments)
- ✅ Calendar-based statistics interface (current + 2 months back)
- ✅ Interactive pie charts with legend manipulation
- ✅ Real-time auto-refresh (10-second intervals)
- ✅ 10-minute auto-resume timer with countdown
- ✅ Extension options page (Chrome-integrated)
- ✅ Welcome page with startup preference control
- ✅ Automatic data cleanup (6-hour intervals, 3-month retention)
- ✅ Manual refresh controls with visual feedback
- ✅ Expandable URL list (top 20 + show all)
- ✅ Bookmarkable date URLs
- ✅ Domain-consistent chart coloring
- ✅ Time formatting in natural language
- ✅ Mobile-responsive design

### Architecture Details
- **Minimum Visit Duration**: 3 seconds (configurable via CONFIG.MIN_VISIT_DURATION_MS)
- **Auto-Refresh Interval**: 10 seconds with page visibility detection
- **Auto-Resume Timer**: 10 minutes (configurable, not 30 minutes as originally planned)
- **Data Cleanup**: Every 6 hours, keeping current + 2 previous months
- **Storage Format**: Normalized URLs mapped to milliseconds per day
- **Chart Filtering**: Shows only URLs with ≥1% of total daily time

## Future Enhancements

*Note: Current implementation is feature-complete. No additional enhancements are planned at this time.*

---

**Extension Information:**
**Created**: September 30, 2025
**Last Updated**: October 1, 2025
**Repository**: [hubwriter/chrome-time-tracker](https://github.com/hubwriter/chrome-time-tracker)
**Chrome Web Store**: Not yet published
**License**: MIT License
**Current Version**: 1.0

**Technical Specifications:**
- Minimum Chrome Version: Latest stable (Manifest V3)
- Storage Type: chrome.storage.local
- Update Frequency: 10-second intervals for real-time features
- Data Retention: 3 months rolling window (automatic cleanup)
- Time Threshold: 3-second minimum for visit recording
- URL Normalization: Removes query parameters and fragments

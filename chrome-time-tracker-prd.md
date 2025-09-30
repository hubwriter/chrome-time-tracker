# Chrome Time Tracker - Product Requirements Document

## Overview

Chrome Time Tracker is a browser extension that automatically tracks time spent on different websites, providing users with detailed insights into their browsing habits. The extension captures the full URL path (excluding query parameters) and measures active time spent on each site, offering a calendar-based interface to view historical browsing data. It solves the problem of understanding where time is spent online, helping users make informed decisions about their digital habits and productivity.

## Core Features

### Automatic Time Tracking
- **What it does**: Tracks time spent on websites automatically when Chrome has focus
- **Why it's important**: Provides passive, accurate measurement of browsing habits without manual intervention
- **How it works**: Monitors active tab URLs and measures time spent when Chrome is the focused application, with a 5-second minimum threshold to filter out quick navigation

### URL Path Tracking
- **What it does**: Records the full URL path (excluding query parameters) and treats subdomains as separate entries
- **Why it's important**: Provides meaningful granularity (e.g., github.com/user/repo/issues) without noise from temporary parameters
- **How it works**: Captures and normalizes URLs to track distinct paths while maintaining subdomain separation

### Calendar-Based Statistics Interface
- **What it does**: Displays a monthly calendar interface for browsing historical data
- **Why it's important**: Provides intuitive navigation through time-based data with visual context
- **How it works**: Shows current month calendar with past days selectable, future days greyed out, with navigation to previous months (up to 2 months back)

### Daily Browsing Statistics
- **What it does**: Shows detailed breakdown of time spent on websites for selected days
- **Why it's important**: Enables users to understand their daily browsing patterns and identify time sinks
- **How it works**: Displays table of up to 20 URLs with expandable view, accompanied by pie chart visualization

### Privacy Controls
- **What it does**: Provides user control over tracking with on/off toggle and auto-resume functionality
- **Why it's important**: Gives users control over their data and privacy
- **How it works**: Toggle on statistics page with optional 30-minute auto-resume feature

## User Experience

### User Personas
- **Productivity-conscious professionals**: Want to understand and optimize their browsing habits
- **Remote workers**: Need insights into time allocation across different work-related sites
- **Digital wellness advocates**: Seeking awareness of their online time consumption

### Key User Flows
1. **First-time setup**: Install extension → Welcome screen → Automatic tracking begins
2. **Daily usage**: Browse normally → Extension tracks in background → Check stats periodically
3. **Data review**: Click extension → Open statistics page → Select day → Review time breakdown
4. **Privacy control**: Navigate to stats → Toggle tracking off/on → Optionally enable auto-resume

### UI/UX Considerations
- Clean, minimal interface focused on data presentation
- Consistent domain colors in pie charts with contrasting adjacent segments
- Time displayed in natural format: "2 hours, 34 minutes, 58 seconds" (omitting zero values)
- Bookmarkable URLs for specific dates: `chrome-extension://[id]/stats?date=2024-01-15`
- Icon combining web page and time elements for clear purpose communication

## Technical Architecture

### System Components
- **Background Script**: Handles time tracking, focus detection, and data persistence
- **Content Script**: Minimal or none required due to tab API usage
- **Statistics Page**: Dedicated HTML page with calendar and data visualization
- **Welcome Page**: Onboarding interface for first-time users

### Data Models
- **Daily Records**: Date → URL → Time spent mapping
- **Settings**: Tracking state, auto-resume timers, user preferences
- **Metadata**: Installation date, repository information

### APIs and Integrations
- Chrome Tabs API for URL monitoring and tab change detection
- Chrome Storage API (local) for data persistence
- Chrome Windows API for focus detection
- Chart.js or similar for pie chart visualization

### Infrastructure Requirements
- Local storage only (no external services)
- 3-month rolling data retention (current + 2 previous months)
- Background processing for continuous tracking
- 10-second interval checks for focus state

## Development Roadmap

### MVP Requirements
- Basic time tracking functionality with 5-second threshold
- Focus detection and timer pausing
- Simple statistics page with daily data table
- Calendar interface for date selection
- On/off tracking toggle
- Welcome/onboarding screen
- Data retention and cleanup (3-month window)

### Phase 2 Enhancements
- Pie chart visualization with domain-consistent coloring
- Auto-resume functionality (30-minute timer)
- Enhanced calendar navigation
- URL expansion feature (show all vs top 20)
- Bookmarkable date URLs

## Logical Dependency Chain

### Foundation Phase
1. **Extension structure and manifest** - Required before any other development
2. **Basic time tracking** - Core functionality that everything else builds upon
3. **Data storage system** - Needed before building any interface features

### Interface Development Phase
4. **Welcome/onboarding page** - Simple starting point for UI development
5. **Basic statistics page** - Foundation for data display
6. **Calendar interface** - Navigation system for historical data

### Enhancement Phase
7. **Advanced features** - Pie charts, auto-resume, URL expansion
8. **Polish and optimization** - Performance tuning, edge case handling

## Risks and Mitigations

### Technical Challenges
- **Focus detection accuracy**: Mitigation through Chrome Windows API and 10-second polling
- **Data persistence during crashes**: Mitigation by saving on tab changes and focus loss events
- **Performance impact**: Mitigation through efficient polling intervals and minimal background processing

### MVP Scope Management
- **Feature creep risk**: Mitigation by clearly defining MVP boundaries and deferring enhancements
- **Complexity management**: Mitigation through incremental development approach

### Resource Constraints
- **Browser API limitations**: Mitigation through Chrome extension best practices and permission management
- **Storage limitations**: Mitigation through 3-month data retention policy

## Appendix

### Development Information
- Extension creation date: September 30, 2025
- Repository: To be created under hubwriter GitHub account
- Target repository naming: hubwriter/chrome-time-tracker

### Technical Specifications
- Minimum Chrome version: Latest stable
- Storage type: chrome.storage.local
- Update frequency: 10-second intervals for tracking
- Data retention: 3 months rolling window
- Time format: Natural language with zero omission
# Design Guidelines: Chinese Character Learning App

## Design Approach
**Design System: Material Design-Inspired Educational Interface**

This is a utility-focused educational application where clarity, efficiency, and information hierarchy are paramount. The design draws from Material Design principles with emphasis on clean layouts, clear typography, and purposeful interactions suited for focused learning sessions.

## Typography

**Primary Font Family:**
- Interface text: Inter or Roboto (clean, highly legible sans-serif)
- Chinese characters: Kaiti (楷体/標楷體) - traditional brush calligraphy style font for authentic stroke visualization

**Type Scale:**
- Detail view character display: **text-9xl** (extremely large, 8rem+)
- Character grid items: **text-6xl** 
- Section headings: **text-2xl font-semibold**
- Body text & definitions: **text-base**
- Pinyin & metadata: **text-sm**
- Small labels: **text-xs**

## Layout System

**Spacing Primitives:** Use Tailwind units of **2, 4, 6, 8, 12, 16**
- Component padding: `p-4` or `p-6`
- Section gaps: `gap-4` or `gap-8`
- Page margins: `m-8` or `m-12`
- Tight spacing: `space-y-2`
- Generous spacing: `space-y-6`

**Container Strategy:**
- Main content: `max-w-6xl mx-auto px-4`
- Detail view: `max-w-4xl mx-auto`
- Character grid: `max-w-5xl mx-auto`

## Component Library

### Authentication Screen
- Centered card layout (`max-w-md`)
- Replit Auth integration with OAuth buttons
- Clean form fields with `p-4` padding
- Prominent "Continue with Google" button

### Home Screen / Dashboard
- **Header bar** with app title, level indicator, simplified/traditional toggle switch
- **Settings panel** for daily character count and current level adjustment
- **Progress overview** showing completion percentage with visual progress bar
- **Character grid** displaying 5 current characters in large Kaiti font, arranged in single row on desktop (`grid-cols-5`), stacked on mobile (`grid-cols-1`)
- Each character card includes three star indicators below character (reading, writing, radical)

### Character Grid Cards
- Large character display centered in card
- Three star icons in row below character (`gap-2`)
- Clickable/tappable entire card area
- Stars are toggleable individually with filled/outlined states
- Subtle border and shadow for card depth

### Detail View Screen
- **Back navigation** button (top-left)
- **Simplified/Traditional toggle** (top-right)
- **Hero character display**: Massive Kaiti character (`text-9xl`) centered, occupying top third of screen
- **Information sections** in vertical stack with `space-y-8`:
  - Pinyin pronunciation (bold, `text-3xl`)
  - Radical display with pinyin (character + romanization)
  - English definition (2-3 meanings in clear list format)
  - Stroke order animation area (placeholder for stroke sequence)
  - Example sentences section (Chinese text `text-lg`, English translation `text-base` in muted color)
  - "Load More Examples" button at bottom of sentences

### Star Rating Component
- Three stars in horizontal row
- Icons: Reading (book icon), Writing (pencil icon), Radical (puzzle piece icon)
- Interactive toggle on tap/click
- Filled state vs outlined state with smooth transition
- Positioned consistently across all character views

### Test Mode Screen
- **Test type selection** (radio buttons or segmented control): Pronunciation / Writing / Radical
- **Starting index input** (number field with validation 0-2500)
- **Test display area**: Shows character/pinyin based on test type in `text-7xl` centered
- **Answer input field** or **multiple choice options** depending on test type
- **Progress indicator** showing question number
- **Submit/Next** action buttons

### Navigation
- Bottom tab bar or side navigation with: Home, Test Mode, Settings
- Clear visual indication of active tab
- Icons with labels for each section

### Settings Screen
- Form layout with clear labels
- Slider for daily character count (1-50 range)
- Number input for current level (0-2500 with validation)
- Toggle for simplified/traditional default
- Save button with confirmation feedback

## Information Architecture

**View Hierarchy:**
1. Authentication → Dashboard (Home)
2. Dashboard → Character Detail View (tap character)
3. Dashboard → Test Mode (navigation)
4. Dashboard → Settings (navigation)
5. All views accessible via persistent navigation

## Interaction Patterns

**Star Toggle Behavior:**
- Tap/click individual star to toggle filled/outlined state
- Immediate visual feedback with subtle scale animation
- State persists across sessions

**Character Navigation:**
- Grid cards are fully tappable/clickable for detail view
- Swipe gestures (mobile) between characters in detail view
- Clear back button returns to grid

**Toggle Switches:**
- Material-style toggle for simplified/traditional
- Immediate content update on toggle
- Position consistently in top-right of relevant screens

**Load More Pattern:**
- "Show More Examples" button below initial 3-5 sentences
- Reveals additional 5 sentences on each tap
- Button text updates to indicate more available

## Visual Hierarchy Principles

1. **Character First**: Chinese characters always largest, most prominent element
2. **Progressive Disclosure**: Show essential info first (pinyin, meaning), details below
3. **Clear Segmentation**: Use spacing and subtle dividers between information sections
4. **Consistent Feedback**: Visual confirmation for all interactions (star toggles, saves, navigation)

## Responsive Behavior

**Desktop (lg:):**
- Character grid: 5 columns horizontal layout
- Detail view: Wide reading width with generous margins

**Tablet (md:):**
- Character grid: 3 columns or scrollable horizontal row
- Maintain large character size

**Mobile:**
- Character grid: Single column stack or 2 columns
- Detail view: Full width with appropriate padding
- Bottom navigation bar for main sections

## Accessibility

- High contrast text on backgrounds
- Touch targets minimum 44px for mobile interactions
- Keyboard navigation support for all interactive elements
- Clear focus states for form inputs and buttons
- Star icons include text labels for screen readers
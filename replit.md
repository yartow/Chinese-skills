# Chinese Character Learning Application

## Overview
A full-stack web application designed to facilitate learning of 3000 common Chinese characters. It offers comprehensive progress tracking, detailed character information including stroke order animations, and interactive testing modes. The application supports three primary study modes: Daily, Standard, and Search, catering to various learning approaches. Its core purpose is to provide an engaging and effective platform for mastering Chinese characters, from beginner to advanced levels.

## User Preferences
I prefer clear, concise explanations and direct answers. I value iterative development and expect to be consulted before any major architectural changes or significant code refactors are implemented. Please prioritize functionality and performance.

## System Architecture
The application is built as a full-stack web application, utilizing React with TypeScript for the frontend and Express.js with TypeScript for the backend. PostgreSQL (hosted on Neon) is used as the primary database, managed with Drizzle ORM.

### UI/UX Decisions
- **Design System**: Tailwind CSS for utility-first styling combined with Shadcn UI components for pre-built, accessible UI elements.
- **Script Toggle**: Users can switch between simplified and traditional Chinese characters globally.
- **Progress Icons**: A three-icon system (BookOpen for reading, PenTool for writing, Grid3x3 for radical) visually tracks character mastery.
- **Character Display**: Large Kaiti font for character details, integrated with Hanzi Writer for stroke order animations.

### Technical Implementations
- **Authentication**: Replit Auth is integrated for user authentication, supporting Google login, email/password, and other OAuth providers.
- **Routing**: Wouter is used for client-side routing.
- **Data Fetching**: TanStack Query manages data fetching, caching, and synchronization.
- **Session Management**: `connect-pg-simple` handles session persistence with PostgreSQL.
- **Character Data**: A comprehensive dataset of 3000 HSK 3.0 characters is included, featuring simplified/traditional forms, pinyin, radicals, English definitions, and example sentences.
- **Progress Tracking**: A granular system tracks user proficiency in reading, writing, and radical recognition for each character, with optimistic updates for immediate UI feedback.
- **Search Functionality**: Allows searching characters by character, pinyin, or English definition.

### Feature Specifications
- **Daily Mode**: Presents characters based on user-defined daily limits and current learning level.
- **Standard Mode**: Enables browsing all characters with configurable pagination and filtering options (HSK level, progress status).
- **Search Mode**: Provides dynamic character search capabilities.
- **User Settings**: Customizable options for daily character count, current learning level, page size, and script preference.
- **Character Details**: Displays extensive information including pinyin, radicals, definitions, and example sentences, alongside interactive stroke order.
- **Test Mode**: Offers three types of tests: pronunciation, writing, and radical recognition, with support for numbered pinyin.

### System Design Choices
- **Database Schema**: Structured to support user profiles, settings, character progress, and the extensive character/radical data. Future expansion for vocabulary is designed with dedicated tables.
- **API Endpoints**: A well-defined RESTful API handles authentication, user settings, character data retrieval, and progress updates.
- **Project Structure**: Organized into `client`, `server`, and `shared` directories for clear separation of concerns.

## External Dependencies
- **PostgreSQL (Neon)**: Relational database for persistent storage.
- **Replit Auth**: Authentication service (OpenID Connect).
- **Hanzi Writer**: JavaScript library for rendering Chinese character stroke order animations.
- **Tailwind CSS**: Utility-first CSS framework.
- **Shadcn UI**: Reusable UI components.
- **TanStack Query**: Data fetching and state management library.
- **Wouter**: Small routing library for React.
- **Drizzle ORM**: TypeScript ORM for PostgreSQL.
- **alyssabedard/chinese-hsk-and-frequency-lists**: Source for character data.
- **Make Me a Hanzi**: Source for radical information, character definitions, and supplementary character data.
- **CC-CEDICT**: Source for Chinese-English dictionary definitions.
- **Tatoeba Project**: Source for authentic Chinese-English example sentences (30,000+ sentence pairs).

## Recent Changes

### January 14, 2026
- **Converted to Progressive Web App (PWA)**: App is now installable on Android/iOS devices
  - Added web manifest (manifest.json) with app metadata and icons
  - Added service worker (sw.js) for offline caching with cache-first for static assets, network-first for API
  - Added PWA meta tags for iOS and Android compatibility
  - Created app icons in multiple sizes (72-512px)
- **Added settings help tooltips**: Three help icons (?) next to settings fields show explanatory tooltips on hover/tap
- **Added auto-progress level feature**: Daily view automatically progresses to the first non-mastered character when opened
  - New API endpoint: GET /api/progress/first-non-mastered/:startIndex finds first character not fully mastered
  - Level updates automatically if current level character is already fully mastered

### January 4, 2026
- **Added four mastery attributes and Progress Overview with 4 progress bars**:
  - `reading_mastered`: Boolean tracking if user has mastered reading the character
  - `writing_mastered`: Boolean tracking if user has mastered writing the character
  - `radical_mastered`: Boolean tracking if user has mastered the character's radical
  - `character_mastered`: Computed field - TRUE only when all three above are TRUE
  - Progress Overview now displays 4 progress bars showing counts for each mastery type
  - New API endpoint: GET /api/progress/stats returns aggregate mastery counts
- **Fixed radical display bug**: Characters now correctly show radical information instead of "()"
- **Added Playwright test infrastructure**: Comprehensive e2e tests in tests/automated-test-1.spec.ts

### November 29, 2025
- **Improved character definitions and example sentences** for all 3000 characters:
  - Updated definitions from Make Me a Hanzi dataset (1993 definitions improved)
  - Added authentic example sentences from Tatoeba corpus (2482 characters now have real sentence pairs)
  - Examples are short, practical Chinese sentences with English translations from native speakers
  - Remaining 518 rare characters still use placeholder examples as they don't appear in common sentence corpora
- **Added alternative pronunciations support** - Characters can have up to 3 pronunciation variants:
  - Added pinyin2, pinyin3 columns for alternative tone-marked pronunciations  
  - Added numberedPinyin, numberedPinyin2, numberedPinyin3 columns for test validation
  - CharacterDetailView displays all alternative pronunciations
  - TestMode accepts any valid pronunciation as correct
- **Added radicals table** - Complete 214 Kangxi radicals with metadata
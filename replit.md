# Chinese Character Learning Application

## Overview
A full-stack web application for learning 3000 common Chinese characters with progress tracking, detailed character information, interactive testing modes, and two study modes (Daily and Standard).

## Features
- **Authentication**: Replit Auth with Google login, email/password, and other OAuth providers
- **Character Database**: 3000 common Chinese characters with simplified/traditional variants (HSK 1-6)
- **Progress Tracking**: Three-icon system tracking reading (BookOpen), writing (PenTool), and radical (Grid3x3) knowledge for each character
- **Daily Mode**: Shows current level characters based on user settings (0-3000 index)
- **Standard Mode**: Browse all characters with configurable pagination (10-100 characters per page)
- **User Settings**: Customizable daily character count, current level (0-3000), and standard mode page size
- **Character Details**: Large Kaiti font display, stroke order animations, pinyin, radicals, definitions, and example sentences
- **Script Toggle**: Switch between simplified and traditional Chinese characters throughout the app (traditional default)
- **Test Mode**: Three testing types (pronunciation, writing, radical recognition) with numbered pinyin support
- **Vocabulary Database**: Multi-character words with HSK levels and progress tracking (future expansion)

## Technology Stack
### Frontend
- React with TypeScript
- Tailwind CSS + Shadcn UI components
- Wouter for routing
- TanStack Query for data fetching
- Hanzi Writer for stroke order animations

### Backend
- Express.js with TypeScript
- PostgreSQL database (Neon)
- Drizzle ORM
- Replit Auth (OpenID Connect)
- Session management with connect-pg-simple

## Database Schema

### Users Table
- Managed by Replit Auth
- Stores user profile information (email, name, profile image)

### Sessions Table
- Required for Replit Auth
- Stores user session data

### User Settings Table
- `currentLevel`: Character index (0-3000)
- `dailyCharCount`: Number of characters to study per day (default: 5)
- `preferTraditional`: Boolean for script preference (default: true)
- `standardModePageSize`: Number of characters per page in standard mode (default: 20, range: 10-100)

### Character Progress Table
- Tracks three-star ratings per character per user
- `reading`: User knows how to read/pronounce
- `writing`: User knows how to write
- `radical`: User knows the radical

### Chinese Characters Table
- 3000 characters with complete metadata
- Simplified and traditional variants (with traditionalVariants array for dual-form characters)
- Pinyin with tone marks, radical and radical pinyin
- English definitions (array)
- Example sentences with translations (JSONB)
- HSK level (1-6)

### Vocabulary Tables (For Future Expansion)
**Chinese Words Table**
- Multi-character words with pinyin and definitions
- HSK level classification
- Example sentences (JSONB)

**Word Progress Table**
- Tracks user knowledge of vocabulary words
- Foreign keys to users and words tables

## Project Structure
```
/
├── client/               # Frontend React application
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── pages/       # Page components
│   │   ├── hooks/       # Custom React hooks (useAuth)
│   │   └── lib/         # Utilities (queryClient, authUtils)
│   └── index.html
├── server/               # Backend Express application
│   ├── routes.ts        # API routes
│   ├── storage.ts       # Database operations
│   ├── replitAuth.ts    # Replit Auth integration
│   ├── seedCharacters.ts # Database seeding script
│   └── db.ts            # Database connection
├── shared/
│   └── schema.ts        # Shared TypeScript types and Drizzle schema
└── package.json
```

## API Endpoints

### Authentication
- `GET /api/login` - Initiate login flow
- `GET /api/logout` - Logout user
- `GET /api/callback` - OAuth callback
- `GET /api/auth/user` - Get current user (protected)

### User Settings
- `GET /api/settings` - Get user settings (protected)
- `PATCH /api/settings` - Update user settings (protected)

### Characters
- `GET /api/characters/:index` - Get single character (protected)
- `GET /api/characters/range/:start/:count` - Get character range (protected, max count: 300)

### Progress
- `GET /api/progress/:characterIndex` - Get progress for character (protected)
- `GET /api/progress/range/:start/:count` - Get progress range (protected, max count: 300)
- `POST /api/progress` - Update character progress with optimistic updates (protected)

## Character Data
The app includes a comprehensive dataset of 3000 common Chinese characters:
- **All 3000 characters sourced from HSK 3.0** (Chinese Proficiency Test) frequency list
- Data from the alyssabedard/chinese-hsk-and-frequency-lists repository
- Each character includes:
  - Simplified and traditional forms (traditionalVariants array for dual-form characters)
  - Pinyin pronunciation with tone marks
  - Radical and radical pinyin
  - HSK level classification (1-6)
  - Multiple English definitions from CC-CEDICT
  - Example sentences (basic templates, expandable in future)

## Known Limitations
### Example Sentences Traditional Display
Currently, example sentences are stored only in simplified Chinese in the database. When the traditional toggle is enabled, character displays correctly show traditional forms, but example sentences remain in simplified Chinese. To properly support traditional example sentences would require:
- Adding `examplesTraditional` field to the database schema
- Re-seeding all 3000 characters with traditional sentence variants
- Updating the client rendering logic to select the appropriate field

This is documented as a future enhancement and does not impact the core learning functionality.

## Recent Changes
### November 13, 2025 (Latest Session - Afternoon)
- **Implemented server-side filtering** - New `/api/characters/filtered` endpoint accepts HSK levels and progress filters as query parameters
- **Added batched progress endpoint** - `/api/progress/batch` efficiently fetches progress for up to 300 characters in a single request
- **Replaced sliders with text inputs** - All settings now use Input components with onBlur for instant responsiveness
- **Added chevron arrows to settings dropdown** - Visual indicator shows expand/collapse state
- **Fixed traditional toggle** - Character detail view and test mode now properly toggle through settings mutation
- **Enhanced test mode** - Added back button to start page and skip button during active testing
- **Fixed validation** - Test mode start index now validates 0-2999 to match 3000 character database
- All changes verified with comprehensive code review and testing

### November 13, 2025 (Morning)
- **Expanded database to 3000 characters** - Updated all routes and validations from 2500 to 3000
- **Created Standard Mode** with smart pagination (10-100 characters per page, configurable)
  - Fetches 3x page size to maintain full pages after filtering
  - HSK level and progress filters work seamlessly
  - Previous/Next navigation with proper boundary checks
  - Optimistic updates for instant UI feedback
- **Added progress toggles to character detail view** - BookOpen, PenTool, Grid3x3 icons
- **Fixed test mode radical testing** - Now accepts both tone marks and numbered pinyin
- **Created vocabulary database schema** for future multi-character word support
- **Implemented traditionalVariants array** - Fixed dual character display issues (e.g., 準准)
- **Increased API limits** - Range endpoints now accept up to 300 characters for efficient pagination
- All changes verified with comprehensive E2E testing

### November 13, 2025 (Earlier)
- **Replaced all placeholder character data with real HSK 3.0 dataset**
- Downloaded and processed 3000 most common Chinese characters
- Added proper radical information for 100+ common characters
- Implemented icon system: BookOpen (reading), PenTool (writing), Grid3x3 (radical)
- Changed progress icons from stars to grey/green color states
- Added optimistic updates for instant UI feedback when toggling progress
- Implemented character filtering to show only unmastered characters
- Updated test mode to accept numbered pinyin (e.g., "xue2") in addition to tone marks
- Set traditional Chinese as default for new users

### November 11, 2025
- Initial implementation of full application
- Integrated Replit Auth for authentication
- Created PostgreSQL database schema
- Seeded 2500 Chinese characters
- Built all frontend pages and components
- Connected frontend to backend APIs
- Implemented progress tracking system
- Added script toggle (simplified/traditional)

## User Flow
1. User lands on landing page
2. Clicks "Get Started" → redirects to Replit Auth
3. Logs in with Google or email/password
4. Arrives at home page with three modes:
   - **Daily Mode**: Shows characters based on current level (default)
   - **Standard Mode**: Browse all 3000 characters with pagination
   - **Test Mode**: Practice pronunciation, writing, or radicals
5. Can adjust settings:
   - Current level (0-3000)
   - Daily character count
   - Standard mode page size (10-100)
   - Script preference (simplified/traditional)
6. Click character to see detailed view:
   - Large Kaiti font display
   - Stroke order animation
   - Pinyin, radical, definitions, examples
   - Progress toggles (reading, writing, radical)
7. Apply filters to show only:
   - Specific HSK levels (1-6)
   - Unmastered reading/writing/radical
8. Use test mode to practice:
   - Pronunciation (accepts tone marks or numbered pinyin)
   - Writing recognition
   - Radical recognition

## Development Commands
- `npm run dev` - Start development server (frontend + backend)
- `npm run db:push` - Push database schema changes
- `cd server && tsx newSeedCharacters.ts` - Reseed database with HSK 3.0 character data

## Data Sources
- **Character Data**: HSK 3.0 character list from alyssabedard/chinese-hsk-and-frequency-lists
- **Supplementary Data**: Make Me a Hanzi for radical information
- **Definitions**: CC-CEDICT (Creative Commons licensed Chinese-English dictionary)

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Session encryption secret
- `REPL_ID` - Replit application ID
- `ISSUER_URL` - OIDC issuer URL (defaults to Replit)

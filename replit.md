# Chinese Character Learning Application

## Overview
A full-stack web application for learning the 2500 most common Chinese characters with progress tracking, detailed character information, and interactive testing modes.

## Features
- **Authentication**: Replit Auth with Google login, email/password, and other OAuth providers
- **Character Database**: 2500 most common Chinese characters with simplified/traditional variants
- **Progress Tracking**: Three-star system tracking reading, writing, and radical knowledge for each character
- **User Settings**: Customizable daily character count and current level (0-2500)
- **Character Details**: Large Kaiti font display, stroke order animations, pinyin, radicals, definitions, and example sentences
- **Script Toggle**: Switch between simplified and traditional Chinese characters throughout the app
- **Test Mode**: Three testing types (pronunciation, writing, radical recognition)

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
- `currentLevel`: Character index (0-2500)
- `dailyCharCount`: Number of characters to study per day
- `preferTraditional`: Boolean for script preference

### Character Progress Table
- Tracks three-star ratings per character per user
- `reading`: User knows how to read/pronounce
- `writing`: User knows how to write
- `radical`: User knows the radical

### Chinese Characters Table
- 2500 characters with complete metadata
- Simplified and traditional variants
- Pinyin, radical information
- English definitions (array)
- Example sentences with translations (JSONB)

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
- `GET /api/characters/range/:start/:count` - Get character range (protected)

### Progress
- `GET /api/progress/:characterIndex` - Get progress for character (protected)
- `GET /api/progress/range/:start/:count` - Get progress range (protected)
- `POST /api/progress` - Update character progress (protected)

## Character Data
The app includes a comprehensive dataset of 2500 common Chinese characters:
- First 20 characters are fully detailed with real data
- Remaining characters use placeholder data (would be replaced with full dataset in production)
- Each character includes:
  - Simplified and traditional forms
  - Pinyin pronunciation
  - Radical and radical pinyin
  - Multiple English definitions
  - 3-5 example sentences with translations

## Recent Changes
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
4. Arrives at home page showing current 5 characters
5. Can adjust level and daily character count in settings
6. Click character to see detailed view with stroke order
7. Toggle stars to track progress (reading, writing, radical)
8. Switch between simplified/traditional characters
9. Use test mode to practice different aspects

## Development Commands
- `npm run dev` - Start development server (frontend + backend)
- `npm run db:push` - Push database schema changes
- `cd server && tsx seedCharacters.ts` - Seed character database

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Session encryption secret
- `REPL_ID` - Replit application ID
- `ISSUER_URL` - OIDC issuer URL (defaults to Replit)

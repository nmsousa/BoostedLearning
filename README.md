# Boosted Learning

A local-first language learning app for Dutch A1, built with Angular, Ionic, and Capacitor.

## Features

- **Spaced Repetition**: FSRS-based scheduling for optimal memory retention
- **Multiple Exercise Types**: Flashcards, matching, typed translation, fill-in-the-blank, listening, and more
- **Progress Analytics**: Track your learning with detailed statistics
- **Gamification**: Daily goals, streaks, achievements, and XP system
- **Offline Support**: All data stored locally — works without internet
- **Text-to-Speech**: Listen to Dutch pronunciation using device voices

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- npm (comes with Node.js)
- [Android Studio](https://developer.android.com/studio) (for Android builds)

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd boosted-learning

# Install dependencies
npm install
```

## Development

### Run in Web Browser

```bash
# Start the development server
npm start
# or
ionic serve
```

The app will open at `http://localhost:4200`. Changes will hot-reload automatically.

### Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run only core domain tests
npm run test:core
```

## Building for Android

### First-Time Setup

```bash
# Build the web assets
ionic build

# Add the Android platform
ionic cap add android

# Sync web assets to native project
ionic cap sync

# Open in Android Studio
ionic cap open android
```

### Subsequent Builds

```bash
# Build and sync
ionic build
ionic cap sync

# Open Android Studio to build APK
ionic cap open android
```

### Building the APK in Android Studio

1. Open Android Studio (via `ionic cap open android`)
2. Wait for Gradle sync to complete
3. Go to **Build > Build Bundle(s) / APK(s) > Build APK(s)**
4. The APK will be in `android/app/build/outputs/apk/debug/`

### Running on a Connected Device

1. Enable USB debugging on your Android device
2. Connect via USB
3. In Android Studio, select your device and click **Run**

## Project Structure

```
src/
├── app/                 # Angular components and pages
│   ├── home/           # Home page with dashboard
│   ├── session/        # Exercise session host
│   ├── progress/       # Progress analytics
│   ├── course/         # Course/lesson navigation
│   ├── settings/       # User preferences
│   └── services/       # Angular services
├── core/               # Pure domain logic (no framework deps)
│   ├── scheduler/      # FSRS spaced repetition
│   ├── memory-engine/  # Learning state management
│   └── answer-validator/ # Answer validation pipeline
├── content/            # Learning content and store
├── exercises/          # Exercise type modules
├── persistence/        # Dexie/IndexedDB layer
└── services/           # Platform services (TTS, i18n, analytics)
```

## Technology Stack

- **Frontend**: Angular 22 + Ionic 9
- **Mobile**: Capacitor 8
- **Database**: Dexie.js (IndexedDB wrapper)
- **Scheduling**: ts-fsrs (FSRS algorithm)
- **Testing**: Vitest + fast-check (property-based testing)

## License

See [docs/DEPENDENCIES.md](./docs/DEPENDENCIES.md) for third-party license information.

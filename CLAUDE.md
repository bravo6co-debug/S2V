# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Start development server:** `npm run dev` (runs on http://localhost:3000)
- **Build for production:** `npm run build`
- **Preview production build:** `npm run preview`

## Environment Setup

This app requires a Gemini API key to function:
1. Create a `.env.local` file in the root directory
2. Add `GEMINI_API_KEY=your_api_key_here`

## Architecture Overview

This is a React + TypeScript application built with Vite that generates character images using Google's Gemini AI. The app is specifically designed for creating Korean character illustrations with consistent styling.

### Core Components Structure

- **App.tsx** - Main application container with all state management and business logic
- **services/geminiService.ts** - All AI image generation and character data extraction logic
- **components/** - UI components including ResultDisplay, ChapterDisplay, ImageEditor, etc.
- **types.ts** - TypeScript interfaces for characters, images, chapters, and drag operations

### Key Features & Data Flow

1. **Character Management**: Users upload reference images to a character library, which stores Character objects with image data and metadata (name, age, personality, outfit)

2. **Image Generation Pipeline**:
   - Users activate characters from library to reference slots
   - Provide scene descriptions and cinematic style filters
   - Generate images using Gemini API with character consistency
   - Results are stored as GeneratedItem objects

3. **Chapter Organization**: Generated images can be organized into chapters via drag-and-drop functionality

4. **Image Editing**: Users can modify existing images with text prompts using Gemini's image editing capabilities

### State Management

All state is managed in App.tsx using React hooks:
- `characterLibrary` - 5-slot array for stored characters
- `activeCharacters` - 5-slot array for currently referenced characters
- `generatedItems` - array of all generated images
- `chapters` - array of user-created chapter collections

### API Integration

The app uses Google's Gemini AI models:
- `gemini-2.5-flash` for character data extraction from Korean descriptions
- `imagen-4.0-generate-001` for character portrait generation
- `gemini-2.5-flash-image-preview` for scene generation and image editing

### Styling & UI

- Uses Tailwind CSS for styling with a dark gray theme
- Responsive grid layout (3-3-4 columns on large screens)
- Drag-and-drop functionality for organizing content between sections
- Modal components for character creation, editing, and image viewing

### File Structure Notes

- Environment variables are loaded via Vite config (`vite.config.ts`)
- TypeScript configuration supports path aliases (`@/*` maps to project root)
- No test framework is currently configured
- All components are functional React components using hooks
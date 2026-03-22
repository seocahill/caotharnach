# Deployment Guide

Complete deployment instructions for Caotharnach (backend + mobile app).

## Table of Contents
- [Prerequisites](#prerequisites)
- [Local Development](#local-development)
- [Production Deployment](#production-deployment)
- [Environment Variables](#environment-variables)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Backend
- Ruby 3.1.4+
- Bundler
- Fly.io CLI (for production)

### Mobile App
- Node.js 18+
- npm
- Expo CLI
- EAS CLI (for production builds)
- iOS Simulator / Android Emulator or physical device

### API Keys Required
- OpenAI API key (for GPT-4o and Whisper)
- Abairt API key (for Irish TTS/ASR)

---

## Local Development

### Manual Setup

#### 1. Backend Setup

```bash
# Install dependencies
bundle install

# Create .env file with your secrets
cat > .env << EOF
OPENAI_KEY=your-openai-key
OPENAI_ORG=your-openai-org
APP_API_KEY=<backend-api-key>
ABAIRT_API_KEY=your-abairt-key
EOF

# Start the backend server
bundle exec rackup --host 0.0.0.0 --port 8080
```

Backend runs on `http://localhost:8080`

### 2. Mobile App Setup

```bash
cd mobile

# Install dependencies
npm install

# Create .env file with your secrets
cat > .env << EOF
# Find your local IP: ifconfig | grep "inet " | grep -v 127.0.0.1
API_BASE_DEV=http://192.168.1.X:8080
API_BASE_PROD=https://an-caotharnach.fly.dev
APP_API_KEY=<backend-api-key>
ABAIRT_API_BASE=https://abairt.com
ABAIRT_API_KEY=your-abairt-key
EOF

# Start Expo dev server
npx expo start
```

**Important:**
- Use your machine's **local IP**, not `localhost` (so mobile devices can reach the backend)
- Find your IP: `ifconfig | grep "inet " | grep -v 127.0.0.1` (Mac/Linux)
- Press `i` for iOS simulator, `a` for Android emulator, or scan QR code with Expo Go

### 3. Testing Locally

1. Start backend: `bundle exec rackup --host 0.0.0.0 --port 8080`
2. Start mobile: `cd mobile && npx expo start`
3. Open app on device/simulator
4. Test features:
   - Create an island (voice or text input)
   - Speech improver (requires physical device - emulator mic produces noise)
   - Conversation mode

---

## Production Deployment

### Backend (Fly.io)

```bash
# Install Fly CLI if needed
curl -L https://fly.io/install.sh | sh

# Login to Fly.io
fly auth login

# Set secrets (never commit these!)
fly secrets set \
  OPENAI_KEY=your-openai-key \
  OPENAI_ORG=your-openai-org \
  APP_API_KEY=<backend-api-key> \
  ABAIRT_API_KEY=your-abairt-key

# Deploy
fly deploy
```

The backend will be live at: `https://an-caotharnach.fly.dev`

**Check logs:**
```bash
fly logs
```

**SSH into instance:**
```bash
fly ssh console
```

### Mobile App (EAS Build)

```bash
cd mobile

# Install EAS CLI if needed
npm install -g eas-cli

# Login to Expo
eas login

# Set up EAS secrets (REQUIRED - these aren't in the repo)
eas secret:create --scope project --name APP_API_KEY --value "<backend-api-key>" --type string
eas secret:create --scope project --name ABAIRT_API_KEY --value "your-abairt-key" --type string

# Verify secrets are set
eas secret:list

# Build for iOS (development)
eas build --profile development --platform ios

# Build for Android (development)
eas build --profile development --platform android

# Build for production
eas build --profile production --platform all

# Submit to App Store / Play Store
eas submit --platform ios
eas submit --platform android
```

**Important:** EAS secrets are stored on Expo's servers, not in your repo. `app.config.js` reads from `process.env` which gets populated from EAS secrets during builds.

---

## Environment Variables

### Backend (.env)

| Variable | Description | Example |
|----------|-------------|---------|
| `OPENAI_KEY` | OpenAI API key | `sk-proj-...` |
| `OPENAI_ORG` | OpenAI organization ID | `org-...` |
| `APP_API_KEY` | API key for mobile ↔ backend auth | `fa3450a960f93572...` |
| `ABAIRT_API_KEY` | Abairt API key for Irish TTS/ASR | `MJWYVqYwmzZSMsQPxDSrQ7ZC` |

### Mobile (mobile/.env)

| Variable | Description | Example |
|----------|-------------|---------|
| `API_BASE_DEV` | Backend URL for local dev | `http://192.168.1.5:8080` |
| `API_BASE_PROD` | Backend URL for production | `https://an-caotharnach.fly.dev` |
| `APP_API_KEY` | Must match backend `APP_API_KEY` | `fa3450a960f93572...` |
| `ABAIRT_API_BASE` | Abairt API base URL | `https://abairt.com` |
| `ABAIRT_API_KEY` | Abairt API key | `MJWYVqYwmzZSMsQPxDSrQ7ZC` |

**How it works:**
- **Local dev:** Variables loaded from `mobile/.env` (gitignored)
- **EAS builds:**
  - Non-sensitive config (URLs) from `mobile/eas.json`
  - Secrets (API keys) from EAS secrets (set via `eas secret:create`)
- **Runtime:** All vars accessed via `expo-constants` in `mobile/src/config.ts`

**Security:**
- `mobile/.env` - gitignored ✓
- `mobile/eas.json` - committed, contains NO secrets ✓
- EAS secrets - stored on Expo servers, never committed ✓

---

## Troubleshooting

### Backend Issues

**Port already in use:**
```bash
lsof -ti:8080 | xargs kill -9
```

**Dependencies outdated:**
```bash
bundle update
```

**Fly.io deployment fails:**
```bash
fly deploy --verbose
fly logs --app an-caotharnach
```

### Mobile App Issues

**"Network request failed":**
- Check backend is running
- Verify `API_BASE_DEV` uses your **local IP**, not `localhost`
- Ensure device/simulator is on same WiFi network
- Check firewall isn't blocking port 8080

**Environment variables not loading:**
```bash
# Delete app.json if it exists (app.config.js replaces it)
rm mobile/app.json

# Clear Expo cache
cd mobile
npx expo start -c
```

**Android emulator microphone produces white noise:**
- This is expected - Android emulator mic doesn't work properly
- Use a physical device for testing speech features

**iOS build fails:**
```bash
# Clear build cache
eas build:cancel
eas build --clear-cache --platform ios
```

**Secrets not working in EAS build:**
- Verify secrets are set: `eas secret:list`
- Check `mobile/eas.json` references correct env var names
- Rebuild after updating secrets

---

## Quick Reference

### Local Dev Workflow

**Option 1: Use Procfile (recommended)**
```bash
foreman start
# or: overmind start
```

**Option 2: Manual (separate terminals)**
```bash
# Terminal 1: Backend
bundle exec rackup --host 0.0.0.0 --port 8080

# Terminal 2: Mobile
cd mobile && npx expo start
```

### Production Deploy
```bash
# Backend
fly deploy

# Mobile (build + submit)
cd mobile
eas build --profile production --platform all
eas submit --platform all
```

### Check Production Status
```bash
# Backend
fly status
fly logs

# Mobile
eas build:list
```

---

## Security Notes

- **Never commit `.env` files** - they're in `.gitignore`
- **Rotate API keys** if accidentally exposed
- **Use EAS secrets** for production mobile builds
- **Use Fly.io secrets** for backend production
- **Keep `eas.json`** out of public repos if it contains hardcoded secrets (use EAS secrets instead)

---

## Support

- Backend issues: Check [app.rb](app.rb) logs
- Mobile issues: Check Expo dev console
- API issues: Verify keys at [OpenAI](https://platform.openai.com) and [Abairt](https://abairt.com)

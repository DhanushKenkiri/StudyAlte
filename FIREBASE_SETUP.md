# 🔥 Firebase Setup Guide for Question Paper Generator

## Current Status
✅ Firebase configuration is already in your .env file  
✅ Project ID: `studyalte`  
⚠️ Need to verify Firebase services are enabled

## Quick Setup Steps

### 1. Go to Firebase Console
Visit: https://console.firebase.google.com/project/studyalte

### 2. Enable Authentication
1. Click "Authentication" in the left sidebar
2. Click "Get started" if not already set up
3. Go to "Sign-in method" tab
4. Enable "Google" provider:
   - Click on Google
   - Toggle "Enable"
   - Add your domain (localhost:3000 for development)
   - Save

### 3. Enable Realtime Database
1. Click "Realtime Database" in the left sidebar
2. Click "Create Database"
3. Choose "Start in test mode" (for development)
4. Select a location (preferably close to your users)
5. Your database URL should be: `https://studyalte-default-rtdb.firebaseio.com`

### 4. Set Basic Security Rules (for development)
```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    }
  }
}
```

## If You Still Get Errors

### Option 1: Check Console Errors
1. Open browser Developer Tools (F12)
2. Check the Console tab for detailed error messages

### Option 2: Test Connection
Try accessing: https://console.firebase.google.com/project/studyalte/authentication/users

### Option 3: Create New Project (if needed)
If the 'studyalte' project doesn't exist or you don't have access:
1. Go to https://console.firebase.google.com/
2. Click "Add project"
3. Enter a new project name
4. Update the .env file with new project details

## After Setup
1. Restart the development server: `npm start`
2. The app should show a proper login page
3. Click "Sign in with Google" to test authentication

## Need Help?
- Check the browser console for specific error messages
- Verify you have access to the Firebase project
- Make sure all Firebase services are enabled
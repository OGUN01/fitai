# EAS Credentials Setup Guide

Since the current environment doesn't support interactive input, you'll need to run these commands in a regular terminal (Command Prompt, PowerShell, or Git Bash on Windows).

## Steps to Create Credentials:

1. **Open a regular terminal** (not VS Code integrated terminal)

2. **Navigate to your project directory**:
   ```bash
   cd C:\fitai
   ```

3. **Run the credentials command**:
   ```bash
   eas credentials
   ```

4. **Follow the prompts**:
   - Select platform: `Android`
   - Select build profile: `preview`
   - When asked about Android Keystore: Choose `Generate a new Android Keystore`
   - EAS will generate and store the keystore on their servers

5. **After credentials are created, run the build**:
   ```bash
   eas build --platform android --profile preview
   ```

## Alternative: Use Expo Website

If you prefer a GUI approach:

1. Go to https://expo.dev/accounts/harsh9887/projects/fitness
2. Click on "Builds" in the sidebar
3. Click "Create build"
4. Select:
   - Platform: Android
   - Build profile: preview
5. The website will handle credential generation automatically

## Verify Credentials

Once created, you can verify credentials exist by running:
```bash
eas credentials --platform android
```

This will show you the keystore information stored on EAS servers.

## Important Notes:

- EAS stores credentials securely on their servers
- You don't need to manage the keystore file locally
- The same keystore will be used for all future builds
- For production builds, you may want to download and backup the keystore

After completing these steps, your build should work successfully!
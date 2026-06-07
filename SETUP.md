# Script Liner — iOS App Setup

## One-time Xcode setup (≈15 minutes)

### 1. Create the Xcode project

1. Open Xcode → **File → New → Project**
2. Choose **iOS → App**
3. Settings:
   - Product Name: `ScriptLiner`
   - Interface: **SwiftUI**
   - Language: **Swift**
   - Uncheck "Include Tests"
4. Save it inside this `scriptliner-ios/` folder

### 2. Add the Swift source files

Delete the placeholder `ContentView.swift` Xcode creates, then drag these files into the project navigator (check "Copy items if needed"):
- `ScriptLiner/Config.swift`
- `ScriptLiner/ContentView.swift`
- `ScriptLiner/ScriptWebView.swift`
- `ScriptLiner/UpdateManager.swift`
- `ScriptLiner/ScriptLinerApp.swift`

### 3. Bundle the web files

1. In Finder, go to `/Users/peterwright/Code/web/scriptliner/`
2. Drag the whole `scriptliner` folder into Xcode's project navigator
3. In the dialog: check **"Copy items if needed"** and **"Create folder references"** (blue folder icon)
4. Make sure it's added to the **ScriptLiner target**

### 4. Point at your server

Open `Config.swift` and replace the URL:

```swift
static let updateBaseURL = "https://yoursite.com/scriptliner/"
```

### 5. Enable iCloud capability

1. Click the top-level project → **Signing & Capabilities**
2. Click **+ Capability** → add **iCloud**
3. Under iCloud, tick **iCloud Documents**
4. This adds the `com.apple.developer.ubiquity-kvstore-identifier` and document entitlements required for `FileManager.url(forUbiquityContainerIdentifier:)` to return a non-nil URL
5. If prompted, select your Team so Xcode can provision the entitlement

> Without this step the app still works — it silently falls back to saving `_session.json` in local Documents instead of iCloud Drive.

### 6. Set your Apple Developer team

1. Click the top-level project in the navigator → **Signing & Capabilities**
2. Set your Team (requires a free or paid Apple Developer account)
3. Change the Bundle Identifier to something unique, e.g. `com.yourname.scriptliner`

### 6. Build and run

Select a simulator or your connected iPhone/iPad → ▶ Run.

---

## Enabling Mac support (optional, 2 minutes)

1. Project → Signing & Capabilities → **+ Capability → Mac Catalyst**
2. Build and run selecting "My Mac (Catalyst)" as the destination

---

## Update workflow (after initial setup)

Every time you change `index.html` or `app.js`:

### For immediate App Store users (no review needed):
1. Increment the version number in `web/scriptliner/version.json`:
   ```json
   { "version": 2 }
   ```
2. Upload `index.html`, `app.js`, and `version.json` to your server
3. Done — the app downloads the new files silently on next launch

### To update the bundled fallback (for new installs):
1. Do the above steps
2. In Xcode, delete the old `scriptliner` folder reference and re-add it
3. Build a new version and submit to App Store

---

## How the update system works

- On launch, the app checks `https://yoursite.com/scriptliner/version.json`
- If the remote `version` integer is higher than what's stored locally, it downloads `index.html` and `app.js`
- Downloaded files are stored in the app's Documents folder
- The **next** launch uses the new files (no disruptive mid-session reloads)
- If the server is unreachable, the app silently uses the bundled or previously downloaded version

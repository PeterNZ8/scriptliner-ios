// Config.swift — edit this file to point at your hosted server

enum Config {
    // Base URL where you host the scriptliner folder.
    // Must end with a slash. Files expected: index.html, app.js, version.json
    static let updateBaseURL = "https://yoursite.com/scriptliner/"

    // Files to download on update (sw.js not needed in native)
    static let updateFiles = ["index.html", "app.js"]

    // Subfolder name used inside the app's Documents directory
    static let localFolder = "scriptliner"
}

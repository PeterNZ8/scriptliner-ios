import SwiftUI
import WebKit

struct ScriptWebView: UIViewRepresentable {

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        // Allow IndexedDB (used for auto-save)
        config.websiteDataStore = WKWebsiteDataStore.default()

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.scrollView.bounces = false
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 0.10, green: 0.10, blue: 0.18, alpha: 1)

        loadContent(in: webView)

        // Check for updates silently in the background
        Task {
            let updated = await UpdateManager.shared.checkAndDownload()
            // If new files were downloaded, reload on next launch (not mid-session)
            if updated {
                print("[ScriptLiner] Update downloaded — will apply on next launch")
            }
        }

        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    // MARK: - Load

    private func loadContent(in webView: WKWebView) {
        let fm = FileManager.default
        let localDir = localDirectory()
        let localIndex = localDir.appendingPathComponent("index.html")

        if fm.fileExists(atPath: localIndex.path) {
            // Use downloaded (possibly newer) version
            webView.loadFileURL(localIndex, allowingReadAccessTo: localDir)
        } else {
            // Fall back to the copy bundled inside the app
            guard let bundleIndex = Bundle.main.url(
                forResource: "index", withExtension: "html",
                subdirectory: Config.localFolder
            ) else {
                fatalError("index.html not found in app bundle — add the web folder to Xcode target")
            }
            webView.loadFileURL(bundleIndex, allowingReadAccessTo: bundleIndex.deletingLastPathComponent())
        }
    }

    private func localDirectory() -> URL {
        FileManager.default
            .urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent(Config.localFolder)
    }
}

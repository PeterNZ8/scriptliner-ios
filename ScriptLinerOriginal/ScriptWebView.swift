import SwiftUI
import WebKit

struct ScriptWebView: UIViewRepresentable {

    func makeCoordinator() -> iCloudStorage {
        iCloudStorage.shared
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = WKWebsiteDataStore.default()

        // Register "save" message handler — JS calls:
        //   window.webkit.messageHandlers.save.postMessage(jsonString)
        config.userContentController.add(context.coordinator, name: "save")

        // Inject saved session before any page script runs so JS can
        // read window.__nativeSession on DOMContentLoaded
        if let script = iCloudStorage.shared.makeInjectionScript() {
            config.userContentController.addUserScript(script)
        }

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 0.10, green: 0.10, blue: 0.18, alpha: 1)

        loadContent(in: webView)

        // Check for app updates silently
        Task {
            let updated = await UpdateManager.shared.checkAndDownload()
            if updated { print("[ScriptLiner] Update downloaded — applies on next launch") }
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
            webView.loadFileURL(localIndex, allowingReadAccessTo: localDir)
        } else {
            guard let bundleIndex = Bundle.main.url(
                forResource: "index", withExtension: "html",
                subdirectory: Config.localFolder
            ) else {
                fatalError("index.html not found in app bundle — add the scriptliner web folder to the Xcode target")
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

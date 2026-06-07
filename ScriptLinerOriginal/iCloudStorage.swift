import Foundation
import WebKit

// iCloudStorage bridges JavaScript autoSave() calls to iCloud Drive.
//
// Save flow:  JS → messageHandlers.save → Swift → iCloud Drive/_session.json
// Load flow:  Swift reads iCloud Drive/_session.json → injects window.__nativeSession
//             → JS reads it on DOMContentLoaded instead of IndexedDB

class iCloudStorage: NSObject, WKScriptMessageHandler {

    static let shared = iCloudStorage()

    // MARK: - JS → Swift message handler

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard message.name == "save",
              let jsonString = message.body as? String else { return }

        Task.detached(priority: .utility) {
            await self.writeSession(jsonString)
        }
    }

    // MARK: - Write

    func writeSession(_ jsonString: String) async {
        guard let data = jsonString.data(using: .utf8) else { return }

        if let url = sessionFileURL(inICloud: true) {
            do {
                try ensureDirectory(for: url)
                try data.write(to: url, options: .atomic)
                return
            } catch {
                print("[ScriptLiner] iCloud write failed (\(error.localizedDescription)) — falling back to local")
            }
        }

        // Local Documents fallback (iCloud not available or not signed in)
        if let url = sessionFileURL(inICloud: false) {
            try? ensureDirectory(for: url)
            try? data.write(to: url, options: .atomic)
        }
    }

    // MARK: - Read

    // Returns the saved session JSON string, or nil if nothing saved yet.
    // Tries iCloud first, then local Documents.
    func readSession() -> String? {
        for inICloud in [true, false] {
            guard let url = sessionFileURL(inICloud: inICloud) else { continue }
            if let data = try? Data(contentsOf: url),
               let json = String(data: data, encoding: .utf8) {
                return json
            }
        }
        return nil
    }

    // MARK: - WKUserScript to inject session before page JS runs

    func makeInjectionScript() -> WKUserScript? {
        guard let json = readSession() else { return nil }

        // Inject as a JS object — JSON is valid JS object literal syntax
        let source = "window.__nativeSession = \(json);"
        return WKUserScript(
            source: source,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
    }

    // MARK: - URLs

    private func sessionFileURL(inICloud: Bool) -> URL? {
        if inICloud {
            return FileManager.default
                .url(forUbiquityContainerIdentifier: nil)?
                .appendingPathComponent("Documents/Script Liner/_session.json")
        } else {
            return FileManager.default
                .urls(for: .documentDirectory, in: .userDomainMask).first?
                .appendingPathComponent("Script Liner/_session.json")
        }
    }

    private func ensureDirectory(for url: URL) throws {
        let dir = url.deletingLastPathComponent()
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    }
}

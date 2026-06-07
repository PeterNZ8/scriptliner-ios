import Foundation

// UpdateManager checks your hosted server for a newer version.json,
// downloads updated files if found, and stores them in the app's
// Documents folder. The next app launch will use the new files.

actor UpdateManager {
    static let shared = UpdateManager()

    private struct VersionInfo: Codable {
        let version: Int   // simple integer, increment whenever you push changes
    }

    // Returns true if new files were downloaded
    func checkAndDownload() async -> Bool {
        guard
            let baseURL = URL(string: Config.updateBaseURL),
            let versionURL = URL(string: "version.json", relativeTo: baseURL)
        else { return false }

        do {
            let (data, _) = try await URLSession.shared.data(from: versionURL)
            let remote = try JSONDecoder().decode(VersionInfo.self, from: data)

            let local = localVersion()
            guard remote.version > local else { return false }

            print("[ScriptLiner] New version \(remote.version) available (local: \(local)), downloading…")
            try await downloadFiles(from: baseURL)
            saveLocalVersion(remote.version)
            return true

        } catch {
            print("[ScriptLiner] Update check failed: \(error.localizedDescription)")
            return false
        }
    }

    // MARK: - Private

    private func downloadFiles(from baseURL: URL) async throws {
        let dir = localDirectory()
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)

        for filename in Config.updateFiles {
            guard let fileURL = URL(string: filename, relativeTo: baseURL) else { continue }
            let (data, response) = try await URLSession.shared.data(from: fileURL)

            guard (response as? HTTPURLResponse)?.statusCode == 200 else {
                throw URLError(.badServerResponse)
            }

            let dest = dir.appendingPathComponent(filename)
            try data.write(to: dest, options: .atomic)
            print("[ScriptLiner] Downloaded \(filename)")
        }
    }

    private func localDirectory() -> URL {
        FileManager.default
            .urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent(Config.localFolder)
    }

    private func localVersion() -> Int {
        let versionFile = localDirectory().appendingPathComponent("version.json")
        guard
            let data = try? Data(contentsOf: versionFile),
            let info = try? JSONDecoder().decode(VersionInfo.self, from: data)
        else { return 0 }
        return info.version
    }

    private func saveLocalVersion(_ version: Int) {
        let versionFile = localDirectory().appendingPathComponent("version.json")
        let info = VersionInfo(version: version)
        if let data = try? JSONEncoder().encode(info) {
            try? data.write(to: versionFile, options: .atomic)
        }
    }
}

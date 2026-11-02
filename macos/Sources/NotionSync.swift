import AppKit
import WebKit
import Security

// Tokens stay in Keychain and are used only by native HTTPS requests to api.notion.com.
final class NotionSync: NSObject, URLSessionTaskDelegate {
    private let service = "com.cookieboi.lint.notion"
    private let databaseKey = "LintNotionDatabase"
    private var sourceID: String?
    private var knownPages = Set<String>()
    private var busy = false
    private lazy var session = URLSession(configuration: .ephemeral, delegate: self, delegateQueue: nil)
    private func fail(_ message: String) -> NSError { NSError(domain: "LintNotion", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }
    private func token() -> String? {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: "integration", kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne]
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }
    private func saveToken(_ value: String) throws {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: "integration"]
        let data = Data(value.utf8)
        let status = SecItemUpdate(query as CFDictionary, [kSecValueData as String: data] as CFDictionary)
        if status == errSecItemNotFound {
            var add = query; add[kSecValueData as String] = data; add[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
            guard SecItemAdd(add as CFDictionary, nil) == errSecSuccess else { throw fail("Could not save the token in Keychain.") }; return
        }
        guard status == errSecSuccess else { throw fail("Could not update the token in Keychain.") }
    }
    private func identifier(_ input: String) -> String? {
        let value = input.trimmingCharacters(in: .whitespacesAndNewlines)
        if let uuid = UUID(uuidString: value) { return uuid.uuidString.lowercased() }
        // Only inspect the URL path: view IDs in query strings are not database IDs.
        let path = URL(string: value)?.path ?? value
        let regex = try! NSRegularExpression(pattern: "[0-9a-fA-F]{32}(?=/|$)|[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}(?=/|$)")
        guard let match = regex.matches(in: path, range: NSRange(path.startIndex..., in: path)).last,
              let range = Range(match.range, in: path) else { return nil }
        let hex = String(path[range]).replacingOccurrences(of: "-", with: "")
        let chars = Array(hex)
        return [String(chars[0..<8]),String(chars[8..<12]),String(chars[12..<16]),String(chars[16..<20]),String(chars[20..<32])].joined(separator: "-").lowercased()
    }
    func configure(window: NSWindow) {
        guard !busy else { return }
        let alert = NSAlert(); alert.messageText = "Connect Notion"
        alert.informativeText = "Use an internal Notion integration with Read, Update, and Insert content access. Share your flashcard database with it. Paste the database URL (or data source ID). The token is stored in macOS Keychain, never in your flashcard backups."
        alert.addButton(withTitle: "Save Connection"); alert.addButton(withTitle: "Cancel")
        let box = NSView(frame: NSRect(x: 0, y: 0, width: 440, height: 112))
        let dbLabel = NSTextField(labelWithString: "Database URL or data source ID"); dbLabel.frame = NSRect(x: 0, y: 90, width: 440, height: 20)
        let db = NSTextField(frame: NSRect(x: 0, y: 62, width: 440, height: 24)); db.stringValue = UserDefaults.standard.string(forKey: databaseKey) ?? ""
        let tokenLabel = NSTextField(labelWithString: "Integration token (leave blank to keep the saved token)"); tokenLabel.frame = NSRect(x: 0, y: 31, width: 440, height: 20)
        let secret = NSSecureTextField(frame: NSRect(x: 0, y: 2, width: 440, height: 24))
        [dbLabel, db, tokenLabel, secret].forEach { box.addSubview($0) }; alert.accessoryView = box
        alert.beginSheetModal(for: window) { [weak self] response in
            guard let self = self, response == .alertFirstButtonReturn else { return }
            do {
                guard let id = self.identifier(db.stringValue) else { throw self.fail("Enter a valid Notion database URL or data source ID.") }
                let value = secret.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
                if !value.isEmpty { try self.saveToken(value) }
                guard self.token() != nil else { throw self.fail("Enter your Notion integration token.") }
                UserDefaults.standard.set(id, forKey: self.databaseKey); self.sourceID = nil
                self.show("Connection saved", "Choose Notion → Sync Now to sync all flashcards. Set up the database properties described in the Notion setup guide first.", window)
            } catch { self.show("Notion connection", error.localizedDescription, window) }
        }
    }
    func disconnect(window: NSWindow) {
        guard !busy else { return }
        let alert = NSAlert(); alert.messageText = "Disconnect Notion?"; alert.informativeText = "Removes the saved token and connection. Your cards and Notion database remain unchanged."
        alert.addButton(withTitle: "Disconnect"); alert.addButton(withTitle: "Cancel")
        alert.beginSheetModal(for: window) { [weak self] result in
            guard let self = self, result == .alertFirstButtonReturn else { return }
            let status = SecItemDelete([kSecClass as String:kSecClassGenericPassword,kSecAttrService as String:self.service,kSecAttrAccount as String:"integration"] as CFDictionary)
            guard status == errSecSuccess || status == errSecItemNotFound else { self.show("Notion", "Could not remove the token from Keychain.", window); return }
            UserDefaults.standard.removeObject(forKey:self.databaseKey); self.sourceID = nil
        }
    }
    private func show(_ title: String, _ message: String, _ window: NSWindow) {
        let alert = NSAlert(); alert.messageText = title; alert.informativeText = message; alert.addButton(withTitle: "OK"); alert.beginSheetModal(for: window)
    }
    func sync(window: NSWindow, web: WKWebView) {
        guard !busy else { return }
        guard token() != nil, UserDefaults.standard.string(forKey: databaseKey) != nil else { configure(window: window); return }
        let confirm = NSAlert(); confirm.messageText = "Sync all flashcards with Notion?"
        confirm.informativeText = "Card questions, answers, explanations, languages, and deck names will be sent to your connected Notion database and imported into Lint. Review history stays on this Mac. Conflicts are left unchanged; deletions are not synced. Export a backup before your first sync."
        confirm.addButton(withTitle: "Sync Now"); confirm.addButton(withTitle: "Cancel")
        confirm.beginSheetModal(for: window) { [weak self] choice in
            guard let self = self, choice == .alertFirstButtonReturn else { return }
            self.busy = true; self.sourceID = nil; self.knownPages.removeAll()
            let progress = NSAlert(); progress.messageText = "Syncing with Notion…"; progress.informativeText = "Please keep Lint open. Large libraries may take several minutes."
            progress.addButton(withTitle: "Syncing…").isEnabled = false; progress.beginSheetModal(for: window)
            web.callAsyncJavaScript("return await window.lintNotion.sync();", arguments: [:], in: nil, in: .page) { result in
                window.endSheet(progress.window); self.busy = false
                let message: String
                var reload = true
                switch result {
                case .success(let value):
                    let outcome = value as? [String: Any]
                    message = outcome?["message"] as? String ?? "Sync finished."
                    reload = outcome?["reload"] as? Bool ?? true
                case .failure: message = "Sync was interrupted. Completed rows are saved. Reopen Lint and sync again."
                }
                // Reload the existing library only after the sync has finished.
                if reload { web.reload() }; self.show("Notion sync", message, window)
            }
        }
    }
    func handle(_ body: [String: Any], web: WKWebView) {
        guard busy, let id = body["id"] as? String, let op = body["op"] as? String else { return }
        let data = body["data"] as? [String: Any] ?? [:]
        Task { @MainActor in
            do {
                let value = try await operation(op, data)
                web.callAsyncJavaScript("window.lintNotion.reply(id, value, null)", arguments: ["id":id,"value":value], in: nil, in: .page, completionHandler: nil)
            } catch {
                web.callAsyncJavaScript("window.lintNotion.reply(id, null, error)", arguments: ["id":id,"error":error.localizedDescription], in: nil, in: .page, completionHandler: nil)
            }
        }
    }
    @MainActor private func operation(_ op: String, _ data: [String: Any]) async throws -> [String: Any] {
        if op == "source" {
            guard let id = UserDefaults.standard.string(forKey: databaseKey), identifier(id) == id else { throw fail("Configure a Notion database first.") }
            var source: [String: Any]
            do { source = try await api("GET", "data_sources/\(id)") }
            catch let error as NSError where error.code == 404 {
                let db = try await api("GET", "databases/\(id)")
                guard let sources = db["data_sources"] as? [[String: Any]], sources.count == 1, let sid = sources[0]["id"] as? String, identifier(sid) != nil else { throw fail("This database has multiple data sources. Enter the specific data source ID in Connect Notion.") }
                source = try await api("GET", "data_sources/\(sid)")
            }
            guard let sid = source["id"] as? String, identifier(sid) != nil else { throw fail("Notion returned an invalid data source.") }
            sourceID = sid; return source
        }
        guard let source = sourceID else { throw fail("Resolve the Notion data source before syncing.") }
        if op == "query" {
            var body: [String: Any] = ["page_size":100]
            if let cursor = data["cursor"] as? String { body["start_cursor"] = cursor }
            let result = try await api("POST", "data_sources/\(source)/query", body)
            for page in result["results"] as? [[String: Any]] ?? [] { if let id = page["id"] as? String { knownPages.insert(id) } }
            return result
        }
        if op == "create", let properties = data["properties"] as? [String: Any] {
            let page = try await api("POST", "pages", ["parent":["type":"data_source_id","data_source_id":source],"properties":properties])
            if let id = page["id"] as? String { knownPages.insert(id) }; return page
        }
        guard let id = data["id"] as? String, knownPages.contains(id), identifier(id) != nil else { throw fail("Only rows from the connected database can be synced.") }
        if op == "get" { return try await api("GET", "pages/\(id)") }
        if op == "update", let properties = data["properties"] as? [String: Any] { return try await api("PATCH", "pages/\(id)", ["properties":properties]) }
        throw fail("Unsupported Notion operation.")
    }
    private func api(_ method: String, _ path: String, _ body: [String: Any]? = nil) async throws -> [String: Any] {
        guard let secret = token(), let url = URL(string:"https://api.notion.com/v1/\(path)") else { throw fail("Notion token is missing. Reconnect Notion.") }
        var request = URLRequest(url:url); request.httpMethod = method; request.timeoutInterval = 45
        request.setValue("Bearer \(secret)", forHTTPHeaderField:"Authorization")
        request.setValue("2025-09-03", forHTTPHeaderField:"Notion-Version")
        request.setValue("application/json", forHTTPHeaderField:"Content-Type")
        if let body = body { request.httpBody = try JSONSerialization.data(withJSONObject:body) }
        for attempt in 0..<3 {
            try await Task.sleep(nanoseconds:350_000_000)
            let (data,response) = try await session.data(for:request)
            guard let http = response as? HTTPURLResponse else { throw fail("Notion returned no HTTP response.") }
            if http.statusCode == 429 && attempt < 2 {
                let delay = min(20,max(1,Double(http.value(forHTTPHeaderField:"Retry-After") ?? "2") ?? 2))
                try await Task.sleep(nanoseconds:UInt64(delay * 1_000_000_000)); continue
            }
            guard (200..<300).contains(http.statusCode) else {
                let message: String
                switch http.statusCode {
                case 401: message = "Notion rejected the token. Update your connection."
                case 403: message = "Notion denied access. Enable Read, Update, and Insert content and share the database with the integration."
                case 404: message = "Notion could not find this database or row. Check the ID and database connection permissions."
                case 400: message = "Notion rejected the card properties. Check the exact property names and types in the setup guide."
                case 429: message = "Notion is rate limiting requests. Wait a minute and sync again."
                default: message = "Notion request failed (HTTP \(http.statusCode)). Try syncing again later."
                }
                throw NSError(domain:"LintNotion",code:http.statusCode,userInfo:[NSLocalizedDescriptionKey:message])
            }
            guard let object = try JSONSerialization.jsonObject(with:data) as? [String: Any] else { throw fail("Notion returned invalid JSON.") }; return object
        }
        throw fail("Notion is busy. Try syncing again later.")
    }
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}

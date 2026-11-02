import AppKit
import WebKit
import Darwin

final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate, WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
    private var window: NSWindow!
    private var web: WKWebView!
    private var pad: TrackpadView!
    private var keyMonitor: Any?
    private var enabled = false
    private var siteURL: URL!

    func applicationDidFinishLaunching(_ notification: Notification) {
        makeMenu()
        guard let site = Bundle.main.resourceURL?.appendingPathComponent("site", isDirectory: true),
              FileManager.default.fileExists(atPath: site.appendingPathComponent("index.html").path) else {
            let alert = NSAlert(); alert.messageText = "Lint's website files are missing."; alert.informativeText = "Rebuild the app using macos/scripts/build.sh."; alert.runModal(); NSApp.terminate(nil); return
        }
        siteURL = site.standardizedFileURL
        let config = WKWebViewConfiguration()
        config.websiteDataStore = ProcessInfo.processInfo.arguments.contains("--smoke-test") ? .nonPersistent() : .default()
        config.userContentController.add(self, name: "lintNative")
        let bridge = """
        Object.defineProperty(window, 'lintNative', {value: Object.freeze({
          platform: 'macOS',
          setEnabled: enabled => window.webkit.messageHandlers.lintNative.postMessage({type: 'enable', enabled: !!enabled}),
          setArmed: armed => window.webkit.messageHandlers.lintNative.postMessage({type: 'arm', armed: !!armed})
        }), writable: false});
        """
        config.userContentController.addUserScript(WKUserScript(source: bridge, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = self; web.uiDelegate = self
        let content = NSView(frame: NSRect(x: 0, y: 0, width: 1280, height: 900))
        web.frame = content.bounds; web.autoresizingMask = [.width, .height]; content.addSubview(web)
        pad = TrackpadView(frame: content.bounds); pad.autoresizingMask = [.width, .height]; pad.webView = web
        pad.onFrame = { [weak self] data in self?.send(data) }; content.addSubview(pad)
        window = NSWindow(contentRect: content.bounds, styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.appearance = NSAppearance(named: .aqua)
        window.title = "Lint"; window.minSize = NSSize(width: 850, height: 650); window.contentView = content; window.delegate = self
        window.setFrameAutosaveName("LintMainWindow"); window.center(); window.makeKeyAndOrderFront(nil)
        keyMonitor = NSEvent.addLocalMonitorForEvents(matching: [.keyUp]) { [weak self] event in
            if event.keyCode == 49 { self?.pad.stop() }
            return event
        }
        web.loadFileURL(site.appendingPathComponent("index.html"), allowingReadAccessTo: site)
        NSApp.activate(ignoringOtherApps: true)
        if ProcessInfo.processInfo.arguments.contains("--smoke-test") {
            DispatchQueue.main.asyncAfter(deadline: .now() + 40) { print("FAIL: Native smoke test timed out"); exit(2) }
        }
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard ProcessInfo.processInfo.arguments.contains("--smoke-test") else { return }
        let script = """
        (() => {
          if (!window.lintNative || !document.querySelector('.deck-tile')) throw new Error('App did not start');
          if (document.querySelector('#lint-notes-nav') || document.querySelector('#notes-root')) throw new Error('Notes must not appear in the Mac app');
          document.querySelector('[data-deck]').click();
          document.querySelector('[data-add]').click();
          const kind = document.querySelector('#kind'); kind.value = 'coding'; kind.dispatchEvent(new Event('change'));
          if (!document.querySelector('.cm-editor')) throw new Error('Code editor did not start');
          return true;
        })()
        """
        webView.evaluateJavaScript(script) { result, error in
            if let error = error { print("FAIL: Native WKWebView smoke test: \(error.localizedDescription)"); exit(1) }
            guard result as? Bool == true else { print("FAIL: Unexpected smoke test result"); exit(1) }
            print("PASS: Native WKWebView loads Lint without Notes and opens the code editor.")
            exit(0)
        }
    }
    private func send(_ payload: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: payload), let json = String(data: data, encoding: .utf8) else { return }
        web.evaluateJavaScript("window.dispatchEvent(new CustomEvent('lint-native-trackpad', {detail: \(json)}))", completionHandler: nil)
    }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, message.webView === web,
              let url = message.frameInfo.request.url, url.isFileURL,
              url.standardizedFileURL.path.hasPrefix(siteURL.path + "/"),
              let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
        switch type {
        case "enable":
            enabled = body["enabled"] as? Bool ?? false
            pad.stop()
            send(["type": "enabled", "enabled": enabled])
        case "arm":
            if enabled && (body["armed"] as? Bool == true) && window.isKeyWindow { pad.armed = true }
            else { pad.stop() }
        default: break
        }
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        if navigationAction.shouldPerformDownload && (url.scheme == "blob" || url.isFileURL) {
            decisionHandler(.download); return
        }
        let allowed = url.isFileURL && url.standardizedFileURL.path.hasPrefix(siteURL.path + "/")
        if allowed { decisionHandler(.allow) }
        else { decisionHandler(.cancel) }
    }
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        pad.stop(); let alert = NSAlert(); alert.messageText = "Lint"; alert.informativeText = message; alert.addButton(withTitle: "OK")
        alert.beginSheetModal(for: window) { _ in completionHandler() }
    }
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        pad.stop(); let alert = NSAlert(); alert.messageText = "Lint"; alert.informativeText = message
        alert.addButton(withTitle: "Confirm"); alert.addButton(withTitle: "Cancel")
        alert.beginSheetModal(for: window) { response in completionHandler(response == .alertFirstButtonReturn) }
    }
    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        pad.stop(); let panel = NSOpenPanel(); panel.canChooseDirectories = false; panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.beginSheetModal(for: window) { response in completionHandler(response == .OK ? panel.urls : nil) }
    }
    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) { download.delegate = self }
    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        pad.stop(); let panel = NSSavePanel(); panel.nameFieldStringValue = suggestedFilename
        panel.beginSheetModal(for: window) { result in completionHandler(result == .OK ? panel.url : nil) }
    }
    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        let alert = NSAlert(); alert.messageText = "Backup could not be exported"; alert.informativeText = error.localizedDescription
        alert.beginSheetModal(for: window, completionHandler: nil)
    }
    func windowDidResignKey(_ notification: Notification) { pad.stop() }
    func applicationDidResignActive(_ notification: Notification) { pad?.stop() }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
    func applicationWillTerminate(_ notification: Notification) {
        pad?.stop(); if let monitor = keyMonitor { NSEvent.removeMonitor(monitor) }
        web?.configuration.userContentController.removeScriptMessageHandler(forName: "lintNative")
    }
    private func makeMenu() {
        let bar = NSMenu(), appItem = NSMenuItem(), appMenu = NSMenu()
        appMenu.addItem(withTitle: "About Lint", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator()); appMenu.addItem(withTitle: "Quit Lint", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu; bar.addItem(appItem)
        let editItem = NSMenuItem(), edit = NSMenu(title: "Edit")
        for (title, action, key) in [("Undo", "undo:", "z"), ("Cut", "cut:", "x"), ("Copy", "copy:", "c"), ("Paste", "paste:", "v"), ("Select All", "selectAll:", "a")] {
            edit.addItem(withTitle: title, action: Selector(action), keyEquivalent: key)
        }
        editItem.submenu = edit; bar.addItem(editItem); NSApp.mainMenu = bar
    }
}

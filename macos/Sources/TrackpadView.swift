import AppKit

/// Receives only indirect touches in Lint's own window, using public NSTouch APIs.
final class TrackpadView: NSView {
    var armed = false
    var onFrame: (([String: Any]) -> Void)?
    weak var webView: NSView?
    private var contact = false

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        acceptsTouchEvents = true
        allowedTouchTypes = [.indirect]
        wantsRestingTouches = true
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }
    override func hitTest(_ point: NSPoint) -> NSView? {
        guard armed, window?.isKeyWindow == true else { return nil }
        return super.hitTest(point)
    }
    func stop() {
        let wasArmed = armed
        endContact()
        armed = false
        if wasArmed { onFrame?(["type": "released"]) }
    }
    private func endContact() {
        if contact { onFrame?(["type": "touch", "phase": "end"]); contact = false }
    }
    private func publish(_ event: NSEvent) {
        guard armed, window?.isKeyWindow == true else { endContact(); return }
        let touches = event.touches(matching: .touching, in: self).filter { !$0.isResting }
        guard touches.count == 1, let touch = touches.first, touch.type == .indirect else {
            endContact()
            return
        }
        let p = touch.normalizedPosition
        guard p.x.isFinite, p.y.isFinite, p.x >= 0, p.x <= 1, p.y >= 0, p.y <= 1 else { endContact(); return }
        onFrame?(["type": "touch", "phase": contact ? "move" : "begin", "x": p.x, "y": 1 - p.y])
        contact = true
    }
    override func touchesBegan(with event: NSEvent) { publish(event) }
    override func touchesMoved(with event: NSEvent) { publish(event) }
    override func touchesEnded(with event: NSEvent) { endContact(); publish(event) }
    override func touchesCancelled(with event: NSEvent) { endContact() }
    override func scrollWheel(with event: NSEvent) {
        endContact()
        onFrame?(["type": "scroll"])
        webView?.scrollWheel(with: event)
    }
    override func mouseDown(with event: NSEvent) { stop(); webView?.mouseDown(with: event) }
}

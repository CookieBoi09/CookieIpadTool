import AppKit
let output = CommandLine.arguments[1]
let folder = URL(fileURLWithPath: output).appendingPathComponent("Lint.iconset")
try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
for base in [16, 32, 128, 256, 512] {
    for scale in [1, 2] {
        let size = base * scale
        let s = CGFloat(size)
        let image = NSImage(size: NSSize(width: s, height: s))
        image.lockFocus()
        NSColor.black.setFill(); NSBezierPath(roundedRect: NSRect(x: 0, y: 0, width: s, height: s), xRadius: CGFloat(size)*0.22, yRadius: CGFloat(size)*0.22).fill()
        let ring = NSBezierPath(ovalIn: NSRect(x: CGFloat(size)*0.165, y: CGFloat(size)*0.165, width: CGFloat(size)*0.67, height: CGFloat(size)*0.67))
        NSColor.white.setStroke(); ring.lineWidth = max(1, CGFloat(size)*0.012); ring.stroke()
        let mark = NSBezierPath()
        mark.move(to: NSPoint(x:s*0.4,y:s*0.71)); mark.line(to:NSPoint(x:s*0.464,y:s*0.71));mark.line(to:NSPoint(x:s*0.464,y:s*0.35));mark.line(to:NSPoint(x:s*0.65,y:s*0.35));mark.line(to:NSPoint(x:s*0.65,y:s*0.29));mark.line(to:NSPoint(x:s*0.4,y:s*0.29));mark.close();NSColor.white.setFill();mark.fill()
        image.unlockFocus()
        let bitmap = NSBitmapImageRep(data: image.tiffRepresentation!)!
        let name = "icon_\(base)x\(base)\(scale == 2 ? "@2x" : "").png"
        try bitmap.representation(using: .png, properties: [:])!.write(to: folder.appendingPathComponent(name))
    }
}
let task = Process(); task.executableURL = URL(fileURLWithPath:"/usr/bin/iconutil"); task.arguments=["-c","icns",folder.path,"-o",output+"/Lint.icns"];try task.run();task.waitUntilExit();if task.terminationStatus != 0 {exit(task.terminationStatus)}

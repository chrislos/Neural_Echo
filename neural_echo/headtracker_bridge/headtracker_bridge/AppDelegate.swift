import AppKit

class AppDelegate: NSObject, NSApplicationDelegate, HeadTrackerDelegate {
    private var statusItem: NSStatusItem!
    private var headTracker: HeadTracker!
    private var wsServer: WebSocketServer!
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)

        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        if let button = statusItem.button {
            let icon = NSImage(systemSymbolName: "circle.fill", accessibilityDescription: "headtracker bridge")
            icon?.isTemplate = true
            button.image = icon
        }

        let menu = NSMenu()
        menu.addItem(NSMenuItem(title: "Quit", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
        statusItem.menu = menu

        wsServer = WebSocketServer(port: 8080)
        wsServer.start()

        headTracker = HeadTracker()
        headTracker.delegate = self
        headTracker.onUpdate = { [weak self] data in
            self?.wsServer.broadcast(data)
        }

        headTracker.start()
    }

    func headTrackerConnectionChanged(_ connected: Bool) {}
}

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Minimal macOS menu bar app (no dock icon) that reads AirPods head tracking via `CMHeadphoneMotionManager` and streams yaw/pitch/roll as JSON over a local WebSocket server on port 8080. Targets macOS 12.0+.

## Build & Run

Open `headtracker_bridge.xcodeproj` in Xcode, set your Development Team, then build with **Cmd+B** or run with **Cmd+R**.

From the command line (after setting a team in Xcode once):
```
xcodebuild -project headtracker_bridge.xcodeproj -scheme headtracker_bridge -configuration Debug build
```

`start.sh` (one level up) launches the built app from `Debug/headtracker_bridge.app`
— gitignored, so a fresh clone must build once before the exhibition script works.

`test_client.js` is the only non-Swift file here and the reason `package.json`
exists (its single dependency `ws`): `npm install` once, then `node test_client.js`
connects to port 8080
and prints the JSON stream, which tells you whether the bridge or the browser
side is at fault. An old p5.js prototype (`public/`, `server.js`, `studies/`)
used to live in this folder and was removed — it had nothing to do with the
bridge.

## Required Setup (one-time)

1. **Development Team**: In Xcode → target → Signing & Capabilities, set your Apple Developer account team. The entitlement `com.apple.developer.coremotion.head-pose` requires a signed build — it will not work without code signing.
2. **Entitlement provisioning**: Add the "Head Pose" capability in your Apple Developer portal for the bundle ID `com.headtracker.bridge`, or change the bundle ID to one in your account.

## Architecture

```
main.swift          — bootstraps NSApplication and AppDelegate (pure AppKit, no SwiftUI)
AppDelegate         — owns NSStatusItem, HeadTracker, WebSocketServer; drives the menu
HeadTracker         — wraps CMHeadphoneMotionManager; fires delegate on connect/disconnect;
                      internally samples motion at native rate and re-broadcasts via Timer at 60 fps
WebSocketServer     — NWListener + NWProtocolWebSocket server; tracks live connections by
                      ObjectIdentifier and broadcasts Data to all of them
```

**Data flow**: AirPods → `CMHeadphoneMotionManager` callback (caches `latestMotion`) → 60 fps `Timer` → `JSONSerialization` → `WebSocketServer.broadcast(_:)` → each `NWConnection`.

**Connection state**: `HeadTracker.isConnected` reads `manager.isDeviceMotionAvailable` (true when compatible AirPods are paired and connected). Ongoing connect/disconnect events arrive via `CMHeadphoneMotionManagerDelegate` and trigger a menu rebuild on the main queue.

**WebSocket server** runs on a dedicated `DispatchQueue`. `broadcast` is called from the main thread (Timer fires on main run loop) and posts to connections that run on the server queue — NWConnection send is thread-safe.

## JSON output

```json
{"yaw": 0.0, "pitch": 0.0, "roll": 0.0}
```

Values are radians from `CMDeviceMotion.attitude` (reference frame: arbitrary, no calibration applied).

import CoreMotion
import Foundation

protocol HeadTrackerDelegate: AnyObject {
    func headTrackerConnectionChanged(_ connected: Bool)
}

class HeadTracker: NSObject, CMHeadphoneMotionManagerDelegate {
    weak var delegate: HeadTrackerDelegate?
    var onUpdate: ((Data) -> Void)?

    private let manager = CMHeadphoneMotionManager()
    private var broadcastTimer: Timer?
    private var latestMotion: CMDeviceMotion?

    // isDeviceMotionAvailable returns true when compatible AirPods are connected
    var isConnected: Bool { manager.isDeviceMotionAvailable }

    override init() {
        super.init()
        manager.delegate = self
    }

    func start() {
        guard manager.isDeviceMotionAvailable else { return }
        manager.startDeviceMotionUpdates(to: .main) { [weak self] motion, _ in
            self?.latestMotion = motion
        }
        broadcastTimer = Timer.scheduledTimer(withTimeInterval: 1.0 / 60.0, repeats: true) { [weak self] _ in
            guard let motion = self?.latestMotion else { return }
            self?.send(motion)
        }
    }

    func stop() {
        broadcastTimer?.invalidate()
        broadcastTimer = nil
        manager.stopDeviceMotionUpdates()
        latestMotion = nil
    }

    private func send(_ motion: CMDeviceMotion) {
        let dict: [String: Double] = [
            "yaw": motion.attitude.yaw,
            "pitch": motion.attitude.pitch,
            "roll": motion.attitude.roll
        ]
        guard let data = try? JSONSerialization.data(withJSONObject: dict) else { return }
        onUpdate?(data)
    }

    func headphoneMotionManagerDidConnect(_ manager: CMHeadphoneMotionManager) {
        delegate?.headTrackerConnectionChanged(true)
    }

    func headphoneMotionManagerDidDisconnect(_ manager: CMHeadphoneMotionManager) {
        delegate?.headTrackerConnectionChanged(false)
    }
}

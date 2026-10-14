import ExpoModulesCore
import AVFoundation

// Notification audio is prepared in the foreground, then played by iOS itself.
// No background audio session, hidden microphone or permanent running service.
public final class VehicleVoiceModule: Module {
  private var synthesizers: [String: AVSpeechSynthesizer] = [:]

  public func definition() -> ModuleDefinition {
    Name("VehicleVoice")
    AsyncFunction("prepareSound") { (text: String, name: String, promise: Promise) in
      guard text.count <= 256, name.range(of: "^[A-Za-z0-9_-]+\\.caf$", options: .regularExpression) != nil else {
        promise.reject("INVALID_SOUND", "Invalid notification sound")
        return
      }
      DispatchQueue.main.async {
        do {
          let manager = FileManager.default
          let directory = try manager.url(for: .libraryDirectory, in: .userDomainMask, appropriateFor: nil, create: true).appendingPathComponent("Sounds")
          try manager.createDirectory(at: directory, withIntermediateDirectories: true)
          let destination = directory.appendingPathComponent(name)
          let stamp = directory.appendingPathComponent(name + ".txt")
          if manager.fileExists(atPath: destination.path), (try? String(contentsOf: stamp, encoding: .utf8)) == text {
            promise.resolve(name)
            return
          }
          let temporary = directory.appendingPathComponent(name + ".temp.caf")
          try? manager.removeItem(at: temporary)
          let synthesizer = AVSpeechSynthesizer()
          self.synthesizers[name] = synthesizer
          let utterance = AVSpeechUtterance(string: text)
          utterance.voice = AVSpeechSynthesisVoice(language: "en-IN") ?? AVSpeechSynthesisVoice(language: "en-US")
          utterance.rate = 0.45
          var file: AVAudioFile?
          var duration: Double = 0
          var finished = false
          let fail: (String) -> Void = { message in
            guard !finished else { return }
            finished = true
            synthesizer.stopSpeaking(at: .immediate)
            try? manager.removeItem(at: temporary)
            self.synthesizers.removeValue(forKey: name)
            promise.reject("SOUND_PREPARATION_FAILED", message)
          }
          DispatchQueue.main.asyncAfter(deadline: .now() + 30) {
            if !finished { fail("Speech preparation timed out") }
          }
          synthesizer.write(utterance) { buffer in
            DispatchQueue.main.async {
            guard !finished, let pcm = buffer as? AVAudioPCMBuffer else { return }
            do {
              if pcm.frameLength == 0 {
                guard file != nil, duration > 0 else { fail("Speech produced no audio"); return }
                file = nil
                if manager.fileExists(atPath: destination.path) {
                  _ = try manager.replaceItemAt(destination, withItemAt: temporary)
                } else {
                  try manager.moveItem(at: temporary, to: destination)
                }
                try text.write(to: stamp, atomically: true, encoding: .utf8)
                finished = true
                self.synthesizers.removeValue(forKey: name)
                promise.resolve(name)
                return
              }
              duration += Double(pcm.frameLength) / pcm.format.sampleRate
              guard duration < 29 else { fail("Notification speech exceeds 29 seconds"); return }
              if file == nil {
                var settings = pcm.format.settings
                settings[AVLinearPCMBitDepthKey] = 16
                settings[AVLinearPCMIsFloatKey] = false
                file = try AVAudioFile(forWriting: temporary, settings: settings, commonFormat: pcm.format.commonFormat, interleaved: pcm.format.isInterleaved)
              }
              try file?.write(from: pcm)
            } catch { fail("Could not save notification audio") }
            }
          }
        } catch { promise.reject("SOUND_PREPARATION_FAILED", "Could not create notification audio directory") }
      }
    }
  }
}

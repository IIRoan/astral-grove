import CoreImage
import CoreMedia
import Foundation
import NitroModules
import Vision
import VisionCamera

final class HybridCardOcrFrame: HybridCardOcrFrameSpec {
  private let worker = ScanWorker<FrameScanResult>()
  private let pipeline = CardRecognitionPipeline()

  func resetScan() throws {
    worker.reset()
  }

  func pollScan(frame: (any HybridFrameSpec), options: FrameScanOptions) throws
    -> FrameScanResult?
  {
    guard let nativeFrame = frame as? any NativeFrame,
      let sampleBuffer = nativeFrame.sampleBuffer,
      let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer)
    else { return nil }

    // The closure retains the pixel buffer so JS can dispose its Frame immediately.
    return try worker.poll {
      try self.recognizeFrame(pixelBuffer: pixelBuffer, options: options)
    }
  }

  var descriptorVersion: Double {
    Double(ArtDescriptor.version)
  }

  func setArtIndex(index: ArrayBuffer) throws -> Double {
    guard index.size > 0 else {
      replaceArtIndex(nil)
      return 0
    }

    // The buffer belongs to JS and is only valid during this call, so take a copy.
    let data = Data(bytes: index.data, count: index.size)
    guard let parsed = parseArtIndex(data) else {
      replaceArtIndex(nil)
      throw RuntimeError.error(
        withMessage:
          "Art index is malformed or was built for another descriptor version than \(ArtDescriptor.version)"
      )
    }

    replaceArtIndex(parsed)
    return Double(parsed.keys.count)
  }

  func scan(frame: (any HybridFrameSpec), options: FrameScanOptions) throws
    -> FrameScanResult
  {
    guard let nativeFrame = frame as? any NativeFrame,
      let sampleBuffer = nativeFrame.sampleBuffer,
      let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer)
    else {
      return FrameScanResult(
        cardDetected: false, matches: [], locateMs: 0, describeMs: 0, searchMs: 0)
    }

    return try recognizeFrame(pixelBuffer: pixelBuffer, options: options)
  }

  private func recognizeFrame(pixelBuffer: CVPixelBuffer, options: FrameScanOptions)
    throws -> FrameScanResult
  {
    let result = try pipeline.recognize(
      pixelBuffer: pixelBuffer, orientation: options.orientation,
      guide: CGRect(
        x: options.regionX, y: options.regionY,
        width: options.regionWidth, height: options.regionHeight))

    return FrameScanResult(
      cardDetected: result.detected,
      matches: result.matches.map {
        CardMatch(key: $0.key, score: $0.score, hamming: Double($0.hamming))
      },
      locateMs: result.locateMs, describeMs: result.describeMs,
      searchMs: result.searchMs)
  }
}

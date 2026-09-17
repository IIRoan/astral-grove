import CoreImage
import CoreMedia
import Foundation
import NitroModules
import Vision
import VisionCamera

final class HybridCardOcrFrame: HybridCardOcrFrameSpec {
  private let worker = ScanWorker<FrameScanResult>()
  private let collector = CardCollectorPipeline()

  func resetScan() throws {
    worker.reset()
  }

  func pollScan(frame: (any HybridFrameSpec), options: FrameScanOptions) throws -> FrameScanResult? {
    guard let nativeFrame = frame as? any NativeFrame,
      let sampleBuffer = nativeFrame.sampleBuffer,
      let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer)
    else { return nil }

    // The closure retains the pixel buffer so JS can dispose its Frame immediately.
    return try worker.poll { try self.recognizeFrame(pixelBuffer: pixelBuffer, options: options) }
  }

  var embeddingVersion: String {
    "featureprint-r\(VNGenerateImageFeaturePrintRequest().revision)"
  }

  func embedImage(url: String) throws -> Promise<ArrayBuffer> {
    return Promise.async {
      guard let remote = URL(string: url) else {
        throw RuntimeError.error(withMessage: "Not a URL: \(url)")
      }
      let (data, _) = try await URLSession.shared.data(from: remote)
      // An error page is not an image, so a failed request ends up here too.
      guard let image = CIImage(data: data), let vector = featureVector(of: image) else {
        throw RuntimeError.error(withMessage: "Could not read card art at \(url)")
      }
      return try ArrayBuffer.copy(data: vector.withUnsafeBufferPointer { Data(buffer: $0) })
    }
  }

  func setIndex(keys: [String], vectors: ArrayBuffer) throws {
    let floatCount = vectors.size / MemoryLayout<Float>.size
    var index: ImageIndex?

    if !keys.isEmpty, floatCount > 0, floatCount % keys.count == 0 {
      // The buffer belongs to JS and is only valid during this call, so take a copy.
      var copy = [Float](repeating: 0, count: floatCount)
      copy.withUnsafeMutableBytes { destination in
        _ = memcpy(destination.baseAddress!, vectors.data, destination.count)
      }
      index = ImageIndex(keys: keys, dimension: floatCount / keys.count, vectors: copy)
    }

    replaceImageIndex(index)
  }

  func scan(frame: (any HybridFrameSpec), options: FrameScanOptions) throws
    -> FrameScanResult
  {
    guard let nativeFrame = frame as? any NativeFrame,
      let sampleBuffer = nativeFrame.sampleBuffer,
      let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer)
    else {
      return FrameScanResult(
        lines: [], cardDetected: false, matches: [], wholeCard: true,
        locateMs: 0, matchMs: 0, readMs: 0)
    }

    return try recognizeFrame(pixelBuffer: pixelBuffer, options: options)
  }

  private func recognizeFrame(pixelBuffer: CVPixelBuffer, options: FrameScanOptions) throws -> FrameScanResult {
    let result = try collector.read(
      pixelBuffer: pixelBuffer, orientation: options.orientation,
      guide: CGRect(x: options.regionX, y: options.regionY,
                    width: options.regionWidth, height: options.regionHeight))
    return FrameScanResult(lines: result.lines, cardDetected: result.detected,
                           matches: [], wholeCard: false, locateMs: result.locateMs,
                           matchMs: 0, readMs: result.readMs)
  }
}

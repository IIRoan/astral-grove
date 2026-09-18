import CoreImage
import CoreMedia
import Foundation
import ImageIO
import NitroModules
import Vision
import VisionCamera

// Bridge camera buffers to Vision; image processing, artwork matching and OCR live separately.
private func milliseconds(since start: CFAbsoluteTime) -> Double {
  (CFAbsoluteTimeGetCurrent() - start) * 1000
}

/**
 The camera's own light meter. Every video buffer carries EXIF BrightnessValue in APEX
 stops; it measures the scene rather than the boosted frame, so a dark room reads low
 however far auto-exposure has pushed the gain. Read here, before the buffer is handed
 on: JS disposes the sample buffer as soon as the pixel buffer has been retained.
 */
private func sceneBrightness(of sampleBuffer: CMSampleBuffer) -> Double? {
  let exif =
    CMGetAttachment(sampleBuffer, key: kCGImagePropertyExifDictionary, attachmentModeOut: nil)
    as? [String: Any]
  return exif?[kCGImagePropertyExifBrightnessValue as String] as? Double
}

final class HybridCardOcrFrame: HybridCardOcrFrameSpec {
  private let worker = ScanWorker<FrameScanResult>()

  func resetScan() throws {
    worker.reset()
  }

  func pollScan(frame: (any HybridFrameSpec), options: FrameScanOptions) throws -> FrameScanResult? {
    guard let nativeFrame = frame as? any NativeFrame,
      let sampleBuffer = nativeFrame.sampleBuffer,
      let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer)
    else { return nil }

    let brightness = sceneBrightness(of: sampleBuffer)
    // The closure retains the pixel buffer so JS can dispose its Frame immediately.
    return try worker.poll {
      try self.recognizeFrame(pixelBuffer: pixelBuffer, brightness: brightness, options: options)
    }
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
        locateMs: 0, matchMs: 0, readMs: 0, brightness: nil)
    }

    return try recognizeFrame(
      pixelBuffer: pixelBuffer, brightness: sceneBrightness(of: sampleBuffer), options: options)
  }

  private func recognizeFrame(
    pixelBuffer: CVPixelBuffer, brightness: Double?, options: FrameScanOptions
  ) throws -> FrameScanResult {
    // Frames arrive continuously; without the pool every intermediate Vision and
    // CoreImage allocation would be held until the thread's run loop drains.
    return try autoreleasepool { () throws -> FrameScanResult in
      // Bake the rotation in once, so every step below works in upright coordinates.
      let oriented = CIImage(cvPixelBuffer: pixelBuffer)
        .oriented(cgOrientation(from: options.orientation))

      var clock = CFAbsoluteTimeGetCurrent()
      let card = detectCard(in: oriented)
        ?? (options.wholeCard ? detectCard(in: enhancedTextImage(oriented)) : nil)
      let rectified = card.flatMap {
        rectify(oriented, to: $0, width: CGFloat(options.rectifiedWidth))
      }
      let locateMs = milliseconds(since: clock)

      let region = CGRect(
        x: options.regionX, y: options.regionY,
        width: options.regionWidth, height: options.regionHeight)
      // When edges disappear into a dark table, the full guide still contains useful art.
      let guide = options.wholeCard
        ? cropGuide(oriented, region: region, width: CGFloat(options.rectifiedWidth)) : nil
      guard var reading = rectified ?? guide else {
        clock = CFAbsoluteTimeGetCurrent()
        let hasRegion = options.regionWidth > 0 && options.regionHeight > 0
        let lines = try readText(
          in: oriented, region: hasRegion ? region : nil, options: options)
        return FrameScanResult(
          lines: lines, cardDetected: false, matches: [], wholeCard: options.wholeCard,
          locateMs: locateMs, matchMs: 0, readMs: milliseconds(since: clock),
          brightness: brightness)
      }

      // Dim light leaves the crop dark and grainy. Lift it toward a lit card's brightness
      // so the artwork compares as its reference does and the print has contrast.
      clock = CFAbsoluteTimeGetCurrent()
      let lift = exposureLift(forLuminance: meanLuminance(of: reading))
      reading = liftedExposure(reading, by: lift)

      // Recognize before reading: the artwork is also the only thing that can say the
      // card is upside down, and text is only legible the right way up. A landscape
      // card is left as it lies — its reference art is sideways, its print is not.
      var matches: [ImageMatch] = []
      if let index = currentIndex() {
        let recognized = recognize(reading, in: index)
        matches = recognized.matches
        if recognized.turned, reading.extent.width <= reading.extent.height {
          reading = reading.oriented(.down)
        }
      }
      let matchMs = milliseconds(since: clock)

      // The collector strip first: it is a fraction of a whole-card pass, and once the
      // artwork is recognized the code is all that is left to learn. The rest of the
      // card is only read when the strip shows no code, or the caller wants the name.
      clock = CFAbsoluteTimeGetCurrent()
      let text = try readCardText(in: reading, options: options, lowLight: lift > 0)

      return FrameScanResult(
        lines: text.lines, cardDetected: rectified != nil, matches: matches, wholeCard: text.wholeCard,
        locateMs: locateMs, matchMs: matchMs, readMs: milliseconds(since: clock),
        brightness: brightness)
    }
  }
}

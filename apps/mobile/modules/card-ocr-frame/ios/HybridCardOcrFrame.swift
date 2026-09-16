import CoreImage
import CoreMedia
import NitroModules
import Vision
import VisionCamera

/**
 * Apple Vision card recognition run directly on a camera frame.
 *
 * Nothing is captured, encoded, written or decoded: VisionCamera hands over the same
 * `CVPixelBuffer` that is already feeding the preview, so the preview is never
 * interrupted by a photo capture.
 *
 * The recognition itself is three steps rather than one:
 *
 *  1. Locate the card. `VNDetectRectanglesRequest` finds a card-shaped quadrilateral,
 *     which costs a fraction of a text pass.
 *  2. Straighten it. A perspective correction maps those four corners onto a flat
 *     upright image, scaled so the printed collector code covers real pixels.
 *  3. Read it. One text pass over that rectified card.
 *
 * Reading a fixed region of the raw frame — the previous approach — only worked when
 * the card was squarely inside the guide. Locating it first makes tilt, distance and
 * sloppy framing stop mattering, and because the card is cropped and enlarged before
 * the text pass, the pass is both more accurate and cheaper than scanning a whole
 * 4K frame.
 */

/** Reused across frames: building a CIContext per call is expensive. */
private let ciContext = CIContext(options: [.useSoftwareRenderer: false])

/** Cards are 5:7, so a located rectangle should be near 0.714 wide-over-tall. */
private let minCardAspect: Float = 0.55
private let maxCardAspect: Float = 0.85

/**
 VisionCamera does not rotate frame buffers up-front because rotating them is
 expensive — it reports how the pixels are rotated and leaves it to the consumer.
 */
private func cgOrientation(from orientation: String) -> CGImagePropertyOrientation {
  switch orientation {
  case "right": return .right
  case "down": return .down
  case "left": return .left
  default: return .up
  }
}

/** Locate the most prominent card-shaped quadrilateral, if there is one. */
private func detectCard(in image: CIImage) -> VNRectangleObservation? {
  let request = VNDetectRectanglesRequest()
  request.minimumAspectRatio = minCardAspect
  request.maximumAspectRatio = maxCardAspect
  // A card held up to scan fills a good part of the frame; this rejects background
  // rectangles like table edges and screens.
  request.minimumSize = 0.2
  request.minimumConfidence = 0.6
  // Cards have rounded corners and are held by hand, so allow some deviation.
  request.quadratureTolerance = 30
  request.maximumObservations = 1

  let handler = VNImageRequestHandler(ciImage: image, options: [.ciContext: ciContext])
  try? handler.perform([request])
  return (request.results as? [VNRectangleObservation])?.first
}

/**
 Map the located corners onto a flat, upright image. Vision reports corners normalized
 with the origin bottom-left, which is also CoreImage's convention, so the two line up.
 */
private func rectify(
  _ image: CIImage,
  to card: VNRectangleObservation,
  width: CGFloat
) -> CIImage? {
  let extent = image.extent
  func corner(_ point: CGPoint) -> CIVector {
    CIVector(x: extent.origin.x + point.x * extent.width,
             y: extent.origin.y + point.y * extent.height)
  }

  guard
    let filter = CIFilter(
      name: "CIPerspectiveCorrection",
      parameters: [
        kCIInputImageKey: image,
        "inputTopLeft": corner(card.topLeft),
        "inputTopRight": corner(card.topRight),
        "inputBottomLeft": corner(card.bottomLeft),
        "inputBottomRight": corner(card.bottomRight),
      ]
    ),
    let corrected = filter.outputImage,
    corrected.extent.width > 0
  else {
    return nil
  }

  // Enlarge (or reduce) to a known width so the printed code is a predictable size
  // regardless of how far away the card was held.
  let scale = width / corrected.extent.width
  return corrected.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
}

internal final class MissingPixelBufferException: Exception {
  override var reason: String {
    "The frame has no pixel buffer to recognize text in"
  }
}

final class HybridCardOcrFrame: HybridCardOcrFrameSpec {
  func scan(frame: (any HybridFrameSpec), options: FrameScanOptions) throws
    -> FrameScanResult
  {
    guard let nativeFrame = frame as? any NativeFrame,
      let sampleBuffer = nativeFrame.sampleBuffer,
      let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer)
    else {
      return FrameScanResult(lines: [], cardDetected: false)
    }

    // Frames arrive continuously; without the pool every intermediate Vision and
    // CoreImage allocation would be held until the thread's run loop drains.
    return try autoreleasepool {
      // Bake the rotation in once, so every step below works in upright coordinates.
      let oriented = CIImage(cvPixelBuffer: pixelBuffer)
        .oriented(cgOrientation(from: options.orientation))

      let request = VNRecognizeTextRequest()
      request.recognitionLevel = options.recognitionLevel == "fast" ? .fast : .accurate
      request.usesLanguageCorrection = options.usesLanguageCorrection
      request.recognitionLanguages = ["en-US"]

      let card = detectCard(in: oriented)
      let rectified = card.flatMap {
        rectify(oriented, to: $0, width: CGFloat(options.rectifiedWidth))
      }

      let target: CIImage
      if let rectified {
        // The card now fills the image, so the whole thing is worth reading: one pass
        // picks up both the name and the collector code.
        target = rectified
      } else {
        // No card located — fall back to the caller's fixed region on the raw frame.
        target = oriented
        if options.regionWidth > 0, options.regionHeight > 0 {
          request.regionOfInterest = CGRect(
            x: options.regionX,
            y: options.regionY,
            width: options.regionWidth,
            height: options.regionHeight
          )
        }
      }

      let handler = VNImageRequestHandler(
        ciImage: target,
        options: [.ciContext: ciContext]
      )
      try handler.perform([request])

      // `VNRequest.results` is `[VNObservation]?`, so it has to be narrowed before
      // `topCandidates` is available.
      let observations = (request.results as? [VNRecognizedTextObservation]) ?? []
      let maxCandidates = max(1, Int(options.maxCandidates))
      let lines = observations.map { observation in
        observation.topCandidates(maxCandidates).map { $0.string }
      }

      return FrameScanResult(lines: lines, cardDetected: rectified != nil)
    }
  }
}

import Accelerate
import CoreImage
import CoreMedia
import Foundation
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
 * The recognition itself is four steps rather than one:
 *
 *  1. Locate the card. `VNDetectRectanglesRequest` finds a card-shaped quadrilateral,
 *     which costs a fraction of a text pass.
 *  2. Straighten it. A perspective correction maps those four corners onto a flat
 *     upright image, scaled so the printed collector code covers real pixels.
 *  3. Read it. One text pass over that rectified card.
 *  4. Recognize it. The rectified card is embedded and looked up among the catalog's
 *     artwork, which tells printings apart that share a name — and still works when
 *     glare or blur has taken the small print.
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

/**
 Apple's image feature print: a general-purpose embedding in which images that look
 alike land close together. Reference art and camera frames both come through this one
 function, so the two sides are comparable whichever revision the OS ships.
 */
private func featureVector(of image: CIImage) -> [Float]? {
  let request = VNGenerateImageFeaturePrintRequest()
  // Squash rather than centre-crop: the whole card counts, edge to edge.
  request.imageCropAndScaleOption = .scaleFill

  let handler = VNImageRequestHandler(ciImage: image, options: [.ciContext: ciContext])
  try? handler.perform([request])
  guard
    let observation = (request.results as? [VNFeaturePrintObservation])?.first,
    observation.elementType == .float,
    observation.elementCount > 0
  else {
    return nil
  }

  var values = [Float](repeating: 0, count: observation.elementCount)
  _ = values.withUnsafeMutableBufferPointer { observation.data.copyBytes(to: $0) }

  // Unit length, so the dot product of two vectors is their cosine similarity.
  let norm = sqrt(values.reduce(Float(0)) { $0 + $1 * $1 })
  guard norm > 0 else { return nil }
  return values.map { $0 / norm }
}

/**
 The catalog's reference vectors. Immutable once built, so the frame thread only needs
 the lock long enough to pick up the reference.
 */
private final class ImageIndex {
  let keys: [String]
  let dimension: Int
  /** `keys.count` rows of `dimension`, row after row, each unit length. */
  let vectors: [Float]

  init(keys: [String], dimension: Int, vectors: [Float]) {
    self.keys = keys
    self.dimension = dimension
    self.vectors = vectors
  }
}

/**
 File-level rather than on the instance: the index is installed from the JS thread and
 read from the camera's frame thread.
 */
private let indexLock = NSLock()
private var installedIndex: ImageIndex?

private func currentIndex() -> ImageIndex? {
  indexLock.lock()
  defer { indexLock.unlock() }
  return installedIndex
}

/** How many nearest catalog images are reported per frame. */
private let maxMatches = 5

private func nearest(to query: [Float], in index: ImageIndex) -> [ImageMatch] {
  guard query.count == index.dimension else { return [] }

  // One matrix-vector product scores the whole catalog. At ~1,200 images that is about
  // a million multiply-adds — well under a millisecond, and far below the size where an
  // approximate index would earn its keep. vDSP keeps it that fast in debug builds too.
  var scores = [Float](repeating: 0, count: index.keys.count)
  vDSP_mmul(
    index.vectors, 1, query, 1, &scores, 1,
    vDSP_Length(index.keys.count), 1, vDSP_Length(index.dimension)
  )

  return scores.enumerated()
    .sorted { $0.element > $1.element }
    .prefix(maxMatches)
    .map { ImageMatch(key: index.keys[$0.offset], score: Double($0.element)) }
}

/**
 Reference art is stored portrait even for battlefields, which are printed landscape.
 A landscape card is tried turned both ways, which also covers it being held upside down.
 */
private func portraitCandidates(of card: CIImage) -> [CIImage] {
  guard card.extent.width > card.extent.height else { return [card] }
  return [card.oriented(.left), card.oriented(.right)]
}

/** Look the rectified card up in the index: the best result across its orientations. */
private func recognize(_ card: CIImage, in index: ImageIndex) -> [ImageMatch] {
  var best: [ImageMatch] = []
  for candidate in portraitCandidates(of: card) {
    guard let vector = featureVector(of: candidate) else { continue }
    let found = nearest(to: vector, in: index)
    if (found.first?.score ?? 0) > (best.first?.score ?? 0) {
      best = found
    }
  }
  return best
}

final class HybridCardOcrFrame: HybridCardOcrFrameSpec {
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

    indexLock.lock()
    installedIndex = index
    indexLock.unlock()
  }

  func scan(frame: (any HybridFrameSpec), options: FrameScanOptions) throws
    -> FrameScanResult
  {
    guard let nativeFrame = frame as? any NativeFrame,
      let sampleBuffer = nativeFrame.sampleBuffer,
      let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer)
    else {
      return FrameScanResult(lines: [], cardDetected: false, matches: [])
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

      // Only a located card is worth looking up: a raw frame is mostly table.
      var matches: [ImageMatch] = []
      if let rectified, let index = currentIndex() {
        matches = recognize(rectified, in: index)
      }

      return FrameScanResult(
        lines: lines, cardDetected: rectified != nil, matches: matches)
    }
  }
}

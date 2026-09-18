import CoreImage
import Vision

/** Reused across frames: building a CIContext per call is expensive. */
let ciContext = CIContext(options: [.useSoftwareRenderer: false])

/** Cards are 5:7, so a located rectangle should be near 0.714 wide-over-tall. */
private let minCardAspect: Float = 0.55
private let maxCardAspect: Float = 0.85

/**
 VisionCamera does not rotate frame buffers up-front because rotating them is
 expensive — it reports how the pixels are rotated and leaves it to the consumer.
 */
func cgOrientation(from orientation: String) -> CGImagePropertyOrientation {
  switch orientation {
  case "right": return .right
  case "down": return .down
  case "left": return .left
  default: return .up
  }
}

// Lift shadows and separate text from colored artwork without changing reference embeddings.
func enhancedTextImage(_ image: CIImage) -> CIImage {
  image.applyingFilter("CIHighlightShadowAdjust", parameters: ["inputShadowAmount": 0.7])
    .applyingFilter("CIColorControls", parameters: [
      kCIInputSaturationKey: 0.0, kCIInputContrastKey: 1.25,
    ])
}

/** Small print under lifted sensor noise: smooth the grain first, then enhance as usual. */
func lowLightTextImage(_ image: CIImage) -> CIImage {
  enhancedTextImage(
    image.applyingFilter(
      "CINoiseReduction", parameters: ["inputNoiseLevel": 0.04, "inputSharpness": 0.4]))
}

/** Mean luminance of `image`, 0 black to 1 white: one GPU reduction to a single pixel. */
func meanLuminance(of image: CIImage) -> Float? {
  let extent = image.extent
  guard !extent.isInfinite, !extent.isEmpty else { return nil }
  let averaged = image.applyingFilter(
    "CIAreaAverage", parameters: [kCIInputExtentKey: CIVector(cgRect: extent)])
  var pixel = [UInt8](repeating: 0, count: 4)
  ciContext.render(
    averaged, toBitmap: &pixel, rowBytes: 4,
    bounds: CGRect(x: 0, y: 0, width: 1, height: 1), format: .RGBA8,
    colorSpace: CGColorSpace(name: CGColorSpace.sRGB))
  return (0.2126 * Float(pixel[0]) + 0.7152 * Float(pixel[1]) + 0.0722 * Float(pixel[2])) / 255
}

/** Where a lit card's mean luminance lands; the lift aims here. */
private let targetLuminance: Float = 0.45
/** Below this a crop is dark enough to be worth lifting. */
private let darkLuminance: Float = 0.3
/** Past two stops only the sensor noise gets brighter. */
private let maxExposureLift: Float = 2
// ponytail: target and cutoff are guesses from typical exposures, not this camera — tune on device.

/** Stops of exposure that bring a dark crop up to a lit card's brightness; zero if it is there. */
func exposureLift(forLuminance luminance: Float?) -> Float {
  guard let luminance, luminance > 0, luminance < darkLuminance else { return 0 }
  return min(maxExposureLift, log2(targetLuminance / luminance))
}

func liftedExposure(_ image: CIImage, by stops: Float) -> CIImage {
  stops > 0 ? image.applyingFilter("CIExposureAdjust", parameters: [kCIInputEVKey: stops]) : image
}

func cropGuide(_ image: CIImage, region: CGRect, width: CGFloat) -> CIImage? {
  let extent = image.extent
  let rect = CGRect(
    x: extent.minX + region.minX * extent.width,
    y: extent.minY + region.minY * extent.height,
    width: region.width * extent.width, height: region.height * extent.height
  ).intersection(extent)
  guard !rect.isNull, rect.width > 0, rect.height > 0 else { return nil }
  let crop = image.cropped(to: rect)
    .transformed(by: CGAffineTransform(translationX: -rect.minX, y: -rect.minY))
  let scale = width / rect.width
  return crop.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
}

/** Locate the most prominent card-shaped quadrilateral, if there is one. */
func detectCard(in image: CIImage) -> VNRectangleObservation? {
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
func rectify(
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

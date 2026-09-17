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
  request.minimumSize = 0.5
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

  // Reduce to a known width so the descriptor sees the same amount of detail whether
  // the card was held at arm's length or up against the lens.
  let scale = width / corrected.extent.width
  return corrected.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
}

import CoreImage
import CoreMedia
import Vision

struct CardRecognition {
  let detected: Bool
  let matches: [ArtMatch]
  let locateMs: Double
  let describeMs: Double
  let searchMs: Double
}

/**
 Width the guide crop is taken at. Rectangle detection only has to find the card's
 edges, and the descriptor averages the card down to a 160-pixel-wide grid, so there is
 nothing left to gain above this — the previous collector-code pipeline needed 1200
 because it was reading print a few pixels tall.
 */
private let locateWidth: CGFloat = 640

/** Width the located card is straightened to. Comfortably above the canonical face. */
private let describeWidth: CGFloat = 400

/** Owned by the serial scan worker: one frame is in flight at a time. */
final class CardRecognitionPipeline {
  func recognize(pixelBuffer: CVPixelBuffer, orientation: String, guide: CGRect) throws
    -> CardRecognition
  {
    try autoreleasepool {
      let locateStart = CFAbsoluteTimeGetCurrent()
      let oriented = CIImage(cvPixelBuffer: pixelBuffer)
        .oriented(cgOrientation(from: orientation))

      // Crop before detection: a card lying on the table behind the one being scanned
      // must not win over the one inside the guide.
      guard let framed = cropGuide(oriented, region: guide, width: locateWidth) else {
        return CardRecognition(
          detected: false, matches: [], locateMs: 0, describeMs: 0, searchMs: 0)
      }

      let rectangle = detectCard(in: framed)
      let card = rectangle.flatMap { rectify(framed, to: $0, width: describeWidth) }
      let locateMs = (CFAbsoluteTimeGetCurrent() - locateStart) * 1000

      guard let index = currentArtIndex() else {
        return CardRecognition(
          detected: rectangle != nil, matches: [], locateMs: locateMs, describeMs: 0,
          searchMs: 0)
      }

      // With no located edges the guide crop is described as it stands. The overlay
      // asks the user to fill the guide, so that still recognizes a card held square
      // against a background Vision could not find a quadrilateral in.
      let subject = card ?? framed
      let found = matchArt(subject, in: index)

      return CardRecognition(
        detected: rectangle != nil, matches: found.matches, locateMs: locateMs,
        describeMs: found.describeMs, searchMs: found.searchMs)
    }
  }
}

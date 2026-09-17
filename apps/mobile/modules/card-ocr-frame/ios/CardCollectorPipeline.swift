import CoreImage
import CoreMedia
import Vision

struct CollectorReading {
  let lines: [[String]]
  let detected: Bool
  let locateMs: Double
  let readMs: Double
}

// Owned by the serial scan worker; only a tiny footer reaches the text-recognition model.
final class CardCollectorPipeline {
  private var plan = FooterScanPlan()

  func read(pixelBuffer: CVPixelBuffer, orientation: String, guide: CGRect) throws -> CollectorReading {
    try autoreleasepool {
      let start = CFAbsoluteTimeGetCurrent()
      let oriented = CIImage(cvPixelBuffer: pixelBuffer).oriented(cgOrientation(from: orientation))
      // Crop before detection: a background card must not win over the one inside the guide.
      guard let framed = cropGuide(oriented, region: guide, width: 1200),
        let small = cropGuide(framed, region: CGRect(x: 0, y: 0, width: 1, height: 1), width: 640)
      else { return CollectorReading(lines: [], detected: false, locateMs: 0, readMs: 0) }
      let rectangle = detectCard(in: small, useDocumentSegmentation: plan.useDocumentSegmentation)
      let card = rectangle.flatMap { rectify(framed, to: $0, width: 1200) } ?? framed
      let landscape = card.extent.width > card.extent.height
      let turns = plan.quarterTurns(landscape: landscape)
      let rotations: [CGImagePropertyOrientation] = [.up, .right, .down, .left]
      let reading = card.oriented(rotations[turns])
      let locateMs = (CFAbsoluteTimeGetCurrent() - start) * 1000
      let readStart = CFAbsoluteTimeGetCurrent()
      let lines = try readCollectorFooter(in: reading, enhance: plan.enhance)
      plan.record(foundCode: containsCollectorNumber(lines), quarterTurns: turns, landscape: landscape)
      return CollectorReading(lines: lines, detected: rectangle != nil,
                              locateMs: locateMs, readMs: (CFAbsoluteTimeGetCurrent() - readStart) * 1000)
    }
  }
}

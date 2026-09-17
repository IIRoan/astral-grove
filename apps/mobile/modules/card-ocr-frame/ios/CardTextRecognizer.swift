import CoreImage
import Vision

// A physical crop gives the tiny serial number the OCR input, rather than the entire card.
func readCollectorFooter(in card: CIImage, enhance: Bool) throws -> [[String]] {
  guard let footer = cropGuide(
    card, region: CGRect(x: 0, y: 0, width: 1, height: 0.16), width: 1600
  ) else { return [] }
  let image = enhance ? enhancedTextImage(footer) : footer
  let request = VNRecognizeTextRequest()
  request.recognitionLevel = .accurate
  request.usesLanguageCorrection = false
  request.recognitionLanguages = ["en-US"]
  request.minimumTextHeight = 0
  let handler = VNImageRequestHandler(ciImage: image, options: [.ciContext: ciContext])
  try handler.perform([request])
  let observations = (request.results as? [VNRecognizedTextObservation]) ?? []
  // Keep split set/number observations in reading order for the catalog parser.
  return observations.sorted {
    let row0 = ( $0.boundingBox.midY * 10 ).rounded()
    let row1 = ( $1.boundingBox.midY * 10 ).rounded()
    if row0 != row1 { return row0 > row1 }
    return $0.boundingBox.minX < $1.boundingBox.minX
  }.compactMap { observation in
    let candidates = observation.topCandidates(3)
      .filter { $0.confidence >= 0.25 }
      .map { $0.string }
    return candidates.isEmpty ? nil : candidates
  }
}

func containsCollectorNumber(_ lines: [[String]]) -> Bool {
  lines.joined().contains {
    $0.range(of: #"[0-9OIlLSBZ]{1,3}\s*[a-zA-Z*]?\s*/\s*\d{1,3}"#,
             options: .regularExpression) != nil
  }
}

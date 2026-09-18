import CoreImage
import Vision

/**
 The collector line sits in the bottom sixth of every card face. Vision's region of
 interest is normalized with the origin bottom-left, so this is that strip.
 */
private let collectorStrip = CGRect(x: 0, y: 0, width: 1, height: 0.16)

// The shape every printed collector number has: `179/298`, `166b/298`, or a signed
// card's star before the slash. (A line comment on purpose — that star-slash pair
// would end a block comment.)
private func looksLikeCollectorCode(_ readings: [String]) -> Bool {
  readings.contains {
    $0.range(of: #"\d\s*[A-Za-z*]?\s*/\s*\d"#, options: .regularExpression) != nil
  }
}

/** One text pass over `image`, or over just `region` of it: ranked readings per line. */
func readText(
  in image: CIImage,
  region: CGRect?,
  options: FrameScanOptions
) throws -> [[String]] {
  let request = VNRecognizeTextRequest()
  request.recognitionLevel = options.recognitionLevel == "fast" ? .fast : .accurate
  request.usesLanguageCorrection = options.usesLanguageCorrection
  request.recognitionLanguages = ["en-US"]
  request.minimumTextHeight = 0
  if let region {
    request.regionOfInterest = region
  }

  let handler = VNImageRequestHandler(ciImage: image, options: [.ciContext: ciContext])
  try handler.perform([request])

  // `VNRequest.results` is `[VNObservation]?`, so it has to be narrowed before
  // `topCandidates` is available.
  let observations = (request.results as? [VNRecognizedTextObservation]) ?? []
  let maxCandidates = max(1, Int(options.maxCandidates))
  return observations.map { observation in
    observation.topCandidates(maxCandidates).map { $0.string }
  }
}

func readCardText(in image: CIImage, options: FrameScanOptions) throws -> (
  lines: [[String]], wholeCard: Bool
) {
  var lines: [[String]] = []
  var wholeCard = options.wholeCard
  if !wholeCard {
    lines = try readText(in: image, region: collectorStrip, options: options)
    wholeCard = !lines.contains(where: looksLikeCollectorCode)
  }
  if wholeCard {
    lines = try readText(in: image, region: nil, options: options)
    if !lines.contains(where: looksLikeCollectorCode) {
      // Retain the original readings: enhancement can help small print but lose fine detail.
      lines += try readText(in: enhancedTextImage(image), region: nil, options: options)
    }
  }

  return (lines, wholeCard)
}

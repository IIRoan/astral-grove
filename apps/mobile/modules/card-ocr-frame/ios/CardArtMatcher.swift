import Accelerate
import CoreImage
import Foundation
import Vision

/**
 Apple's image feature print: a general-purpose embedding in which images that look
 alike land close together. Reference art and camera frames both come through this one
 function, so the two sides are comparable whichever revision the OS ships.
 */
func featureVector(of image: CIImage) -> [Float]? {
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
final class ImageIndex {
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

func currentIndex() -> ImageIndex? {
  indexLock.lock()
  defer { indexLock.unlock() }
  return installedIndex
}

/** How many nearest catalog images are reported per frame. */
private let maxMatches = 5

private func nearest(to query: [Float], in index: ImageIndex) -> [ImageMatch] {
  guard query.count == index.dimension else { return [] }

  // Score the catalog in one matrix-vector product.
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
 The ways a located card might really be lying, as images to look up.

 Reference art is stored portrait even for battlefields, which are printed landscape, so
 a landscape card is turned both ways. A portrait card is also tried upside down: cards
 come off a pile any way up, and nothing else in the pipeline can tell.
 */
private func lookupCandidates(of card: CIImage) -> [CIImage] {
  card.extent.width > card.extent.height
    ? [card.oriented(.left), card.oriented(.right)]
    : [card, card.oriented(.down)]
}

/**
 A second orientation has to beat the first by this much to win. Some art is close to
 symmetrical, and a coin flip there would turn a readable card upside down.
 */
private let orientationMargin = 0.05

/**
 Look the rectified card up in the index. Returns the best matches across the ways it
 might be lying, and whether it was the second of them that won.
 */
func recognize(_ card: CIImage, in index: ImageIndex) -> (
  matches: [ImageMatch], turned: Bool
) {
  var best: [ImageMatch] = []
  var turned = false
  for (position, candidate) in lookupCandidates(of: card).enumerated() {
    guard let vector = featureVector(of: candidate) else { continue }
    let found = nearest(to: vector, in: index)
    let lead = position == 0 ? 0 : orientationMargin
    if (found.first?.score ?? 0) > (best.first?.score ?? 0) + lead {
      best = found
      turned = position > 0
    }
  }
  return (best, turned)
}

func replaceImageIndex(_ index: ImageIndex?) {
  indexLock.lock()
  installedIndex = index
  indexLock.unlock()
}

import Accelerate
import CoreImage
import Foundation

/**
 The catalog's reference descriptors, exactly as the API packed them.

 Immutable once built, so the frame thread only holds the lock long enough to pick up
 the reference. Vectors are unpacked to unit-length float rows because that turns the
 whole catalog search into one `vDSP` matrix-vector product whose output is already
 cosine similarity.
 */
/**
 One catalog image the card in frame looks like.

 A plain struct converted to the Nitro type at the bridge, rather than the generated
 type itself: it keeps the whole search path compilable — and therefore testable — from
 `swiftc` alone, without the C++ interop the module needs to build.
 */
struct ArtMatch {
  let key: String
  /** Cosine similarity of the two descriptors: 1 is identical, 0 unrelated. */
  let score: Double
  /** Disagreeing gradient bits. Low confirms the layout, high vetoes a lucky score. */
  let hamming: Int
}

final class ArtIndex {
  let keys: [String]
  /** `keys.count` rows of `ArtDescriptor.dimension`, row after row, each unit length. */
  let vectors: [Float]
  /** `keys.count` rows of `ArtDescriptor.bitBytes`, row after row. */
  let bits: [UInt8]

  init(keys: [String], vectors: [Float], bits: [UInt8]) {
    self.keys = keys
    self.vectors = vectors
    self.bits = bits
  }
}

private let indexMagic: [UInt8] = Array("RBAI".utf8)
private let indexHeaderBytes = 16

/**
 Read a packed art index. Returns nil rather than a partial index for anything
 malformed, and for a payload built by a descriptor version this binary cannot compare
 against — a wrong-version index would score every card as unrelated.
 */
func parseArtIndex(_ data: Data) -> ArtIndex? {
  guard data.count >= indexHeaderBytes else { return nil }
  let bytes = [UInt8](data)
  guard Array(bytes[0..<4]) == indexMagic else { return nil }

  func u16(_ at: Int) -> Int { Int(bytes[at]) | Int(bytes[at + 1]) << 8 }
  func u32(_ at: Int) -> Int {
    Int(bytes[at]) | Int(bytes[at + 1]) << 8 | Int(bytes[at + 2]) << 16
      | Int(bytes[at + 3]) << 24
  }

  guard u16(4) == ArtDescriptor.version,
    u16(6) == ArtDescriptor.dimension,
    u16(8) == ArtDescriptor.bitBytes
  else { return nil }

  let count = u32(12)
  var keys = [String]()
  var vectors = [Float]()
  var packedBits = [UInt8]()
  keys.reserveCapacity(count)
  vectors.reserveCapacity(count * ArtDescriptor.dimension)
  packedBits.reserveCapacity(count * ArtDescriptor.bitBytes)

  var at = indexHeaderBytes
  for _ in 0..<count {
    guard at < bytes.count else { return nil }
    let keyLength = Int(bytes[at])
    at += 1
    let end = at + keyLength + ArtDescriptor.dimension + ArtDescriptor.bitBytes
    guard keyLength > 0, end <= bytes.count else { return nil }

    guard let key = String(bytes: bytes[at..<(at + keyLength)], encoding: .utf8) else {
      return nil
    }
    at += keyLength

    var norm = Float(0)
    var row = [Float](repeating: 0, count: ArtDescriptor.dimension)
    for i in 0..<ArtDescriptor.dimension {
      let value = Float(Int8(bitPattern: bytes[at + i]))
      row[i] = value
      norm += value * value
    }
    at += ArtDescriptor.dimension

    norm = norm.squareRoot()
    // A zero row would make every score NaN, so a flat reference is dropped instead.
    guard norm > 0 else {
      at += ArtDescriptor.bitBytes
      continue
    }
    for i in 0..<ArtDescriptor.dimension { row[i] /= norm }

    keys.append(key)
    vectors.append(contentsOf: row)
    packedBits.append(contentsOf: bytes[at..<(at + ArtDescriptor.bitBytes)])
    at += ArtDescriptor.bitBytes
  }

  return ArtIndex(keys: keys, vectors: vectors, bits: packedBits)
}

/**
 File-level rather than on the instance: the index is installed from the JS thread and
 read from the camera's frame thread.
 */
private let indexLock = NSLock()
private var installedIndex: ArtIndex?

func currentArtIndex() -> ArtIndex? {
  indexLock.lock()
  defer { indexLock.unlock() }
  return installedIndex
}

func replaceArtIndex(_ index: ArtIndex?) {
  indexLock.lock()
  installedIndex = index
  indexLock.unlock()
}

/**
 How many nearest catalog images are reported per frame. Gradient bits are counted for
 these and no others: they are there to veto a lucky cosine on the winner, not to rank
 the catalog, and popcounting every row each frame would cost more than the search.
 */
private let maxMatches = 5

private func hammingDistance(_ query: [UInt8], _ index: ArtIndex, row: Int) -> Int {
  let offset = row * ArtDescriptor.bitBytes
  var distance = 0
  for i in 0..<ArtDescriptor.bitBytes {
    distance += (query[i] ^ index.bits[offset + i]).nonzeroBitCount
  }
  return distance
}

private func nearest(to descriptor: CardDescriptor, in index: ArtIndex) -> [ArtMatch] {
  guard !index.keys.isEmpty else { return [] }

  var query = [Float](repeating: 0, count: ArtDescriptor.dimension)
  var norm = Float(0)
  for i in 0..<ArtDescriptor.dimension {
    let value = Float(descriptor.vector[i])
    query[i] = value
    norm += value * value
  }
  norm = norm.squareRoot()
  guard norm > 0 else { return [] }
  for i in 0..<ArtDescriptor.dimension { query[i] /= norm }

  // Score the whole catalog in one matrix-vector product.
  var scores = [Float](repeating: 0, count: index.keys.count)
  vDSP_mmul(
    index.vectors, 1, query, 1, &scores, 1,
    vDSP_Length(index.keys.count), 1, vDSP_Length(ArtDescriptor.dimension))

  return scores.enumerated()
    .sorted { $0.element > $1.element }
    .prefix(maxMatches)
    .map {
      ArtMatch(
        key: index.keys[$0.offset], score: Double($0.element),
        hamming: hammingDistance(descriptor.bits, index, row: $0.offset))
    }
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

/** Look the rectified card up in the index, trying each way it might be lying. */
func recognize(_ card: CIImage, in index: ArtIndex) -> (
  matches: [ArtMatch], describeMs: Double, searchMs: Double
) {
  var best: [ArtMatch] = []
  var describeMs = 0.0
  var searchMs = 0.0

  for (position, candidate) in lookupCandidates(of: card).enumerated() {
    let describeStart = CFAbsoluteTimeGetCurrent()
    let descriptor = describeCard(candidate)
    describeMs += (CFAbsoluteTimeGetCurrent() - describeStart) * 1000
    guard let descriptor else { continue }

    let searchStart = CFAbsoluteTimeGetCurrent()
    let found = nearest(to: descriptor, in: index)
    searchMs += (CFAbsoluteTimeGetCurrent() - searchStart) * 1000

    let lead = position == 0 ? 0 : orientationMargin
    if (found.first?.score ?? -1) > (best.first?.score ?? -1) + lead {
      best = found
    }
  }

  return (best, describeMs, searchMs)
}

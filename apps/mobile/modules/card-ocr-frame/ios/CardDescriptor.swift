import CoreGraphics
import CoreImage
import Foundation

/**
 The device half of the visual card fingerprint.

 Every constant and every arithmetic step here mirrors `describeCardPixels` in
 `packages/contracts/src/card-art.ts`, because the API describes the catalog with that
 code and this describes the camera's view of a real card, and the two descriptions are
 compared directly. `DescriptorParityTests` runs both over one image and fails if they
 drift apart. Change one side and you must change the other and bump the version.
 */
enum ArtDescriptor {
  static let version = 1

  /** Trimmed from each edge before scaling, at the rectified resolution. */
  static let trimInset: CGFloat = 0.03

  static let width = 160
  static let height = 224

  static let gridColumns = 10
  static let gridRows = 14
  static let blockCount = gridColumns * gridRows

  static let channels = 3
  static let dimension = blockCount * channels

  static let bitCount = (gridColumns - 1) * gridRows + gridColumns * (gridRows - 1)
  static let bitBytes = bitCount / 8
}

/** A standard deviation below this means a flat channel, which normalizes to nothing. */
private let flatEpsilon = 1e-6

struct CardDescriptor {
  /** `ArtDescriptor.dimension` values, channel-major, direction-quantized to int8. */
  let vector: [Int8]
  /** `ArtDescriptor.bitBytes` of gradient signs, most significant bit first. */
  let bits: [UInt8]
}

/** sRGB rather than the device space: the reference side stores raw sRGB bytes. */
private let faceColorSpace = CGColorSpace(name: CGColorSpace.sRGB)!

/**
 A context that does no colour management, unlike the shared one Vision uses.

 CoreImage would otherwise linearize before scaling and re-encode afterwards, and
 resampling in linear light averages blocks differently than resampling the encoded
 values — which is what the reference side does. That is exactly the sort of quiet
 cross-runtime disagreement this descriptor is built to rule out.
 */
private let faceContext = CIContext(options: [
  .useSoftwareRenderer: false,
  .workingColorSpace: NSNull(),
])

/**
 Reduce a rectified card to its descriptor.

 The trim happens on the incoming image, at whatever resolution it was rectified to, so
 the black border is gone before the scale down averages pixels across it.
 */
func describeCard(_ card: CIImage) -> CardDescriptor? {
  let extent = card.extent
  guard extent.width >= 8, extent.height >= 8 else { return nil }

  let inset = extent.insetBy(
    dx: extent.width * ArtDescriptor.trimInset,
    dy: extent.height * ArtDescriptor.trimInset)
  let trimmed = card.cropped(to: inset)
    .transformed(by: CGAffineTransform(translationX: -inset.minX, y: -inset.minY))

  // Lanczos to match the reference side's resampler. The aspect parameter carries the
  // non-uniform part: a card photographed at a slight angle rectifies to a rectangle
  // that is close to 5:7 but never exactly, and it has to land on the canonical face
  // rather than be letterboxed into it.
  let scale = CGFloat(ArtDescriptor.height) / inset.height
  let aspectRatio =
    (CGFloat(ArtDescriptor.width) / CGFloat(ArtDescriptor.height))
    / (inset.width / inset.height)
  let scaled = trimmed.applyingFilter(
    "CILanczosScaleTransform",
    parameters: [kCIInputScaleKey: scale, kCIInputAspectRatioKey: aspectRatio])

  let bounds = CGRect(x: 0, y: 0, width: ArtDescriptor.width, height: ArtDescriptor.height)
  // Tagged sRGB so the draw below is a straight copy rather than a conversion.
  guard
    let image = faceContext.createCGImage(
      scaled, from: bounds, format: .RGBA8, colorSpace: faceColorSpace)
  else { return nil }

  // Drawn through a CGContext rather than rendered straight out of CoreImage: a bitmap
  // context's rows always run top-down, which is the order the reference bytes are in,
  // whereas CoreImage's own origin is bottom-left. Getting that backwards would
  // describe every card upside down and match nothing.
  let rowBytes = ArtDescriptor.width * 4
  let byteCount = rowBytes * ArtDescriptor.height
  let buffer = UnsafeMutableRawPointer.allocate(byteCount: byteCount, alignment: 16)
  defer { buffer.deallocate() }
  memset(buffer, 0, byteCount)

  guard
    let context = CGContext(
      data: buffer, width: ArtDescriptor.width, height: ArtDescriptor.height,
      bitsPerComponent: 8, bytesPerRow: rowBytes, space: faceColorSpace,
      bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)
  else { return nil }

  context.interpolationQuality = .none
  context.draw(image, in: bounds)

  return describeCardFace(
    rgbx: buffer.assumingMemoryBound(to: UInt8.self), rowBytes: rowBytes)
}

/**
 Describe one canonical card face: `ArtDescriptor.width` × `ArtDescriptor.height`
 pixels of 8-bit RGB with a padding byte, rows top-down.
 */
func describeCardFace(rgbx: UnsafePointer<UInt8>, rowBytes: Int) -> CardDescriptor {
  let blockWidth = ArtDescriptor.width / ArtDescriptor.gridColumns
  let blockHeight = ArtDescriptor.height / ArtDescriptor.gridRows

  var sums = [Double](repeating: 0, count: ArtDescriptor.blockCount * 3)
  for y in 0..<ArtDescriptor.height {
    let blockRow = y / blockHeight
    let row = rgbx + y * rowBytes
    for x in 0..<ArtDescriptor.width {
      let block = (blockRow * ArtDescriptor.gridColumns + x / blockWidth) * 3
      let pixel = row + x * 4
      sums[block] += Double(pixel[0])
      sums[block + 1] += Double(pixel[1])
      sums[block + 2] += Double(pixel[2])
    }
  }

  // Grey-world balance, before anything mixes the channels together. A different
  // illuminant multiplies R, G and B by three different factors, and dividing each by
  // its own average over the card cancels exactly that. It has to happen here: the
  // opponent channels below are differences, and no later centring or scaling of a
  // difference can undo a change that scaled its two terms unequally.
  let perBlock = 1 / Double(blockWidth * blockHeight)
  var gain = [Double](repeating: 0, count: 3)
  for channel in 0..<3 {
    var total = 0.0
    for block in 0..<ArtDescriptor.blockCount { total += sums[block * 3 + channel] }
    let mean = (total * perBlock) / Double(ArtDescriptor.blockCount)
    gain[channel] = mean < flatEpsilon ? 0 : 1 / mean
  }

  // Opponent channels are linear in R, G and B, so averaging the pixels first and
  // converting once per block gives the same numbers as converting every pixel.
  var values = [Double](repeating: 0, count: ArtDescriptor.dimension)
  for block in 0..<ArtDescriptor.blockCount {
    let red = sums[block * 3] * perBlock * gain[0]
    let green = sums[block * 3 + 1] * perBlock * gain[1]
    let blue = sums[block * 3 + 2] * perBlock * gain[2]
    values[block] = 0.299 * red + 0.587 * green + 0.114 * blue
    values[ArtDescriptor.blockCount + block] = red - green
    values[ArtDescriptor.blockCount * 2 + block] = (red + green) / 2 - blue
  }

  // Per channel, centre and scale. Together with the balance above this is what makes
  // exposure stop mattering, and it is the difference between matching a photo of a
  // card and matching a scan of one.
  for channel in 0..<ArtDescriptor.channels {
    let offset = channel * ArtDescriptor.blockCount
    var mean = 0.0
    for i in 0..<ArtDescriptor.blockCount { mean += values[offset + i] }
    mean /= Double(ArtDescriptor.blockCount)

    var variance = 0.0
    for i in 0..<ArtDescriptor.blockCount {
      let centred = values[offset + i] - mean
      variance += centred * centred
    }
    let deviation = (variance / Double(ArtDescriptor.blockCount)).squareRoot()

    let scale = deviation < flatEpsilon ? 0 : 1 / deviation
    for i in 0..<ArtDescriptor.blockCount {
      values[offset + i] = (values[offset + i] - mean) * scale
    }
  }

  return CardDescriptor(vector: quantize(values), bits: gradientBits(values))
}

/**
 Direction only: the magnitude is divided out, then the largest component is pinned to
 127. Cosine similarity is unchanged by both, so the scale factor is never kept.
 */
private func quantize(_ values: [Double]) -> [Int8] {
  var norm = 0.0
  for value in values { norm += value * value }
  norm = norm.squareRoot()

  var quantized = [Int8](repeating: 0, count: ArtDescriptor.dimension)
  guard norm >= flatEpsilon else { return quantized }

  var largest = 0.0
  for value in values { largest = max(largest, abs(value / norm)) }
  guard largest >= flatEpsilon else { return quantized }

  let scale = 127 / (largest * norm)
  for i in 0..<ArtDescriptor.dimension {
    // floor(v + 0.5) rather than a rounding function: Swift rounds halves away from
    // zero and JavaScript rounds them up, and the two must not disagree.
    let rounded = (values[i] * scale + 0.5).rounded(.down)
    quantized[i] = Int8(max(-127, min(127, rounded)))
  }
  return quantized
}

/**
 Sign of the luma difference between each pair of neighbouring blocks. Gradient
 directions survive blur, glare and a dim room far better than the values themselves,
 so these bits are what separates two cards whose colour layout is nearly the same.
 */
private func gradientBits(_ values: [Double]) -> [UInt8] {
  var bits = [UInt8](repeating: 0, count: ArtDescriptor.bitBytes)
  var index = 0
  func write(_ on: Bool) {
    if on { bits[index >> 3] |= UInt8(1 << (7 - (index & 7))) }
    index += 1
  }

  for row in 0..<ArtDescriptor.gridRows {
    for column in 0..<(ArtDescriptor.gridColumns - 1) {
      let at = row * ArtDescriptor.gridColumns + column
      write(values[at] < values[at + 1])
    }
  }
  for row in 0..<(ArtDescriptor.gridRows - 1) {
    for column in 0..<ArtDescriptor.gridColumns {
      let at = row * ArtDescriptor.gridColumns + column
      write(values[at] < values[at + ArtDescriptor.gridColumns])
    }
  }
  return bits
}

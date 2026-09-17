import AppKit
import CoreImage
import Vision

@main
struct FooterRecognitionTests {
  static func main() throws {
    var plan = FooterScanPlan()
    precondition(plan.quarterTurns(landscape: false) == 0 && !plan.enhance)
    plan.record(foundCode: false, quarterTurns: 0, landscape: false)
    precondition(plan.enhance && plan.useDocumentSegmentation && plan.quarterTurns(landscape: false) == 0)
    plan.record(foundCode: false, quarterTurns: 0, landscape: false)
    precondition(!plan.useDocumentSegmentation && plan.quarterTurns(landscape: false) == 2)
    plan.record(foundCode: true, quarterTurns: 2, landscape: false)
    precondition(plan.quarterTurns(landscape: false) == 2 && plan.enhance)
    precondition(FooterScanPlan().quarterTurns(landscape: true) == 1)

    // A valid-looking code in the middle must never escape the physical footer crop.
    let image = fixture()
    let lines = try readCollectorFooter(in: image, enhance: false)
    let text = lines.joined().joined(separator: " ")
    precondition(text.contains("014/024"), "Missing footer: \(text)")
    precondition(!text.contains("006/024"), "Middle text entered recognition: \(text)")
    precondition(containsCollectorNumber(lines))

    let dim = image.applyingFilter("CIExposureAdjust", parameters: [kCIInputEVKey: -1.5])
    let recovered = try readCollectorFooter(in: dim, enhance: true)
    precondition(recovered.joined().contains { $0.contains("014/024") }, "Dim footer unreadable: \(recovered)")
    precondition(!containsCollectorNumber([["LUX", "CROWNGUARD", "Use only to play spells."]]))
    print("Footer recognition: real Vision OCR, body exclusion, dim crop and recovery scheduling passed")
  }

  static func fixture() -> CIImage {
    let context = CGContext(data: nil, width: 1200, height: 1680, bitsPerComponent: 8,
      bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(),
      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    context.setFillColor(NSColor.white.cgColor)
    context.fill(CGRect(x: 0, y: 0, width: 1200, height: 1680))
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(cgContext: context, flipped: false)
    let attributes: [NSAttributedString.Key: Any] = [
      .font: NSFont.monospacedSystemFont(ofSize: 36, weight: .regular),
      .foregroundColor: NSColor.black,
    ]
    ("OGS 014/024" as NSString).draw(at: NSPoint(x: 80, y: 70), withAttributes: attributes)
    ("OGS 006/024" as NSString).draw(at: NSPoint(x: 80, y: 800), withAttributes: attributes)
    ("LUX CROWNGUARD" as NSString).draw(at: NSPoint(x: 80, y: 1100), withAttributes: attributes)
    NSGraphicsContext.restoreGraphicsState()
    return CIImage(cgImage: context.makeImage()!)
  }
}

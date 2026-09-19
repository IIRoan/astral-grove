import CoreImage
import Foundation

@main
struct ImageProcessingTests {
  static func main() {
    precondition(exposureLift(forLuminance: nil) == 0)
    precondition(exposureLift(forLuminance: 0) == 0)
    precondition(exposureLift(forLuminance: 0.3) == 0, "Lit crops are left alone")
    precondition(exposureLift(forLuminance: 0.45) == 0)
    let dim = exposureLift(forLuminance: 0.2)
    precondition(dim > 1.1 && dim < 1.3, "log2(0.45 / 0.2) is about 1.17, got \(dim)")
    precondition(exposureLift(forLuminance: 0.01) == 2, "Capped at two stops")

    // Declared in sRGB so the measurement, also in sRGB, comes back as the same number.
    guard let sRGB = CGColorSpace(name: CGColorSpace.sRGB),
      let colour = CIColor(red: 0.2, green: 0.2, blue: 0.2, alpha: 1, colorSpace: sRGB)
    else { preconditionFailure("No sRGB") }
    let grey = CIImage(color: colour).cropped(to: CGRect(x: 0, y: 0, width: 64, height: 64))
    guard let luminance = meanLuminance(of: grey) else { preconditionFailure("No luminance") }
    precondition(abs(luminance - 0.2) < 0.05, "Flat 20% grey measured \(luminance)")
    precondition(meanLuminance(of: CIImage(color: .black)) == nil, "Infinite extent has no mean")

    guard let lifted = meanLuminance(of: liftedExposure(grey, by: 1)) else {
      preconditionFailure("No lifted luminance")
    }
    precondition(lifted > luminance + 0.05, "One stop up measured \(lifted) from \(luminance)")
    precondition(liftedExposure(grey, by: 0) === grey, "Zero stops leaves the image untouched")
    print("CardImageProcessing: luminance measurement and exposure lift passed")
  }
}

import ExpoModulesCore
import UIKit
import Vision

/**
 * Text recognition tuned for reading a trading card, rather than prose.
 *
 * Two things the off-the-shelf wrappers get wrong for this job. They construct a bare
 * `VNRecognizeTextRequest`, so language correction stays on — and a collector code like
 * `OGN • 179/298` is a serial number, not a word. And they return `topCandidates(1)`,
 * throwing away the ranked alternatives, when for small print the correct reading is
 * often Vision's second or third guess.
 *
 * It also takes the image as a shared reference rather than a file path, so a capture
 * can go camera → crop → recognize without ever being encoded, written, re-read and
 * decoded in between.
 */

/**
 Vision on a shared serial queue would block every other module's async work for the
 length of a recognition pass, which is very visible during a continuous scan.
 */
private let ocrQueue = DispatchQueue(label: "com.iroan.astralgrove.cardocr", qos: .userInitiated)

struct RecognizeOptions: Record {
  /** `fast` for a quick look, `accurate` for small print. */
  @Field var recognitionLevel: String = "accurate"
  /** Off by default: collector codes are serial numbers, and correction fights them. */
  @Field var usesLanguageCorrection: Bool = false
  @Field var languages: [String] = ["en-US"]
  /**
   Ignore text shorter than this fraction of image height. Left at Vision's default
   until there are real numbers from a device to tune against — raising it skips noise
   and speeds the pass up, at the risk of dropping a card held further away.
   */
  @Field var minimumTextHeight: Double = 0
  /** How many ranked readings to return per line. */
  @Field var maxCandidates: Int = 3
}

internal final class MissingBitmapException: Exception {
  override var reason: String {
    "The image has no bitmap to recognize text in"
  }
}

/** Vision reads the raw bitmap, so an image carrying orientation must declare it. */
private func cgOrientation(from orientation: UIImage.Orientation) -> CGImagePropertyOrientation {
  switch orientation {
  case .up: return .up
  case .down: return .down
  case .left: return .left
  case .right: return .right
  case .upMirrored: return .upMirrored
  case .downMirrored: return .downMirrored
  case .leftMirrored: return .leftMirrored
  case .rightMirrored: return .rightMirrored
  @unknown default: return .up
  }
}

public class CardOcrModule: Module {
  public func definition() -> ModuleDefinition {
    Name("CardOcr")

    Constants([
      "isSupported": true
    ])

    /**
     Returns one entry per recognized line: Vision's ranked readings, best first.

     `image` is any shared image reference — a `PictureRef` straight from the camera or
     an `ImageRef` out of the manipulator both qualify.
     */
    AsyncFunction("recognize") { (image: SharedRef<UIImage>, options: RecognizeOptions) -> [[String]] in
      // A scan session runs this back to back; without the pool the peak holds every
      // intermediate bitmap until the run loop drains.
      try autoreleasepool {
        let uiImage = image.ref
        guard let cgImage = uiImage.cgImage else {
          throw MissingBitmapException()
        }

        let request = VNRecognizeTextRequest()
        request.recognitionLevel = options.recognitionLevel == "fast" ? .fast : .accurate
        request.usesLanguageCorrection = options.usesLanguageCorrection
        request.recognitionLanguages = options.languages
        if options.minimumTextHeight > 0 {
          request.minimumTextHeight = Float(options.minimumTextHeight)
        }

        let handler = VNImageRequestHandler(
          cgImage: cgImage,
          orientation: cgOrientation(from: uiImage.imageOrientation),
          options: [:]
        )
        try handler.perform([request])

        // `VNRequest.results` is `[VNObservation]?`, so it has to be narrowed before
        // `topCandidates` is available.
        let observations = (request.results as? [VNRecognizedTextObservation]) ?? []
        let maxCandidates = max(1, options.maxCandidates)
        return observations.map { observation in
          observation.topCandidates(maxCandidates).map { $0.string }
        }
      }
    }
    .runOnQueue(ocrQueue)
  }
}

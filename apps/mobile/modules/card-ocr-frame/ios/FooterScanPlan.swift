import Foundation

// Recovery is spread across frames so a bad scan never triggers an unbounded chain of requests.
struct FooterScanPlan {
  private var misses = 0
  private var reads = 0
  private var preferredTurn = 0

  var enhance: Bool { reads % 2 == 1 }
  var useDocumentSegmentation: Bool { misses % 4 == 1 }

  func quarterTurns(landscape: Bool) -> Int {
    let base = landscape ? 1 : 0
    return (base + preferredTurn + (misses / 2 % 2) * 2) % 4
  }

  mutating func record(foundCode: Bool, quarterTurns: Int, landscape: Bool) {
    reads += 1
    if foundCode {
      preferredTurn = (quarterTurns - (landscape ? 1 : 0) + 4) % 4
      misses = 0
    } else {
      misses += 1
    }
  }
}

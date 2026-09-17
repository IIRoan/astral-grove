import Foundation

enum TestFailure: Error { case vision }

@main
struct ScanWorkerTests {
  static func main() throws {
    let queue = DispatchQueue(label: "scan-worker-test")
    let worker = ScanWorker<Int>(queue: queue)
    let started = DispatchSemaphore(value: 0)
    let finish = DispatchSemaphore(value: 0)

    let submitted = try worker.poll {
      started.signal()
      precondition(finish.wait(timeout: .now() + 5) == .success)
      return 42
    }
    precondition(submitted == nil)
    precondition(started.wait(timeout: .now() + 5) == .success)
    let skipped = try worker.poll { preconditionFailure("Busy worker queued another frame") }
    precondition(skipped == nil)
    finish.signal()
    queue.sync {}
    let result = try worker.poll { preconditionFailure("Result delivery started another scan") }
    precondition(result == 42)

    _ = try worker.poll { throw TestFailure.vision }
    queue.sync {}
    do {
      _ = try worker.poll { 0 }
      preconditionFailure("Vision error was lost")
    } catch TestFailure.vision {}
    _ = try worker.poll { 7 }
    queue.sync {}
    let recovered = try worker.poll { 0 }
    precondition(recovered == 7)

    _ = try worker.poll {
      started.signal()
      precondition(finish.wait(timeout: .now() + 5) == .success)
      return 99
    }
    precondition(started.wait(timeout: .now() + 5) == .success)
    worker.reset()
    let stillBusy = try worker.poll { preconditionFailure("Reset allowed overlapping work") }
    precondition(stillBusy == nil)
    finish.signal()
    queue.sync {}
    let discarded = try worker.poll { 8 }
    precondition(discarded == nil)
    queue.sync {}
    let next = try worker.poll { 0 }
    precondition(next == 8)

    _ = try worker.poll { 100 }
    queue.sync {}
    worker.reset()
    let cleared = try worker.poll { 9 }
    precondition(cleared == nil)
    queue.sync {}
    let fresh = try worker.poll { 0 }
    precondition(fresh == 9)
    print("ScanWorker: nonblocking delivery, bounded work, error recovery and reset passed")
  }
}

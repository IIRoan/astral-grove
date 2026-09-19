import Foundation

// One retained frame and one completed result; camera delivery never waits for Vision.
final class ScanWorker<Output> {
  private let queue: DispatchQueue
  private let lock = NSLock()
  private var busy = false
  private var generation = 0
  private var completed: Result<Output, Error>?

  init(queue: DispatchQueue = DispatchQueue(label: "card-recognition", qos: .userInitiated)) {
    self.queue = queue
  }

  func reset() {
    lock.lock()
    generation += 1
    completed = nil
    lock.unlock()
  }

  func poll(_ operation: @escaping () throws -> Output) throws -> Output? {
    lock.lock()
    if let result = completed {
      completed = nil
      lock.unlock()
      return try result.get()
    }
    guard !busy else {
      lock.unlock()
      return nil
    }
    busy = true
    let submittedGeneration = generation
    lock.unlock()

    queue.async {
      let result = Result(catching: operation)
      self.lock.lock()
      if self.generation == submittedGeneration { self.completed = result }
      self.busy = false
      self.lock.unlock()
    }
    return nil
  }
}

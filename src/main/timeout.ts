/** Resolves when `task` settles (success or failure), or after `ms` at the latest: never blocks a shutdown. */
export function settleWithin(task: Promise<unknown>, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    const done = () => {
      clearTimeout(timer)
      resolve()
    }
    task.then(done, done)
  })
}

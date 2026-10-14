import type { TaskProgress } from '@core/api'
import { useEffect, useState } from 'react'

/** Last step reported by the main process for `task`, as long as `active` is true. */
export function useTaskProgress(task: TaskProgress['task'], active: boolean): TaskProgress | null {
  const [progress, setProgress] = useState<TaskProgress | null>(null)

  useEffect(() => {
    if (!active) {
      setProgress(null)
      return
    }
    return window.api.onTaskProgress((p) => {
      if (p.task === task) setProgress(p)
    })
  }, [task, active])

  return progress
}

/** Seconds elapsed since `active` became true (0 when inactive). */
export function useElapsedSeconds(active: boolean): number {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    if (!active) {
      setSeconds(0)
      return
    }
    const start = Date.now()
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [active])

  return seconds
}

export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}

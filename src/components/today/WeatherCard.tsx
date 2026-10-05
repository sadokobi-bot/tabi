import { useEffect, useState } from 'react'
import { Droplets } from 'lucide-react'
import type { LatLng } from '@/data/types'
import { describeWeather, fetchWeather, type Weather } from '@/lib/weather'

interface WeatherCardProps {
  location: LatLng
  placeName: string
}

export function WeatherCard({ location, placeName }: WeatherCardProps) {
  const [weather, setWeather] = useState<Weather | null>(null)
  const [failed, setFailed] = useState(false)
  const { lat, lng } = location

  useEffect(() => {
    const controller = new AbortController()
    setFailed(false)
    const load = () =>
      fetchWeather({ lat, lng }, controller.signal).then(setWeather, () => {
        if (!controller.signal.aborted) setFailed(true)
      })
    void load()
    const timer = setInterval(load, 30 * 60_000)
    return () => {
      controller.abort()
      clearInterval(timer)
    }
  }, [lat, lng])

  if (!weather) {
    return (
      <div className="surface flex min-h-32 flex-col justify-between rounded-3xl p-4">
        <p className="text-xs font-medium text-muted">מזג האוויר · {placeName}</p>
        {failed ? (
          <p className="text-sm text-muted">אין נתונים כרגע</p>
        ) : (
          <div aria-hidden className="h-9 w-24 animate-pulse rounded-xl bg-fg/8" />
        )}
      </div>
    )
  }

  const { label, icon: Icon } = describeWeather(weather.code, weather.isDay)
  return (
    <div className="surface flex min-h-32 flex-col justify-between rounded-3xl p-4">
      <p className="truncate text-xs font-medium text-muted">מזג האוויר · {placeName}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[2.1rem] leading-none font-bold tabular-nums tracking-tight" dir="ltr">
          {Math.round(weather.temperature)}°
        </span>
        <Icon aria-hidden className="size-9 text-amber-500" strokeWidth={1.8} />
      </div>
      <p className="mt-2 text-xs text-muted">
        {label} · <span dir="ltr">{Math.round(weather.max)}° / {Math.round(weather.min)}°</span>
        {weather.rainChance != null && weather.rainChance > 0 && (
          <span className="ms-1 inline-flex items-center gap-0.5">
            <Droplets aria-hidden className="size-3" />
            {weather.rainChance}%
          </span>
        )}
      </p>
    </div>
  )
}

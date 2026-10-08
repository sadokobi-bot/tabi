import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
  type LucideIcon,
} from 'lucide-react'
import type { LatLng } from '@/data/types'
import { TRIP_TZ } from './dates'

export interface Weather {
  temperature: number
  apparent: number
  code: number
  isDay: boolean
  max: number
  min: number
  rainChance: number | null
}

const CACHE_TTL_MS = 20 * 60_000
const cache = new Map<string, { at: number; data: Weather }>()

/** Current conditions + today's range from Open-Meteo (free, no API key). */
export async function fetchWeather(location: LatLng, signal?: AbortSignal): Promise<Weather> {
  const key = `${location.lat.toFixed(2)},${location.lng.toFixed(2)}`
  const cached = cache.get(key)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data

  const params = new URLSearchParams({
    latitude: location.lat.toFixed(4),
    longitude: location.lng.toFixed(4),
    current: 'temperature_2m,apparent_temperature,weather_code,is_day',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone: TRIP_TZ,
    forecast_days: '1',
  })
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal })
  if (!response.ok) throw new Error(`Open-Meteo ${response.status}`)
  const json = (await response.json()) as {
    current: { temperature_2m: number; apparent_temperature: number; weather_code: number; is_day: number }
    daily: { temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_probability_max?: (number | null)[] }
  }

  const data: Weather = {
    temperature: json.current.temperature_2m,
    apparent: json.current.apparent_temperature,
    code: json.current.weather_code,
    isDay: json.current.is_day === 1,
    max: json.daily.temperature_2m_max[0] ?? json.current.temperature_2m,
    min: json.daily.temperature_2m_min[0] ?? json.current.temperature_2m,
    rainChance: json.daily.precipitation_probability_max?.[0] ?? null,
  }
  cache.set(key, { at: Date.now(), data })
  return data
}

/** WMO weather code → Hebrew label + icon. */
export function describeWeather(code: number, isDay: boolean): { label: string; icon: LucideIcon } {
  if (code === 0) return { label: 'בהיר', icon: isDay ? Sun : Moon }
  if (code <= 2) return { label: 'מעונן חלקית', icon: isDay ? CloudSun : CloudMoon }
  if (code === 3) return { label: 'מעונן', icon: Cloud }
  if (code === 45 || code === 48) return { label: 'ערפל', icon: CloudFog }
  if (code >= 51 && code <= 57) return { label: 'טפטוף', icon: CloudDrizzle }
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { label: 'גשם', icon: CloudRain }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { label: 'שלג', icon: CloudSnow }
  if (code >= 95) return { label: 'סופת רעמים', icon: CloudLightning }
  return { label: 'משתנה', icon: CloudSun }
}

export interface DayForecast {
  max: number
  min: number
  /** "HH:mm" in Japan. */
  sunrise: string
  sunset: string
  /** 24 hourly values (index = hour of day, Japan time). */
  rainChance: (number | null)[]
  temperature: number[]
}

const forecastCache = new Map<string, { at: number; data: DayForecast | null }>()

/**
 * Hour-by-hour forecast for one day (YYYY-MM-DD, Japan calendar). Open-Meteo forecasts ~16 days
 * ahead; further out (or offline) this resolves to null.
 */
export async function fetchDayForecast(location: LatLng, date: string, signal?: AbortSignal): Promise<DayForecast | null> {
  const key = `${location.lat.toFixed(2)},${location.lng.toFixed(2)}:${date}`
  const cached = forecastCache.get(key)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data

  const params = new URLSearchParams({
    latitude: location.lat.toFixed(4),
    longitude: location.lng.toFixed(4),
    hourly: 'precipitation_probability,temperature_2m',
    daily: 'temperature_2m_max,temperature_2m_min,sunrise,sunset',
    timezone: TRIP_TZ,
    start_date: date,
    end_date: date,
  })
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal })
  if (response.status === 400) {
    forecastCache.set(key, { at: Date.now(), data: null }) // beyond the forecast range
    return null
  }
  if (!response.ok) throw new Error(`Open-Meteo ${response.status}`)
  const json = (await response.json()) as {
    hourly: { precipitation_probability: (number | null)[]; temperature_2m: number[] }
    daily: { temperature_2m_max: number[]; temperature_2m_min: number[]; sunrise: string[]; sunset: string[] }
  }
  const data: DayForecast = {
    max: json.daily.temperature_2m_max[0] ?? 0,
    min: json.daily.temperature_2m_min[0] ?? 0,
    // Local ISO timestamps ("2026-10-12T05:47"): the time is the part after the T.
    sunrise: json.daily.sunrise[0]?.slice(11, 16) ?? '',
    sunset: json.daily.sunset[0]?.slice(11, 16) ?? '',
    rainChance: json.hourly.precipitation_probability.slice(0, 24),
    temperature: json.hourly.temperature_2m.slice(0, 24),
  }
  forecastCache.set(key, { at: Date.now(), data })
  return data
}

/** Hours (in [from, to)) with a rain chance of at least `threshold`, merged into ranges like [13, 16]. */
export function rainWindows(forecast: DayForecast, from = 7, to = 23, threshold = 50): [number, number][] {
  const windows: [number, number][] = []
  for (let hour = from; hour < to; hour++) {
    if ((forecast.rainChance[hour] ?? 0) < threshold) continue
    const last = windows[windows.length - 1]
    if (last && last[1] === hour) last[1] = hour + 1
    else windows.push([hour, hour + 1])
  }
  return windows
}

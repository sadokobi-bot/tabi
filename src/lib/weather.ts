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

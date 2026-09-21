import { fetch } from "@pocketjs/framework/net";
import { CONFIG } from "./config.ts";

export interface WeatherData {
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  description: string;
  icon: string;
  pressure: number;
  visibility: number;
  sunrise: number;
  sunset: number;
  updatedAt: number;
}

interface OpenMeteoResponse {
  current: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    weather_code: number;
    wind_speed_10m: number;
    surface_pressure: number;
  };
  daily: {
    sunrise: string[];
    sunset: string[];
  };
}

const WEATHER_ICONS: Record<string, string> = {
  "01d": "☀",
  "01n": "🌙",
  "02d": "⛅",
  "02n": "☁",
  "03d": "☁",
  "03n": "☁",
  "04d": "☁",
  "04n": "☁",
  "09d": "🌧",
  "09n": "🌧",
  "10d": "🌦",
  "10n": "🌧",
  "11d": "⛈",
  "11n": "⛈",
  "13d": "❄",
  "13n": "❄",
  "50d": "🌫",
  "50n": "🌫",
};

const WMO_DESCRIPTIONS: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snow",
  73: "Moderate snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

function wmoToOpenWeatherIcon(code: number, isDay: boolean): string {
  const day = isDay ? "d" : "n";
  if (code === 0) return `01${day}`;
  if (code === 1 || code === 2) return isDay ? "02d" : "02n";
  if (code === 3) return `04${day}`;
  if (code === 45 || code === 48) return `50${day}`;
  if (code >= 51 && code <= 57) return `09${day}`;
  if (code >= 61 && code <= 67) return isDay ? "10d" : "10n";
  if (code >= 71 && code <= 77) return `13${day}`;
  if (code >= 80 && code <= 82) return `09${day}`;
  if (code >= 85 && code <= 86) return `13${day}`;
  if (code >= 95) return `11${day}`;
  return `03${day}`;
}

function isDaytime(nowMs: number, sunriseMs: number, sunsetMs: number): boolean {
  return nowMs >= sunriseMs && nowMs < sunsetMs;
}

export function weatherIcon(iconCode: string): string {
  return WEATHER_ICONS[iconCode] ?? "☁";
}

export async function fetchWeather(): Promise<WeatherData | null> {
  const { latitude, longitude } = CONFIG.location;
  const { units } = CONFIG.weather;
  const tempUnit = units === "metric" ? "celsius" : "fahrenheit";
  const windUnit = units === "metric" ? "kmh" : "mph";

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${latitude}&longitude=${longitude}` +
      `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,surface_pressure` +
      `&daily=sunrise,sunset` +
      `&temperature_unit=${tempUnit}` +
      `&wind_speed_unit=${windUnit}` +
      `&timezone=auto` +
      `&forecast_days=1`;

    const res = await fetch(url, { timeoutMs: 10_000, maxBytes: 32 * 1024 });

    if (!res.ok) return null;

    const data = (await res.json()) as OpenMeteoResponse;
    const { current, daily } = data;

    const sunrise = Date.parse(daily.sunrise[0] ?? "");
    const sunset = Date.parse(daily.sunset[0] ?? "");
    const now = Date.now();
    const code = current.weather_code;
    const day = isDaytime(now, sunrise, sunset);

    return {
      temperature: Math.round(current.temperature_2m),
      feelsLike: Math.round(current.apparent_temperature),
      humidity: current.relative_humidity_2m,
      windSpeed: Math.round(current.wind_speed_10m * 10) / 10,
      description: WMO_DESCRIPTIONS[code] ?? "Unknown",
      icon: wmoToOpenWeatherIcon(code, day),
      pressure: Math.round(current.surface_pressure),
      visibility: 0,
      sunrise,
      sunset,
      updatedAt: now,
    };
  } catch {
    return null;
  }
}

export function mockWeatherData(): WeatherData {
  return {
    temperature: 22,
    feelsLike: 21,
    humidity: 65,
    windSpeed: 12.5,
    description: "Partly cloudy",
    icon: "02d",
    pressure: 1013,
    visibility: 10,
    sunrise: Date.now() - 6 * 3600_000,
    sunset: Date.now() + 6 * 3600_000,
    updatedAt: Date.now(),
  };
}

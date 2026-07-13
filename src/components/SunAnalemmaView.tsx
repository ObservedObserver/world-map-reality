import { useMemo, useState } from 'react'
import { CalendarDays, Clock3, MapPin, Sun } from 'lucide-react'
import type { CountryFeature, LonLat } from '../types'
import {
  buildAnalemma,
  formatUtcTime,
  getSolarMetrics,
} from '../utils/sunAnalemma'
import { AnalemmaChart } from './AnalemmaChart'
import { ObserverMap } from './ObserverMap'

type SunAnalemmaViewProps = {
  worldFeatures: CountryFeature[]
  loading: boolean
  error: string | null
}

const LOCATIONS = [
  { name: 'Greenwich', coordinates: [-0.0015, 51.4779] as LonLat, minutesUtc: 720 },
  { name: 'New York', coordinates: [-74.006, 40.7128] as LonLat, minutesUtc: 1020 },
  { name: 'Tokyo', coordinates: [139.6917, 35.6895] as LonLat, minutesUtc: 180 },
  { name: 'Singapore', coordinates: [103.8198, 1.3521] as LonLat, minutesUtc: 300 },
  { name: 'Sydney', coordinates: [151.2093, -33.8688] as LonLat, minutesUtc: 120 },
  { name: 'Reykjavik', coordinates: [-21.9426, 64.1466] as LonLat, minutesUtc: 840 },
] as const

const SAMPLE_OPTIONS = [
  { label: 'Every day', step: 1 },
  { label: 'Weekly', step: 7 },
  { label: 'Monthly', step: 30 },
] as const

export default function SunAnalemmaView({
  worldFeatures,
  loading,
  error,
}: SunAnalemmaViewProps) {
  const [location, setLocation] = useState<LonLat>(LOCATIONS[0].coordinates)
  const [locationName, setLocationName] = useState('Greenwich')
  const [minutesUtc, setMinutesUtc] = useState(720)
  const [selectedDay, setSelectedDay] = useState(171)
  const [sampleStep, setSampleStep] = useState(1)

  const selectedPoints = useMemo(
    () => buildAnalemma(location[0], location[1], minutesUtc, 1),
    [location, minutesUtc]
  )
  const backgroundTracks = useMemo(() => {
    const tracks = []
    for (let hour = 0; hour < 24; hour += 1) {
      if (hour * 60 === Math.floor(minutesUtc / 60) * 60) continue
      tracks.push(buildAnalemma(location[0], location[1], hour * 60, 7))
    }
    return tracks
  }, [location, minutesUtc])
  const selectedPosition = selectedPoints[selectedDay]
  const solarMetrics = useMemo(
    () => getSolarMetrics(selectedDay, location[1]),
    [selectedDay, location]
  )
  const selectedDate = selectedPosition.date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })

  const setObserverLocation = (nextLocation: LonLat, name = 'Custom point') => {
    setLocation(nextLocation)
    setLocationName(name)
  }

  return (
    <main className="analemma-layout">
      <section className="analemma-workbench" aria-labelledby="analemma-workbench-title">
        <div className="analemma-workbench-header">
          <div>
            <p className="analemma-overline">A year of sunlight in one curve</p>
            <h2 id="analemma-workbench-title">Trace the Sun at the same clock time, every day</h2>
          </div>
          <div className="analemma-live-readout">
            <Sun size={18} aria-hidden="true" />
            <span>{selectedPosition.altitudeDeg >= 0 ? `${selectedPosition.altitudeDeg.toFixed(1)}\u00b0 above horizon` : `${Math.abs(selectedPosition.altitudeDeg).toFixed(1)}\u00b0 below horizon`}</span>
          </div>
        </div>

        <div className="analemma-controls">
          <div className="analemma-control analemma-time-control">
            <label htmlFor="analemma-time">
              <span><Clock3 size={15} /> Observation time</span>
              <strong>{formatUtcTime(minutesUtc)}</strong>
            </label>
            <input
              id="analemma-time"
              type="range"
              min="0"
              max="1435"
              step="5"
              value={minutesUtc}
              onChange={(event) => setMinutesUtc(Number(event.target.value))}
            />
            <div className="analemma-slider-scale"><span>00:00</span><span>12:00</span><span>23:55 UTC</span></div>
          </div>

          <div className="analemma-control analemma-date-control">
            <label htmlFor="analemma-date">
              <span><CalendarDays size={15} /> Inspect a date</span>
              <strong>{selectedDate}</strong>
            </label>
            <input
              id="analemma-date"
              type="range"
              min="0"
              max="364"
              value={selectedDay}
              onChange={(event) => setSelectedDay(Number(event.target.value))}
            />
            <div className="analemma-slider-scale"><span>Jan</span><span>Jul</span><span>Dec</span></div>
          </div>

          <fieldset className="analemma-control analemma-sample-control">
            <legend>Plot points</legend>
            <div className="analemma-segmented-control">
              {SAMPLE_OPTIONS.map((option) => (
                <button
                  key={option.step}
                  type="button"
                  className={sampleStep === option.step ? 'is-active' : ''}
                  aria-pressed={sampleStep === option.step}
                  onClick={() => setSampleStep(option.step)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <AnalemmaChart
          selectedPoints={selectedPoints}
          backgroundTracks={backgroundTracks}
          latitude={location[1]}
          selectedDay={selectedDay}
          sampleStep={sampleStep}
          onSelectDay={setSelectedDay}
        />

        <div className="analemma-stat-grid" aria-label={`Solar details for ${selectedDate}`}>
          <div className="analemma-stat">
            <span>Solar altitude</span>
            <strong>{selectedPosition.altitudeDeg.toFixed(1)}°</strong>
            <small>{selectedPosition.altitudeDeg >= 0 ? 'above the horizon' : 'below the horizon'}</small>
          </div>
          <div className="analemma-stat">
            <span>Compass azimuth</span>
            <strong>{selectedPosition.azimuthDeg.toFixed(1)}°</strong>
            <small>clockwise from north</small>
          </div>
          <div className="analemma-stat">
            <span>Equation of time</span>
            <strong>{solarMetrics.equationOfTime >= 0 ? '+' : ''}{solarMetrics.equationOfTime.toFixed(1)} min</strong>
            <small>apparent vs mean solar time</small>
          </div>
          <div className="analemma-stat">
            <span>Daylight length</span>
            <strong>{solarMetrics.daylightHours.toFixed(1)} h</strong>
            <small>at {locationName}</small>
          </div>
        </div>
      </section>

      <section className="analemma-location-section" aria-labelledby="analemma-location-title">
        <div className="analemma-location-copy">
          <p className="analemma-overline">Move the observer</p>
          <h2 id="analemma-location-title">See how latitude reshapes the figure eight</h2>
          <p>
            The same date and UTC time produce a different path from every point on Earth. Try the equator, cross a polar circle, or compare both hemispheres.
          </p>
          <div className="analemma-city-presets" aria-label="Observer location presets">
            {LOCATIONS.map((preset) => (
              <button
                type="button"
                key={preset.name}
                className={locationName === preset.name ? 'is-active' : ''}
                onClick={() => {
                  setObserverLocation(preset.coordinates, preset.name)
                  setMinutesUtc(preset.minutesUtc)
                }}
              >
                <MapPin size={14} aria-hidden="true" />
                {preset.name}
              </button>
            ))}
          </div>
        </div>
        <ObserverMap
          worldFeatures={worldFeatures}
          loading={loading}
          error={error}
          location={location}
          onLocationChange={(nextLocation) => setObserverLocation(nextLocation)}
        />
      </section>

      <p className="analemma-method-note">
        Positions use a compact implementation of Jean Meeus&apos;s astronomical solar-position formulas. Times are fixed in UTC so daylight-saving changes do not bend the annual curve.
      </p>
    </main>
  )
}

// Rendered inside the map frame while the world data is loading. It must stay
// free of effects and fetched data: the SSG prerender captures this exact
// markup, so it is what crawlers see as the page's primary content.
const PREVIEW_ROWS = [
  { name: 'Greenland', area: '2,166,086 km²', latitude: '72°N', mercator: '≈ 10.5× true size' },
  { name: 'Russia', area: '17,098,246 km²', latitude: '60°N', mercator: '≈ 4× true size' },
  { name: 'Canada', area: '9,984,670 km²', latitude: '60°N', mercator: '≈ 4× true size' },
  { name: 'United States', area: '9,833,517 km²', latitude: '38°N', mercator: '≈ 1.6× true size' },
  { name: 'Brazil', area: '8,515,767 km²', latitude: '10°S', mercator: '≈ 1.03× true size' },
  { name: 'Australia', area: '7,692,024 km²', latitude: '25°S', mercator: '≈ 1.2× true size' },
  { name: 'India', area: '3,287,263 km²', latitude: '21°N', mercator: '≈ 1.15× true size' },
  { name: 'DR Congo', area: '2,344,858 km²', latitude: '0°', mercator: '≈ true size' },
]

const MapStaticPreview = () => (
  <div className="map-static-preview">
    <p className="map-static-lead">
      On a Mercator projection map, countries far from the equator look much
      larger than they really are. Greenland appears about as large as Africa,
      yet Africa (30.37 million km²) is roughly 14 times bigger than Greenland
      (2.17 million km²). Drag any country toward the equator on this map to
      watch its true scale update in real time.
    </p>
    <table className="map-static-table">
      <caption>True area vs. apparent size on a standard Mercator world map</caption>
      <thead>
        <tr>
          <th scope="col">Country</th>
          <th scope="col">True area</th>
          <th scope="col">Latitude</th>
          <th scope="col">Apparent size on Mercator</th>
        </tr>
      </thead>
      <tbody>
        {PREVIEW_ROWS.map((row) => (
          <tr key={row.name}>
            <td>{row.name}</td>
            <td>{row.area}</td>
            <td>{row.latitude}</td>
            <td>{row.mercator}</td>
          </tr>
        ))}
      </tbody>
    </table>
    <p className="map-static-note">Loading the interactive Mercator map…</p>
  </div>
)

export default MapStaticPreview

import L from 'leaflet'

// leaflet.markercluster oczekuje globalnego L; ten moduł musi zostać zaimportowany przed nim.
if (typeof window !== 'undefined') window.L = L
export default L

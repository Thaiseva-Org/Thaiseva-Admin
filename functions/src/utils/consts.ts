export const apiKey = "AIzaSyDwTBiBiGtJLrlbaiKzVN5BBCj8He1l5Zc";
export const mapNearbySearchUrl = ({
  lat,
  lng,
}: {
  lat: string;
  lng: string;
}) =>
  `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${1000}&type=shopping_mall&key=${apiKey}`;

/** Transient matching ONLY. Never persist Google Places names/addresses/coords.
 * We may store Google Place IDs and independently licensed OSM metadata.
 * A business must match uniquely by normalized name AND street/GPS, within
 * an eligible municipality/UF. Provider IDs are intentionally unrelated.
 */
export type VerifiedPlace = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
};

function fold(value: string | null | undefined): string {
  return (value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g," ").trim()
    .replace(/\s+/g," ");
}
function locationAgrees(a: VerifiedPlace,b: VerifiedPlace): boolean {
  if(a.state && b.state && fold(a.state)!==fold(b.state)) return false;
  if(a.city && b.city && fold(a.city)!==fold(b.city)) return false;
  return true;
}
function coordinateDistanceMeters(a:VerifiedPlace,b:VerifiedPlace):number|null {
  const nums=[a.latitude,a.longitude,b.latitude,b.longitude];
  if(!nums.every((v)=>typeof v==="number" && Number.isFinite(v))) return null;
  const [lat1,lon1,lat2,lon2]=nums as number[];
  if(Math.abs(lat1!)>90||Math.abs(lat2!)>90||Math.abs(lon1!)>180||Math.abs(lon2!)>180) return null;
  const r=Math.PI/180,dLat=(lat2!-lat1!)*r,dLon=(lon2!-lon1!)*r;
  const v=Math.sin(dLat/2)**2+Math.cos(lat1!*r)*Math.cos(lat2!*r)*Math.sin(dLon/2)**2;
  return 6371000*2*Math.atan2(Math.sqrt(v),Math.sqrt(Math.max(0,1-v)));
}
export function sameVerifiedBusiness(a:VerifiedPlace,b:VerifiedPlace):boolean {
  if(!fold(a.name)||fold(a.name)!==fold(b.name)||!locationAgrees(a,b)) return false;
  const distance=coordinateDistanceMeters(a,b);
  if(distance!==null&&distance<=80)return true;
  const addressA=fold(a.address),addressB=fold(b.address);
  return Boolean(addressA && addressB && addressA===addressB &&
    a.state && b.state && a.city && b.city);
}

/** Only unique one-to-one matches are eligible for 0 incremental credits.
 * Avoids conflating duplicate branches, names and geocoding uncertainty.
 */
export function uniqueVerifiedAliases(
  current:VerifiedPlace[],previous:VerifiedPlace[],
):Record<string,string> {
  const proposed=new Map<string,string>();
  const targetHitCounts=new Map<string,number>();
  for(const place of current) {
    if(!place.id||place.id.length>255)continue;
    const matches=previous.filter((candidate)=>candidate.id!==place.id &&
      sameVerifiedBusiness(place,candidate));
    if(matches.length!==1)continue;
    const id=matches[0]!.id;
    proposed.set(place.id,id);
    targetHitCounts.set(id,(targetHitCounts.get(id)??0)+1);
  }
  return Object.fromEntries([...proposed.entries()]
    .filter(([,target])=>targetHitCounts.get(target)===1));
}

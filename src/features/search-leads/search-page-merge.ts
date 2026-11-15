/** Pure page merge used by Buscar Leads. Preserve a confirmed or manually
 * reviewed Instagram profile when a later page includes the same place ID
 * with only an unverified directory candidate. This is NOT a provider call. */
import type { BusinessSearchResult } from "./types.ts";

function confirmedInstagram(b:BusinessSearchResult) {
  return Boolean(b.instagram?.trim() &&
    b.instagramConfidence==="high" &&
    !b.instagramNeedsReview);
}
export function mergeSearchPageResults(
  previous:readonly BusinessSearchResult[],
  incoming:readonly BusinessSearchResult[],
):BusinessSearchResult[] {
  const uniqueByPlace = new Map<string,BusinessSearchResult>();
  for(const item of [...previous,...incoming]){
    const old=uniqueByPlace.get(item.placeId);
    if(old && confirmedInstagram(old) && !confirmedInstagram(item)){
      uniqueByPlace.set(item.placeId,{
        ...item,
        instagram:old.instagram,
        instagramConfidence:old.instagramConfidence,
        instagramSource:old.instagramSource,
        instagramUsername:old.instagramUsername,
        instagramDisplayName:old.instagramDisplayName,
        instagramCheckedAt:old.instagramCheckedAt,
        instagramSearchSignature:old.instagramSearchSignature,
        instagramNeedsReview:false,
      });
    }else{
      uniqueByPlace.set(item.placeId,item);
    }
  }
  return [...uniqueByPlace.values()];
}

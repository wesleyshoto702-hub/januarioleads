import { approvedExternalPlacesDailyCap } from "./external-provider-approval.ts";
function assert(value: unknown, message: string): asserts value {
  if (!value) throw Error(message);
}
Deno.test("cost gate defaults to 0 even if the paid provider key exists", () => {
  for (const provider of ["google_places","geoapify"] as const) {
    for (const raw of [undefined,"","0","-1","20.5","no"," 10x","1e3","Infinity","9007199254740993"]) {
      assert(approvedExternalPlacesDailyCap(provider,raw,"true")===0,
        `${provider}: invalid cap must not authorize requests`);
    }
  }
  assert(approvedExternalPlacesDailyCap("google_places","15",undefined)===0,
    "Google needs explicit paid approval");
  assert(approvedExternalPlacesDailyCap("google_places","15","false")===0,
    "Google must deny false approval");
  assert(approvedExternalPlacesDailyCap("google_places","15","TRUE")===0,
    "Approval must be deliberate and exact");
  assert(approvedExternalPlacesDailyCap("google_places","15","true")===15,
    "Explicit approval permits budgeted use");
  assert(approvedExternalPlacesDailyCap("google_places","200","true")===20,
    "Hard cap bounds Google spend");
  assert(approvedExternalPlacesDailyCap("geoapify","50",undefined)===50,
    "A free provider can be explicitly opted in without Google approval");
  assert(approvedExternalPlacesDailyCap("geoapify","900",undefined)===300,
    "Geoapify has conservative hard cap");
});

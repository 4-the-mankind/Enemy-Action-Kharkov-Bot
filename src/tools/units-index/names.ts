// Historical names for the abbreviations used in counter filenames (display only).
// Corps and army names follow the rulebook's order of battle (§1); division names are the
// formations' designations in February-March 1943.

/** Division (German) or tank corps (Soviet, split into brigades A and B), keyed "side:KEY". */
export const DIVISION_NAMES: Record<string, string> = {
  "german:LAH": "1st SS Panzergrenadier Division Leibstandarte SS Adolf Hitler",
  "german:DR": "2nd SS Panzergrenadier Division Das Reich",
  "german:TOT": "3rd SS Panzergrenadier Division Totenkopf",
  "german:WIK": "5th SS Panzergrenadier Division Wiking",
  "german:GD": "Panzergrenadier Division Großdeutschland",
  "german:3P": "3rd Panzer Division",
  "german:6P": "6th Panzer Division",
  "german:7P": "7th Panzer Division",
  "german:11P": "11th Panzer Division",
  "german:17P": "17th Panzer Division",
  "german:19P": "19th Panzer Division",
  "german:23P": "23rd Panzer Division",
  "german:15": "15th Infantry Division",
  "german:57": "57th Infantry Division",
  "german:168": "168th Infantry Division",
  "german:320": "320th Infantry Division",
  "german:333": "333rd Infantry Division",
  "german:335": "335th Infantry Division",
  "german:387": "387th Infantry Division",
  "soviet:12": "12th Tank Corps",
  "soviet:15": "15th Tank Corps",
  "soviet:1G": "1st Guards Tank Corps",
  "soviet:2G": "2nd Guards Tank Corps",
  "soviet:3G": "3rd Guards Tank Corps",
  "soviet:4G": "4th Guards Tank Corps",
};

/** German corps or Soviet army, keyed by the filename token. */
export const CORPS_NAMES: Record<string, string> = {
  IISS: "II SS Panzer Corps",
  XLVIII: "XLVIII Panzer Corps",
  LVII: "LVII Panzer Corps",
  LVIII: "LVII Panzer Corps", // filename typo on the 128.23P front image
  XLCorps: "XL Panzer Corps",
  IIICorps: "III Panzer Corps",
  Raus: "Corps Raus",
  "3rdT": "3rd Tank Army",
  "40th": "40th Army",
  "69th": "69th Army",
  "6th": "6th Army",
  "1stGuards": "1st Guards Army",
  Popov: "Mobile Group Popov",
};

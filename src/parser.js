import { parseStringPromise } from "xml2js";

export async function parseInfoTableXml(xmlText) {
  const parsed = await parseStringPromise(xmlText, { explicitArray: false, ignoreAttrs: true });

  const root = parsed["informationTable"] ||
    parsed[Object.keys(parsed).find((k) => k.includes("informationTable"))];

  if (!root) throw new Error("Could not find informationTable root in XML");

  const entries = root["infoTable"] || root[Object.keys(root).find((k) => k.includes("infoTable"))];
  const arr     = Array.isArray(entries) ? entries : [entries];

  return arr.map((e) => ({
    issuer:      e["nameOfIssuer"]         || "",
    cusip:       e["cusip"]                || "",
    class:       e["titleOfClass"]         || "",
    value_1000s: parseInt(e["value"] || 0),
    shares:      parseInt(e["shrsOrPrnAmt"]?.["sshPrnamt"] || 0),
    investDisc:  e["investmentDiscretion"] || "",
    putCall:     e["putCall"]              || "",
  }));
}

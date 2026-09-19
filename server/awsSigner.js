// awsSigner.js — minimal AWS Signature Version 4 signer + HTTPS request.
// Implemented with Node's built-in `crypto` and `https` so it works on Node 16+
// without the AWS SDK. Supports static keys and temporary (session) credentials.

import crypto from "node:crypto";
import https from "node:https";

const sha256Hex = (data) =>
  crypto.createHash("sha256").update(data, "utf8").digest("hex");

const hmac = (key, data) =>
  crypto.createHmac("sha256", key).update(data, "utf8").digest();

function signingKey(secretKey, dateStamp, region, service) {
  const kDate = hmac("AWS4" + secretKey, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

/**
 * Make a SigV4-signed POST request to an AWS service and return the JSON body.
 *
 * @param {object} opts
 * @param {string} opts.service   e.g. "bedrock"
 * @param {string} opts.region    e.g. "us-east-1"
 * @param {string} opts.host      e.g. "bedrock-runtime.us-east-1.amazonaws.com"
 * @param {string} opts.path      request path (already URL-encoded)
 * @param {object} opts.body      request body object (JSON-serialized)
 * @param {object} opts.credentials { accessKeyId, secretAccessKey, sessionToken? }
 * @returns {Promise<object>} parsed JSON response
 */
export function signedRequest({ service, region, host, path, body, credentials }) {
  const { accessKeyId, secretAccessKey, sessionToken } = credentials;
  const payload = JSON.stringify(body);

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ""); // YYYYMMDDTHHMMSSZ
  const dateStamp = amzDate.slice(0, 8); // YYYYMMDD

  const canonicalHeadersObj = {
    "content-type": "application/json",
    host,
    "x-amz-date": amzDate,
  };
  if (sessionToken) canonicalHeadersObj["x-amz-security-token"] = sessionToken;

  const sortedHeaderKeys = Object.keys(canonicalHeadersObj).sort();
  const canonicalHeaders =
    sortedHeaderKeys.map((k) => `${k}:${canonicalHeadersObj[k]}\n`).join("");
  const signedHeaders = sortedHeaderKeys.join(";");

  const payloadHash = sha256Hex(payload);
  const canonicalRequest = [
    "POST",
    path,
    "", // no query string
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const algorithm = "AWS4-HMAC-SHA256";
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const key = signingKey(secretAccessKey, dateStamp, region, service);
  const signature = crypto.createHmac("sha256", key).update(stringToSign, "utf8").digest("hex");

  const authorization =
    `${algorithm} Credential=${accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const headers = {
    "Content-Type": "application/json",
    "X-Amz-Date": amzDate,
    Authorization: authorization,
    "Content-Length": Buffer.byteLength(payload),
  };
  if (sessionToken) headers["X-Amz-Security-Token"] = sessionToken;

  return new Promise((resolve, reject) => {
    const req = https.request(
      { method: "POST", host, path, headers },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(data || "{}"));
            } catch (e) {
              reject(new Error("Failed to parse AWS response: " + e.message));
            }
          } else {
            reject(
              new Error(`AWS ${service} request failed (${res.statusCode}): ${data.slice(0, 300)}`)
            );
          }
        });
      }
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

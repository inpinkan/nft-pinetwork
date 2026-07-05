export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).json({ ok: true });

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const jwt = process.env.PINATA_JWT;
    if (!jwt) {
      return res.status(500).json({ ok: false, error: "PINATA_JWT is not configured" });
    }

    const body = req.body || {};
    const rawImage = body.image || body.base64;

    if (!rawImage) {
      return res.status(400).json({ ok: false, error: "image is required" });
    }

    const cleanBase64 = String(rawImage).includes(",")
      ? String(rawImage).split(",")[1]
      : String(rawImage);

    const fileName = body.fileName || body.filename || "pnc-image.png";
    const mimeType = body.mimeType || "image/png";

    const buffer = Buffer.from(cleanBase64, "base64");

    const form = new FormData();
    form.append("file", new Blob([buffer], { type: mimeType }), fileName);
    form.append("pinataMetadata", JSON.stringify({ name: fileName }));

    const pinataRes = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}` },
      body: form
    });

    const text = await pinataRes.text();
    let pinataJson;
    try {
      pinataJson = JSON.parse(text);
    } catch {
      return res.status(500).json({
        ok: false,
        error: "Invalid JSON from Pinata",
        raw: text
      });
    }

    if (!pinataRes.ok) {
      return res.status(pinataRes.status).json({
        ok: false,
        error: "Pinata upload failed",
        detail: pinataJson
      });
    }

    const hash = pinataJson.IpfsHash || pinataJson.cid || pinataJson.ipfsHash;

    if (!hash) {
      return res.status(500).json({
        ok: false,
        error: "Pinata response did not include hash",
        detail: pinataJson
      });
    }

    return res.status(200).json({
      ok: true,
      cid: hash,
      IpfsHash: hash,
      ipfsHash: hash,
      uri: `ipfs://${hash}`,
      image: `ipfs://${hash}`,
      imageUri: `ipfs://${hash}`,
      imageIpfsHash: hash,
      raw: pinataJson
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "Server error",
      detail: err?.message || String(err),
      stack: err?.stack || null
    });
  }
}

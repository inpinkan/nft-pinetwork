export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const jwt = process.env.PINATA_JWT;

    if (!jwt) {
      return res.status(500).json({ error: "PINATA_JWT is not configured" });
    }

    const {
      fileName,
      filename,
      mimeType,
      image,
      base64,
      name,
      description,
      collection,
      utilityType,
      utility
    } = req.body || {};

    const rawImage = image || base64;

    if (!rawImage) {
      return res.status(400).json({ error: "image is required" });
    }

    const cleanBase64 = String(rawImage).includes(",")
      ? String(rawImage).split(",")[1]
      : String(rawImage);

    if (!cleanBase64) {
      return res.status(400).json({ error: "base64 image is empty" });
    }

    const safeFileName = fileName || filename || "pnc-image.png";
    const safeMimeType = mimeType || "image/png";

    const imageBuffer = Buffer.from(cleanBase64, "base64");
    const imageBlob = new Blob([imageBuffer], { type: safeMimeType });

    const imageForm = new FormData();
    imageForm.append("file", imageBlob, safeFileName);
    imageForm.append(
      "pinataMetadata",
      JSON.stringify({
        name: safeFileName
      })
    );

    const imageRes = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`
      },
      body: imageForm
    });

    const imageData = await imageRes.json();

    if (!imageRes.ok) {
      return res.status(imageRes.status).json({
        error: "Image upload failed",
        detail: imageData
      });
    }

    const imageUri = `ipfs://${imageData.IpfsHash}`;

    const metadata = {
      name: name || safeFileName,
      description: description || "",
      image: imageUri,
      attributes: [
        { trait_type: "Collection", value: collection || "" },
        { trait_type: "Utility Type", value: utilityType || "General" },
        { trait_type: "Utility", value: utility || "" },
        { trait_type: "Platform", value: "Pi NFT Center" }
      ]
    };

    const metadataBlob = new Blob([JSON.stringify(metadata, null, 2)], {
      type: "application/json"
    });

    const metadataForm = new FormData();
    metadataForm.append("file", metadataBlob, "metadata.json");
    metadataForm.append(
      "pinataMetadata",
      JSON.stringify({
        name: `${metadata.name || "PNC NFT"} metadata.json`
      })
    );

    const metadataRes = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`
      },
      body: metadataForm
    });

    const metadataData = await metadataRes.json();

    if (!metadataRes.ok) {
      return res.status(metadataRes.status).json({
        error: "Metadata upload failed",
        detail: metadataData
      });
    }

    return res.status(200).json({
      ok: true,
      imageIpfsHash: imageData.IpfsHash,
      imageUri,
      metadataIpfsHash: metadataData.IpfsHash,
      metadataUri: `ipfs://${metadataData.IpfsHash}`,
      metadata
    });
  } catch (err) {
    return res.status(500).json({
      error: "Server error",
      detail: String(err)
    });
  }
}

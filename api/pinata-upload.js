export const config = {
  api: {
    bodyParser: false,
  },
};

async function readRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

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

    const contentType = req.headers["content-type"] || "";
    const body = await readRequestBody(req);

    const pinataRes = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": contentType,
      },
      body,
    });

    const data = await pinataRes.json();

    if (!pinataRes.ok) {
      return res.status(pinataRes.status).json({
        error: "Pinata upload failed",
        detail: data,
      });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({
      error: "Server error",
      detail: String(err),
    });
  }
}

import jwt from "jsonwebtoken";
import Client from "../models/Client.js";

// Authenticates a client who opened their private portal link.
// Therapist tokens are rejected here, and client tokens are rejected by authMiddleware.
const clientAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    if (!header.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Please open the link from your email again" });
    }

    const decoded = jwt.verify(header.split(" ")[1], process.env.JWT_SECRET);
    if (decoded.role !== "client" || !decoded.clientId) {
      return res.status(401).json({ message: "Invalid access" });
    }

    const client = await Client.findById(decoded.clientId);
    if (!client) {
      return res.status(401).json({ message: "This link is no longer valid" });
    }

    req.client = client;
    next();
  } catch {
    return res.status(401).json({ message: "Your access has expired. Please open the link from your email again." });
  }
};

export default clientAuth;

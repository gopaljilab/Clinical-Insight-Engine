import { Router } from "express";
import { requireAuth, requireVerified } from "../auth";
import { issueToken } from "../services/auth/tokenValidator";

const authRouter = Router();

authRouter.get("/token", requireAuth, requireVerified, (req, res) => {
  const user = req.session.user;

  if (!user?.id || !user?.email) {
    return res.status(401).json({ message: "Invalid session user data" });
  }

  const token = issueToken((user).id, user.email, "provider");
  res.json({ token });
});

export default authRouter;

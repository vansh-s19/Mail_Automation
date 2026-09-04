import { Router } from "express";
import { prisma } from "@mail-automation/db";
import { asyncHandler } from "../middleware/asyncHandler";
import { verifyUnsubscribeToken } from "@mail-automation/shared";

const router = Router();

function page(title: string, message: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:-apple-system,sans-serif;max-width:480px;margin:80px auto;padding:0 20px;color:#1e2559;text-align:center}
h1{font-size:20px}p{color:#64748b;font-size:14px}</style></head>
<body><h1>${title}</h1><p>${message}</p></body></html>`;
}

// No auth - this is the link recipients click from their inbox.
router.get("/unsubscribe", asyncHandler(async (req, res) => {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  const contactId = verifyUnsubscribeToken(token);

  if (!contactId) {
    return res.status(400).send(page("Invalid link", "This unsubscribe link is invalid or malformed."));
  }

  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) {
    return res.status(404).send(page("Not found", "We couldn't find this contact."));
  }

  await prisma.$transaction([
    prisma.suppressionList.upsert({
      where: { email: contact.email },
      update: {},
      create: { email: contact.email, reason: "unsubscribed" },
    }),
    prisma.contact.update({ where: { id: contact.id }, data: { isSuppressed: true } }),
  ]);

  res.send(page("You're unsubscribed", `${contact.email} won't receive any further emails from us.`));
}));

export default router;

import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD in .env before seeding");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash },
  });

  console.log(`Login user ready: ${user.email}`);

  const sampleTemplates = [
    {
      name: "Intro",
      subject: "Quick question about {{company}}'s manufacturing setup",
      bodyText:
        "Hi {{name}},\n\nI came across {{company}} and wanted to reach out - we work with manufacturers on custom special purpose machines (hydraulics, automation) and thought there might be a fit given your role as {{title}}.\n\nWorth a quick call to see if it's relevant?\n\nBest,\nUnique SPM",
    },
    {
      name: "Follow-up 1",
      subject: "Re: Quick question about {{company}}'s manufacturing setup",
      bodyText:
        "Hi {{name}},\n\nJust following up on my note below in case it got buried - happy to share a couple of examples of similar work we've done if useful.\n\nLet me know if this is worth a 15-minute call.\n\nBest,\nUnique SPM",
    },
  ];

  for (const t of sampleTemplates) {
    const existing = await prisma.template.findFirst({ where: { name: t.name } });
    if (!existing) {
      await prisma.template.create({
        data: { name: t.name, subject: t.subject, bodyHtml: t.bodyText.replace(/\n/g, "<br/>"), bodyText: t.bodyText },
      });
      console.log(`Sample template created: ${t.name}`);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

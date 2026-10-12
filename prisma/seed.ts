// Seed script — populates the `Content` table with bilingual default content.
// Each row's `data` is a JSON string: { fa: <sectionContent>, en: <sectionContent> }.
// Run with: `bun run db:seed`

import { db } from "../src/lib/db";
import { defaultContentFa, defaultContentEn } from "../src/lib/default-content";
import { SECTION_KEYS, type SectionKey } from "../src/lib/content-types";

async function main() {
  console.log("🌱 Seeding bilingual Content table...");
  console.log(`   Sections: ${SECTION_KEYS.length} (${SECTION_KEYS.join(", ")})`);

  let created = 0;
  let updated = 0;

  for (const section of SECTION_KEYS) {
    const data = JSON.stringify({
      fa: defaultContentFa[section as SectionKey],
      en: defaultContentEn[section as SectionKey],
    });
    const result = await db.content.upsert({
      where: { section },
      update: { data },
      create: { section, data },
    });
    if (result.createdAt.getTime() === result.updatedAt.getTime()) created++;
    else updated++;
    console.log(`   ✓ ${section}`);
  }

  console.log(`\n✅ Seed complete: ${created} created, ${updated} updated, ${SECTION_KEYS.length} total sections.`);
}

main()
  .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });

import { PersonForm } from "@/components/forms/PersonForm";
import { getAllLevels } from "@/lib/queries/admin";

export const dynamic = "force-dynamic";

export default async function NuovaPersonaPage() {
  const levels = await getAllLevels();
  return <PersonForm levels={levels.filter((l) => l.active)} isSelf={false} />;
}

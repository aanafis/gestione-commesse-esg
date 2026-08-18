import { SettingsForm } from "@/components/forms/SettingsForm";
import { getSettingsRow } from "@/lib/queries/admin";

export const dynamic = "force-dynamic";

export default async function ImpostazioniPage() {
  const settings = await getSettingsRow();
  return <SettingsForm settings={settings} />;
}

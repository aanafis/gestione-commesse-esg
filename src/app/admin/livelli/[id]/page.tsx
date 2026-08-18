import { notFound } from "next/navigation";
import { LevelForm } from "@/components/forms/LevelForm";
import { getLevel } from "@/lib/queries/admin";

export const dynamic = "force-dynamic";

export default async function ModificaLivelloPage(props: PageProps<"/admin/livelli/[id]">) {
  const { id } = await props.params;
  const level = await getLevel(id);
  if (!level) notFound();

  return <LevelForm level={level} />;
}

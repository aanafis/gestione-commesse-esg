import { notFound } from "next/navigation";
import { PersonForm } from "@/components/forms/PersonForm";
import { getAllLevels, getPerson } from "@/lib/queries/admin";
import { getSession } from "@/lib/auth/dal";

export const dynamic = "force-dynamic";

export default async function ModificaPersonaPage(props: PageProps<"/admin/persone/[id]">) {
  const { id } = await props.params;
  const [person, levels, session] = await Promise.all([getPerson(id), getAllLevels(), getSession()]);
  if (!person) notFound();

  return (
    <PersonForm
      person={person}
      levels={levels.filter((l) => l.active || l.id === person.levelId)}
      isSelf={session?.personId === person.id}
    />
  );
}

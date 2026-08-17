"use server";

import { db } from "@/lib/db";
import type { ProjectRole } from "@/lib/db/types";
import { getSession } from "@/lib/auth/dal";

//
// cost_rate_snapshot / sold_rate_snapshot: copiati dal Livello della persona
// al momento della creazione (decisione confermata, §4.1) — un cambio
// tariffa successivo non altera più questa assegnazione.

export type AssignmentFormValues = {
  serviceId: string;
  personId: string;
  projectRole: string;
  estimatedHours: string;
};

export type AssignmentFormState = {
  status: "idle" | "error" | "success";
  errors?: Partial<Record<keyof AssignmentFormValues | "_form", string>>;
  values?: AssignmentFormValues;
  createdServiceId?: string;
  createdPersonName?: string;
};

const PROJECT_ROLE_VALUES: ProjectRole[] = [
  "project_manager",
  "supervision",
  "documentation",
  "site_inspections",
  "data_analysis",
  "support",
];

function isProjectRole(v: string): v is ProjectRole {
  return (PROJECT_ROLE_VALUES as string[]).includes(v);
}

export async function createAssignment(
  _prevState: AssignmentFormState,
  formData: FormData
): Promise<AssignmentFormState> {
  const session = await getSession();
  if (!session) {
    return { status: "error", errors: { _form: "Sessione scaduta — accedi di nuovo." } };
  }

  const values: AssignmentFormValues = {
    serviceId: String(formData.get("serviceId") ?? ""),
    personId: String(formData.get("personId") ?? ""),
    projectRole: String(formData.get("projectRole") ?? ""),
    estimatedHours: String(formData.get("estimatedHours") ?? ""),
  };

  const errors: AssignmentFormState["errors"] = {};

  if (!values.serviceId) errors.serviceId = "Seleziona un servizio.";
  if (!values.personId) errors.personId = "Seleziona una persona.";
  if (!isProjectRole(values.projectRole)) errors.projectRole = "Seleziona un ruolo.";

  const estimatedHours = Number(values.estimatedHours.replace(",", "."));
  if (values.estimatedHours === "" || Number.isNaN(estimatedHours) || estimatedHours < 0) {
    errors.estimatedHours = "Inserisci un numero di ore valido (0 o superiore).";
  }

  if (Object.keys(errors).length > 0) {
    return { status: "error", errors, values };
  }

  try {
    const result = await db.transaction().execute(async (trx) => {
      const person = await trx
        .selectFrom("person as p")
        .innerJoin("level as l", "l.id", "p.levelId")
        .select(["p.name", "l.internalCostRate", "l.soldRate"])
        .where("p.id", "=", values.personId)
        .executeTakeFirst();
      if (!person) throw new Error("PERSON_NOT_FOUND");

      await trx
        .insertInto("assignment")
        .values({
          serviceId: values.serviceId,
          personId: values.personId,
          projectRole: values.projectRole as ProjectRole,
          estimatedHours: estimatedHours.toFixed(2),
          costRateSnapshot: person.internalCostRate,
          soldRateSnapshot: person.soldRate,
          createdBy: session.personId,
          updatedBy: session.personId,
        })
        .execute();

      return { personName: person.name };
    });

    return {
      status: "success",
      createdServiceId: values.serviceId,
      createdPersonName: result.personName,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("assignment_service_id_person_id_key")) {
      return {
        status: "error",
        errors: { personId: "Questa persona è già assegnata a questo servizio." },
        values,
      };
    }
    if (message === "PERSON_NOT_FOUND") {
      return { status: "error", errors: { personId: "Persona non trovata." }, values };
    }
    return {
      status: "error",
      errors: { _form: "Errore imprevisto durante il salvataggio. Riprova." },
      values,
    };
  }
}

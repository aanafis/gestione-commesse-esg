"use server";

import { db } from "@/lib/db";
import type { ServiceStatus } from "@/lib/db/types";
import { getSession } from "@/lib/auth/dal";

export type ServiceFormValues = {
  commessaId: string;
  code: string;
  serviceTypeId: string;
  variant: string;
  pmId: string;
  templateName: string;
  startDate: string;
  endDate: string;
  status: string;
  consultantCostBudget: string;
  markup: string;
  contractedPrice: string;
};

export type ServiceFormState = {
  status: "idle" | "error" | "success";
  errors?: Partial<Record<keyof ServiceFormValues | "_form", string>>;
  values?: ServiceFormValues;
  createdCode?: string;
  createdId?: string;
  generatedPhasesCount?: number;
};

const CODE_RE = /^\d{2}-\d{3}-[A-Z]$/;
const STATUS_VALUES: ServiceStatus[] = ["active", "suspended", "in_certification", "closed"];

function isServiceStatus(v: string): v is ServiceStatus {
  return (STATUS_VALUES as string[]).includes(v);
}

function parseMoney(raw: string): number {
  return Number(raw.replace(",", "."));
}

export async function createService(
  _prevState: ServiceFormState,
  formData: FormData
): Promise<ServiceFormState> {
  const session = await getSession();
  if (!session) {
    return { status: "error", errors: { _form: "Sessione scaduta — accedi di nuovo." } };
  }

  const values: ServiceFormValues = {
    commessaId: String(formData.get("commessaId") ?? ""),
    code: String(formData.get("code") ?? "").trim().toUpperCase(),
    serviceTypeId: String(formData.get("serviceTypeId") ?? ""),
    variant: String(formData.get("variant") ?? "").trim(),
    pmId: String(formData.get("pmId") ?? ""),
    templateName: String(formData.get("templateName") ?? ""),
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
    status: String(formData.get("status") ?? "active"),
    consultantCostBudget: String(formData.get("consultantCostBudget") ?? ""),
    markup: String(formData.get("markup") ?? ""),
    contractedPrice: String(formData.get("contractedPrice") ?? ""),
  };

  const errors: ServiceFormState["errors"] = {};

  if (!values.commessaId) errors.commessaId = "Seleziona una commessa.";
  if (!values.serviceTypeId) errors.serviceTypeId = "Seleziona un tipo di servizio.";
  // Il formato si valida qui; la coerenza col prefisso della commessa scelta
  // (deve iniziare per "{commessa.code}-") si controlla dentro la
  // transazione, dove il vero codice commessa è disponibile.
  if (!CODE_RE.test(values.code)) {
    errors.code = "Formato non valido — usa AA-NNN-X, es. 26-017-A.";
  }

  const consultantCostBudget = parseMoney(values.consultantCostBudget || "0");
  if (values.consultantCostBudget !== "" && (Number.isNaN(consultantCostBudget) || consultantCostBudget < 0)) {
    errors.consultantCostBudget = "Inserisci un importo valido (0 o superiore).";
  }

  const markup = parseMoney(values.markup || "");
  if (values.markup === "" || Number.isNaN(markup) || markup <= 0) {
    errors.markup = "Inserisci un moltiplicatore valido (es. 1.30 = costo +30%).";
  }

  const contractedPrice = parseMoney(values.contractedPrice || "");
  if (values.contractedPrice === "" || Number.isNaN(contractedPrice) || contractedPrice < 0) {
    errors.contractedPrice = "Inserisci un importo valido (0 o superiore).";
  }

  if (!isServiceStatus(values.status)) {
    errors.status = "Stato non valido.";
  }

  if (values.startDate && values.endDate && values.endDate < values.startDate) {
    errors.endDate = "La fine prevista non può precedere la data di avvio.";
  }

  if (Object.keys(errors).length > 0) {
    return { status: "error", errors, values };
  }

  try {
    const result = await db.transaction().execute(async (trx) => {
      const commessa = await trx
        .selectFrom("commessa")
        .select("code")
        .where("id", "=", values.commessaId)
        .executeTakeFirst();
      if (!commessa) {
        throw new Error("COMMESSA_NOT_FOUND");
      }
      if (!values.code.startsWith(`${commessa.code}-`)) {
        throw new Error("CODE_COMMESSA_MISMATCH");
      }

      const service = await trx
        .insertInto("service")
        .values({
          code: values.code,
          commessaId: values.commessaId,
          serviceTypeId: values.serviceTypeId,
          variant: values.variant || null,
          pmId: values.pmId || null,
          templateName: values.templateName || null,
          startDate: values.startDate || null,
          endDate: values.endDate || null,
          status: values.status as ServiceStatus,
          consultantCostBudget: consultantCostBudget.toFixed(2),
          markup: markup.toFixed(4),
          contractedPrice: contractedPrice.toFixed(2),
          createdBy: session.personId,
          updatedBy: session.personId,
        })
        .returning(["id", "code"])
        .executeTakeFirstOrThrow();

      // Fasi generate dal template scelto (§4.2 Phase: "Generated from
      // PhaseTemplate when a service is created, then edited"). duration_days
      // sono offset sequenziali: ogni fase cascata dalla data di avvio del
      // servizio sommando le durate delle fasi precedenti (§4.1).
      let generatedPhasesCount = 0;
      if (values.templateName) {
        const templatePhases = await trx
          .selectFrom("phaseTemplate")
          .selectAll()
          .where("templateName", "=", values.templateName)
          .orderBy("sortOrder")
          .execute();

        let cumulativeDays = 0;
        const startDate = values.startDate ? new Date(`${values.startDate}T00:00:00Z`) : null;

        for (const tp of templatePhases) {
          cumulativeDays += tp.durationDays;
          let dateStr: string | null = null;
          if (startDate) {
            const d = new Date(startDate);
            d.setUTCDate(d.getUTCDate() + cumulativeDays);
            dateStr = d.toISOString().slice(0, 10);
          }

          await trx
            .insertInto("phase")
            .values({
              serviceId: service.id,
              sortOrder: tp.sortOrder,
              name: tp.phaseName,
              templateName: tp.templateName,
              baselineDate: dateStr,
              baselineConfirmed: dateStr !== null,
              plannedDate: dateStr,
              contractualMilestone: tp.contractualMilestone,
              hoursQuotaPct: tp.hoursQuotaPct,
              expectedDeliverable: tp.expectedDeliverable,
              createdBy: session.personId,
              updatedBy: session.personId,
            })
            .execute();
          generatedPhasesCount++;
        }
      }

      return { id: service.id, code: service.code, generatedPhasesCount };
    });

    return {
      status: "success",
      createdCode: result.code,
      createdId: result.id,
      generatedPhasesCount: result.generatedPhasesCount,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("service_code_key")) {
      return { status: "error", errors: { code: "Questo codice servizio esiste già." }, values };
    }
    if (message === "CODE_COMMESSA_MISMATCH") {
      return {
        status: "error",
        errors: { code: "Il codice deve iniziare col codice della commessa selezionata." },
        values,
      };
    }
    if (message === "COMMESSA_NOT_FOUND") {
      return { status: "error", errors: { commessaId: "Commessa non trovata." }, values };
    }
    return {
      status: "error",
      errors: { _form: "Errore imprevisto durante il salvataggio. Riprova." },
      values,
    };
  }
}

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const dynamic = "force-dynamic";

type RecruitmentUser = {
  id: string;
  role: "ADMIN" | "RH";
  supabase: SupabaseClient;
};

const allowedStages = new Set([
  "POSTULACION_RECIBIDA",
  "CONTACTO_INICIAL",
  "PRE_FILTRO",
  "ENTREVISTA_EDVA",
  "EVALUACION",
  "ENVIADO_CLIENTE",
  "ENTREVISTA_CLIENTE",
  "AUTORIZACION_CLIENTE",
  "OFERTA",
  "DOCUMENTACION",
  "CONTRATADO",
  "CERRADO",
]);

const jsonError = (error: string, status: number) =>
  NextResponse.json({ error }, { status });

const cleanString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const nullableString = (value: unknown) => cleanString(value) || null;

const nullableNumber = (value: unknown) => {
  if (value === undefined || value === null || value === "") return null;
  const numberValue =
    typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  return Number.isFinite(numberValue) ? numberValue : null;
};

const nullableInteger = (value: unknown) => {
  const numberValue = nullableNumber(value);
  return numberValue === null ? null : Math.trunc(numberValue);
};

const nullableDate = (value: unknown) => nullableString(value);

const normalizeText = (value: unknown) =>
  cleanString(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const normalizePhone = (value: unknown) => {
  const digits = cleanString(value).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+52${digits}`;
  if (digits.length === 12 && digits.startsWith("52")) return `+${digits}`;
  return `+${digits}`;
};

const normalizeEmail = (value: unknown) =>
  cleanString(value).toLowerCase() || null;

const splitTags = (value: unknown) =>
  cleanString(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

async function getRecruitmentUser(request: Request): Promise<RecruitmentUser | NextResponse> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonError("Configuracion de Supabase incompleta.", 500);
  }

  const token = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();

  if (!token) {
    return jsonError("No autenticado.", 401);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(token);

  if (userError || !userData.user) {
    return jsonError("Sesion invalida.", 401);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", userData.user.id)
    .single();

  if (profileError || !profile || !["ADMIN", "RH"].includes(profile.role)) {
    return jsonError("No tienes permisos para reclutamiento.", 403);
  }

  if (profile.active === false) {
    return jsonError("Tu usuario esta inactivo.", 403);
  }

  return {
    id: userData.user.id,
    role: profile.role,
    supabase,
  };
}

function isResponse(value: RecruitmentUser | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}

async function addEvent(
  user: RecruitmentUser,
  payload: {
    applicationId?: string | null;
    candidateId?: string | null;
    vacancyId?: string | null;
    eventType: string;
    previousStage?: string | null;
    newStage?: string | null;
    previousStatus?: string | null;
    newStatus?: string | null;
    comment?: string | null;
    nextActionParty?: string | null;
    commitmentAt?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  await user.supabase.from("recruitment_events").insert({
    application_id: payload.applicationId || null,
    candidate_id: payload.candidateId || null,
    vacancy_id: payload.vacancyId || null,
    event_type: payload.eventType,
    actor_id: user.id,
    actor_role: user.role,
    previous_stage: payload.previousStage || null,
    new_stage: payload.newStage || null,
    previous_status: payload.previousStatus || null,
    new_status: payload.newStatus || null,
    comment: payload.comment || null,
    next_action_party: payload.nextActionParty || null,
    commitment_at: payload.commitmentAt || null,
    metadata: payload.metadata || {},
  });
}

async function openIntervals(
  user: RecruitmentUser,
  applicationId: string,
  stage: string,
  responsibleParty: string
) {
  const now = new Date().toISOString();

  await user.supabase
    .from("recruitment_stage_intervals")
    .insert({ application_id: applicationId, stage, started_at: now });

  await user.supabase.from("recruitment_responsibility_intervals").insert({
    application_id: applicationId,
    responsible_party: responsibleParty,
    started_at: now,
  });
}

async function closeOpenIntervals(user: RecruitmentUser, applicationId: string) {
  const now = new Date().toISOString();

  await user.supabase
    .from("recruitment_stage_intervals")
    .update({ ended_at: now })
    .eq("application_id", applicationId)
    .is("ended_at", null);

  await user.supabase
    .from("recruitment_responsibility_intervals")
    .update({ ended_at: now })
    .eq("application_id", applicationId)
    .is("ended_at", null);
}

export async function GET(request: Request) {
  const user = await getRecruitmentUser(request);
  if (isResponse(user)) return user;

  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view") || "dashboard";
  const id = searchParams.get("id");
  const q = searchParams.get("q") || "";

  if (view === "dashboard") {
    const [
      vacanciesResult,
      applicationsResult,
      candidatesResult,
      tasksResult,
      templatesResult,
    ] = await Promise.all([
      user.supabase
        .from("recruitment_vacancies")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(8),
      user.supabase
        .from("recruitment_applications")
        .select(
          "*, candidate:recruitment_candidates(*), vacancy:recruitment_vacancies(*)"
        )
        .order("updated_at", { ascending: false })
        .limit(50),
      user.supabase
        .from("recruitment_candidates")
        .select("*")
        .eq("archived", false)
        .order("created_at", { ascending: false })
        .limit(8),
      user.supabase
        .from("recruitment_tasks")
        .select("*, application:recruitment_applications(id, stage)")
        .eq("status", "PENDING")
        .order("due_at", { ascending: true })
        .limit(10),
      user.supabase
        .from("recruitment_message_templates")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    const applications = applicationsResult.data || [];

    return NextResponse.json({
      vacancies: vacanciesResult.data || [],
      applications,
      candidates: candidatesResult.data || [],
      tasks: tasksResult.data || [],
      templates: templatesResult.data || [],
      stats: {
        openVacancies: (vacanciesResult.data || []).filter(
          (vacancy: any) => vacancy.status === "OPEN"
        ).length,
        activeApplications: applications.filter(
          (application: any) => application.process_status === "ACTIVO"
        ).length,
        clientWaiting: applications.filter(
          (application: any) => application.next_action_party === "CLIENTE"
        ).length,
        hired: applications.filter(
          (application: any) => application.stage === "CONTRATADO"
        ).length,
      },
    });
  }

  if (view === "vacancies") {
    const { data, error } = await user.supabase
      .from("recruitment_vacancies")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return jsonError(error.message, 400);
    return NextResponse.json({ vacancies: data || [] });
  }

  if (view === "candidates") {
    let query = user.supabase
      .from("recruitment_candidates")
      .select("*")
      .eq("archived", false)
      .order("created_at", { ascending: false });

    if (q) {
      query = query.or(
        `full_name.ilike.%${q}%,phone_normalized.ilike.%${q}%,email_normalized.ilike.%${q}%`
      );
    }

    const { data, error } = await query;
    if (error) return jsonError(error.message, 400);
    return NextResponse.json({ candidates: data || [] });
  }

  if (view === "applications") {
    const { data, error } = await user.supabase
      .from("recruitment_applications")
      .select(
        "*, candidate:recruitment_candidates(*), vacancy:recruitment_vacancies(*)"
      )
      .order("updated_at", { ascending: false });

    if (error) return jsonError(error.message, 400);
    return NextResponse.json({ applications: data || [] });
  }

  if (view === "application" && id) {
    const [
      application,
      contacts,
      interviews,
      responses,
      evaluations,
      clientReviews,
      offers,
      tasks,
      documents,
      events,
      questionnaireVersion,
    ] = await Promise.all([
      user.supabase
        .from("recruitment_applications")
        .select(
          "*, candidate:recruitment_candidates(*), vacancy:recruitment_vacancies(*)"
        )
        .eq("id", id)
        .single(),
      user.supabase
        .from("recruitment_contacts")
        .select("*")
        .eq("application_id", id)
        .order("occurred_at", { ascending: false }),
      user.supabase
        .from("recruitment_interviews")
        .select("*")
        .eq("application_id", id)
        .order("scheduled_at", { ascending: false }),
      user.supabase
        .from("recruitment_questionnaire_responses")
        .select("*, version:recruitment_questionnaire_versions(*)")
        .eq("application_id", id)
        .order("created_at", { ascending: false }),
      user.supabase
        .from("recruitment_evaluations")
        .select("*")
        .eq("application_id", id)
        .order("evaluated_at", { ascending: false }),
      user.supabase
        .from("recruitment_client_reviews")
        .select("*")
        .eq("application_id", id)
        .order("created_at", { ascending: false }),
      user.supabase
        .from("recruitment_offers")
        .select("*")
        .eq("application_id", id)
        .order("created_at", { ascending: false }),
      user.supabase
        .from("recruitment_tasks")
        .select("*")
        .eq("application_id", id)
        .order("due_at", { ascending: true }),
      user.supabase
        .from("recruitment_document_checklist")
        .select("*")
        .eq("application_id", id)
        .order("created_at", { ascending: true }),
      user.supabase
        .from("recruitment_events")
        .select("*")
        .eq("application_id", id)
        .order("occurred_at", { ascending: false }),
      user.supabase
        .from("recruitment_questionnaire_versions")
        .select("*")
        .eq("status", "ACTIVE")
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (application.error) return jsonError(application.error.message, 404);

    return NextResponse.json({
      application: application.data,
      contacts: contacts.data || [],
      interviews: interviews.data || [],
      responses: responses.data || [],
      evaluations: evaluations.data || [],
      clientReviews: clientReviews.data || [],
      offers: offers.data || [],
      tasks: tasks.data || [],
      documents: documents.data || [],
      events: events.data || [],
      questionnaireVersion: questionnaireVersion.data || null,
    });
  }

  if (view === "settings") {
    const [versions, templates] = await Promise.all([
      user.supabase
        .from("recruitment_questionnaire_versions")
        .select("*, template:recruitment_questionnaire_templates(*)")
        .order("created_at", { ascending: false }),
      user.supabase
        .from("recruitment_message_templates")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);

    return NextResponse.json({
      questionnaireVersions: versions.data || [],
      messageTemplates: templates.data || [],
    });
  }

  return jsonError("Vista no valida.", 400);
}

export async function POST(request: Request) {
  const user = await getRecruitmentUser(request);
  if (isResponse(user)) return user;

  const body = await request.json();
  const action = cleanString(body.action);

  if (action === "createVacancy" || action === "updateVacancy") {
    const vacancyId = cleanString(body.id);
    const title = cleanString(body.title);
    const accountName = cleanString(body.accountName);
    const state = cleanString(body.state);
    const city = cleanString(body.city);
    const positionsTotal = nullableInteger(body.positionsTotal);

    if (!title || !accountName || !state || !city || !positionsTotal) {
      return jsonError("Faltan datos obligatorios de la vacante.", 400);
    }

    const payload = {
      title,
      account_id: nullableString(body.accountId),
      account_name: accountName,
      brand: nullableString(body.brand),
      chain_name: nullableString(body.chainName),
      store_id: nullableString(body.storeId),
      store_name: nullableString(body.storeName),
      state,
      city,
      city_normalized: normalizeText(city),
      work_location: nullableString(body.workLocation),
      positions_total: positionsTotal,
      description: nullableString(body.description),
      functions: nullableString(body.functions),
      required_experience: nullableString(body.requiredExperience),
      desirable_experience: nullableString(body.desirableExperience),
      salary_base: nullableNumber(body.salaryBase),
      salary_period: cleanString(body.salaryPeriod) || "MONTHLY",
      salary_tax_type: cleanString(body.salaryTaxType) || "NET",
      commission_type: cleanString(body.commissionType) || "NONE",
      commission_value: nullableNumber(body.commissionValue),
      commission_explanation: nullableString(body.commissionExplanation),
      bonuses: nullableString(body.bonuses),
      benefits: nullableString(body.benefits),
      work_schedule: nullableString(body.workSchedule),
      work_days: nullableString(body.workDays),
      rest_days: nullableString(body.restDays),
      target_fill_date: nullableDate(body.targetFillDate),
      priority: cleanString(body.priority) || "NORMAL",
      client_contact_name: nullableString(body.clientContactName),
      client_contact_position: nullableString(body.clientContactPosition),
      client_contact_email: nullableString(body.clientContactEmail),
      client_contact_phone: nullableString(body.clientContactPhone),
      requires_client_authorization: Boolean(body.requiresClientAuthorization),
      status: cleanString(body.status) || "DRAFT",
      internal_notes: nullableString(body.internalNotes),
      updated_by: user.id,
    };

    if (action === "updateVacancy") {
      if (!vacancyId) return jsonError("Falta la vacante.", 400);
      const { data, error } = await user.supabase
        .from("recruitment_vacancies")
        .update(payload)
        .eq("id", vacancyId)
        .select()
        .single();

      if (error) return jsonError(error.message, 400);
      await addEvent(user, {
        vacancyId,
        eventType: "VACANTE_ACTUALIZADA",
        comment: "Vacante actualizada.",
      });
      return NextResponse.json({ vacancy: data });
    }

    const { data, error } = await user.supabase
      .from("recruitment_vacancies")
      .insert({ ...payload, created_by: user.id })
      .select()
      .single();

    if (error) return jsonError(error.message, 400);
    await addEvent(user, {
      vacancyId: data.id,
      eventType: "VACANTE_CREADA",
      newStatus: data.status,
      comment: "Vacante creada.",
    });
    return NextResponse.json({ vacancy: data });
  }

  if (action === "createCandidate" || action === "updateCandidate") {
    const candidateId = cleanString(body.id);
    const fullName = cleanString(body.fullName);
    const phoneNormalized = normalizePhone(body.phone);
    const city = cleanString(body.city);
    const state = cleanString(body.state);
    const emailNormalized = normalizeEmail(body.email);

    if (!fullName || !phoneNormalized || !city || !state) {
      return jsonError("Faltan datos obligatorios del candidato.", 400);
    }

    const payload = {
      full_name: fullName,
      phone: cleanString(body.phone),
      phone_normalized: phoneNormalized,
      email: nullableString(body.email),
      email_normalized: emailNormalized,
      state,
      city,
      city_normalized: normalizeText(city),
      municipality: nullableString(body.municipality),
      experience_summary: nullableString(body.experienceSummary),
      last_position: nullableString(body.lastPosition),
      last_company: nullableString(body.lastCompany),
      sales_experience: nullableString(body.salesExperience),
      sectors: splitTags(body.sectors),
      availability_start: nullableDate(body.availabilityStart),
      expected_salary: nullableNumber(body.expectedSalary),
      expected_salary_period: nullableString(body.expectedSalaryPeriod),
      tags: splitTags(body.tags),
      initial_comment: nullableString(body.initialComment),
      privacy_notice_presented: Boolean(body.privacyNoticePresented),
      privacy_notice_version: nullableString(body.privacyNoticeVersion),
      privacy_notice_presented_at: body.privacyNoticePresented
        ? new Date().toISOString()
        : null,
      future_contact_consent:
        cleanString(body.futureContactConsent) || "NOT_ASKED",
      updated_by: user.id,
    };

    if (action === "updateCandidate") {
      if (!candidateId) return jsonError("Falta el candidato.", 400);
      const { data, error } = await user.supabase
        .from("recruitment_candidates")
        .update(payload)
        .eq("id", candidateId)
        .select()
        .single();

      if (error) return jsonError(error.message, 400);
      await addEvent(user, {
        candidateId,
        eventType: "CANDIDATO_ACTUALIZADO",
        comment: "Candidato actualizado.",
      });
      return NextResponse.json({ candidate: data });
    }

    const { data: duplicate } = await user.supabase
      .from("recruitment_candidates")
      .select("id, full_name")
      .or(
        `phone_normalized.eq.${phoneNormalized}${
          emailNormalized ? `,email_normalized.eq.${emailNormalized}` : ""
        }`
      )
      .eq("archived", false)
      .limit(1)
      .maybeSingle();

    if (duplicate) {
      return jsonError(
        `Ya existe un candidato con esos datos: ${duplicate.full_name}.`,
        409
      );
    }

    const { data, error } = await user.supabase
      .from("recruitment_candidates")
      .insert({ ...payload, created_by: user.id })
      .select()
      .single();

    if (error) return jsonError(error.message, 400);
    await addEvent(user, {
      candidateId: data.id,
      eventType: "CANDIDATO_CREADO",
      comment: "Candidato creado.",
    });
    return NextResponse.json({ candidate: data });
  }

  if (action === "createApplication") {
    const candidateId = cleanString(body.candidateId);
    const vacancyId = cleanString(body.vacancyId);

    if (!candidateId || !vacancyId) {
      return jsonError("Selecciona candidato y vacante.", 400);
    }

    const { data, error } = await user.supabase
      .from("recruitment_applications")
      .insert({
        candidate_id: candidateId,
        vacancy_id: vacancyId,
        source: cleanString(body.source) || "OTHER",
        source_detail: nullableString(body.sourceDetail),
        referred_by: nullableString(body.referredBy),
        owner_id: user.id,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();

    if (error) return jsonError(error.message, 400);

    await openIntervals(user, data.id, data.stage, data.next_action_party);
    await addEvent(user, {
      applicationId: data.id,
      candidateId,
      vacancyId,
      eventType: "POSTULACION_CREADA",
      newStage: data.stage,
      newStatus: data.process_status,
      comment: "Postulacion creada.",
      nextActionParty: data.next_action_party,
    });

    const documents = [
      "Identificacion oficial",
      "CURP",
      "RFC",
      "NSS",
      "Comprobante de domicilio",
      "Cuenta bancaria / CLABE",
    ].map((documentName) => ({
      application_id: data.id,
      document_name: documentName,
      created_by: user.id,
    }));

    await user.supabase.from("recruitment_document_checklist").insert(documents);

    return NextResponse.json({ application: data });
  }

  if (action === "changeStage") {
    const applicationId = cleanString(body.applicationId);
    const newStage = cleanString(body.stage);
    const nextActionParty = cleanString(body.nextActionParty) || "EDVA";

    if (!applicationId || !allowedStages.has(newStage)) {
      return jsonError("Etapa no valida.", 400);
    }

    const { data: current, error: currentError } = await user.supabase
      .from("recruitment_applications")
      .select("*")
      .eq("id", applicationId)
      .single();

    if (currentError || !current) {
      return jsonError("No fue posible cargar la postulacion.", 404);
    }

    const newStatus =
      newStage === "CERRADO"
        ? "CERRADO"
        : newStage === "CONTRATADO"
          ? "COMPLETADO"
          : cleanString(body.processStatus) || current.process_status;

    if (newStatus === "CERRADO" && !cleanString(body.closeReason)) {
      return jsonError("Indica el motivo de cierre.", 400);
    }

    await closeOpenIntervals(user, applicationId);

    const { data, error } = await user.supabase
      .from("recruitment_applications")
      .update({
        stage: newStage,
        process_status: newStatus,
        close_result: nullableString(body.closeResult),
        close_reason: nullableString(body.closeReason),
        next_action_party: nextActionParty,
        next_action: nullableString(body.nextAction),
        commitment_at: nullableString(body.commitmentAt),
        lock_version: Number(current.lock_version || 1) + 1,
        updated_by: user.id,
      })
      .eq("id", applicationId)
      .select()
      .single();

    if (error) return jsonError(error.message, 400);

    await openIntervals(
      user,
      applicationId,
      newStage,
      newStatus === "CERRADO" ? "PAUSADO" : nextActionParty
    );
    await addEvent(user, {
      applicationId,
      candidateId: current.candidate_id,
      vacancyId: current.vacancy_id,
      eventType: "CAMBIO_ETAPA",
      previousStage: current.stage,
      newStage,
      previousStatus: current.process_status,
      newStatus,
      comment: nullableString(body.comment),
      nextActionParty,
      commitmentAt: nullableString(body.commitmentAt),
    });

    return NextResponse.json({ application: data });
  }

  if (action === "addContact") {
    const applicationId = cleanString(body.applicationId);
    const payload = {
      application_id: applicationId,
      channel: cleanString(body.channel) || "WHATSAPP",
      direction: cleanString(body.direction) || "OUTBOUND",
      occurred_at: cleanString(body.occurredAt) || new Date().toISOString(),
      result: cleanString(body.result) || "ASKS_INFO",
      summary: nullableString(body.summary),
      next_action: nullableString(body.nextAction),
      owner_id: user.id,
      commitment_at: nullableString(body.commitmentAt),
      created_by: user.id,
    };

    const { data, error } = await user.supabase
      .from("recruitment_contacts")
      .insert(payload)
      .select()
      .single();

    if (error) return jsonError(error.message, 400);
    await addEvent(user, {
      applicationId,
      eventType: "CONTACTO_REGISTRADO",
      comment: payload.summary,
      nextActionParty: "CANDIDATO",
      commitmentAt: payload.commitment_at,
    });
    return NextResponse.json({ contact: data });
  }

  if (action === "addInterview") {
    const applicationId = cleanString(body.applicationId);
    const payload = {
      application_id: applicationId,
      interview_type: cleanString(body.interviewType) || "EDVA",
      interviewer: cleanString(body.interviewer),
      scheduled_at: cleanString(body.scheduledAt),
      modality: cleanString(body.modality) || "CALL",
      place_or_link: nullableString(body.placeOrLink),
      status: cleanString(body.status) || "SCHEDULED",
      internal_comments: nullableString(body.internalComments),
      client_shareable_summary: nullableString(body.clientShareableSummary),
      next_action: nullableString(body.nextAction),
      created_by: user.id,
      updated_by: user.id,
    };

    if (!payload.application_id || !payload.interviewer || !payload.scheduled_at) {
      return jsonError("Faltan datos de entrevista.", 400);
    }

    const { data, error } = await user.supabase
      .from("recruitment_interviews")
      .insert(payload)
      .select()
      .single();

    if (error) return jsonError(error.message, 400);
    await addEvent(user, {
      applicationId,
      eventType: "ENTREVISTA_REGISTRADA",
      comment: `${payload.interview_type} - ${payload.status}`,
    });
    return NextResponse.json({ interview: data });
  }

  if (action === "saveQuestionnaire") {
    const applicationId = cleanString(body.applicationId);
    const versionId = cleanString(body.versionId);

    if (!applicationId || !versionId) {
      return jsonError("Falta el cuestionario.", 400);
    }

    const { data, error } = await user.supabase
      .from("recruitment_questionnaire_responses")
      .upsert(
        {
          application_id: applicationId,
          version_id: versionId,
          answers: body.answers || {},
          status: cleanString(body.status) || "DRAFT",
          finalized_at:
            cleanString(body.status) === "FINALIZED" ? new Date().toISOString() : null,
          created_by: user.id,
          updated_by: user.id,
        },
        { onConflict: "application_id,version_id" }
      )
      .select()
      .single();

    if (error) return jsonError(error.message, 400);
    await addEvent(user, {
      applicationId,
      eventType: "CUESTIONARIO_GUARDADO",
      comment: `Estado: ${data.status}`,
    });
    return NextResponse.json({ response: data });
  }

  if (action === "addEvaluation") {
    const applicationId = cleanString(body.applicationId);
    const { data, error } = await user.supabase
      .from("recruitment_evaluations")
      .insert({
        application_id: applicationId,
        dimensions: body.dimensions || {},
        strengths: nullableString(body.strengths),
        development_areas: nullableString(body.developmentAreas),
        pending_questions: nullableString(body.pendingQuestions),
        suggested_training: nullableString(body.suggestedTraining),
        recommendation: nullableString(body.recommendation),
        justification: nullableString(body.justification),
        professional_summary: nullableString(body.professionalSummary),
        evaluator_id: user.id,
      })
      .select()
      .single();

    if (error) return jsonError(error.message, 400);
    await addEvent(user, {
      applicationId,
      eventType: "EVALUACION_REGISTRADA",
      comment: data.recommendation,
    });
    return NextResponse.json({ evaluation: data });
  }

  if (action === "addClientReview") {
    const applicationId = cleanString(body.applicationId);
    const { data, error } = await user.supabase
      .from("recruitment_client_reviews")
      .insert({
        application_id: applicationId,
        sent_at: nullableString(body.sentAt),
        recipient_name: nullableString(body.recipientName),
        channel: nullableString(body.channel),
        shared_summary: nullableString(body.sharedSummary),
        commitment_at: nullableString(body.commitmentAt),
        status: cleanString(body.status) || "PENDING",
        client_comments: nullableString(body.clientComments),
        resolved_at: nullableString(body.resolvedAt),
        resolved_by_name: nullableString(body.resolvedByName),
        next_action: nullableString(body.nextAction),
        internal_notes: nullableString(body.internalNotes),
        created_by: user.id,
      })
      .select()
      .single();

    if (error) return jsonError(error.message, 400);
    await addEvent(user, {
      applicationId,
      eventType: "REVISION_CLIENTE_REGISTRADA",
      comment: data.status,
      nextActionParty: "CLIENTE",
      commitmentAt: data.commitment_at,
    });
    return NextResponse.json({ clientReview: data });
  }

  if (action === "addOffer") {
    const applicationId = cleanString(body.applicationId);
    const { data, error } = await user.supabase
      .from("recruitment_offers")
      .insert({
        application_id: applicationId,
        salary: nullableNumber(body.salary),
        salary_period: nullableString(body.salaryPeriod),
        salary_tax_type: nullableString(body.salaryTaxType),
        commissions: nullableString(body.commissions),
        bonuses: nullableString(body.bonuses),
        schedule: nullableString(body.schedule),
        rest_days: nullableString(body.restDays),
        benefits: nullableString(body.benefits),
        store_name: nullableString(body.storeName),
        proposed_start_date: nullableDate(body.proposedStartDate),
        expected_response_at: nullableString(body.expectedResponseAt),
        status: cleanString(body.status) || "PENDING",
        responded_at: nullableString(body.respondedAt),
        rejection_reason: nullableString(body.rejectionReason),
        created_by: user.id,
      })
      .select()
      .single();

    if (error) return jsonError(error.message, 400);
    await user.supabase
      .from("recruitment_applications")
      .update({
        offered_salary: data.salary,
        offered_salary_period: data.salary_period,
        offered_commission: data.commissions,
        offered_bonuses: data.bonuses,
        offered_schedule: data.schedule,
        offered_rest_days: data.rest_days,
        offer_snapshot_at: new Date().toISOString(),
        expected_start_date: data.proposed_start_date,
        updated_by: user.id,
      })
      .eq("id", applicationId);
    await addEvent(user, {
      applicationId,
      eventType: "OFERTA_REGISTRADA",
      comment: data.status,
      nextActionParty: "CANDIDATO",
      commitmentAt: data.expected_response_at,
    });
    return NextResponse.json({ offer: data });
  }

  if (action === "addTask") {
    const { data, error } = await user.supabase
      .from("recruitment_tasks")
      .insert({
        application_id: nullableString(body.applicationId),
        title: cleanString(body.title),
        owner_id: user.id,
        due_at: nullableString(body.dueAt),
        comment: nullableString(body.comment),
        created_by: user.id,
      })
      .select()
      .single();

    if (error) return jsonError(error.message, 400);
    return NextResponse.json({ task: data });
  }

  if (action === "updateTask") {
    const taskId = cleanString(body.taskId);
    const { data, error } = await user.supabase
      .from("recruitment_tasks")
      .update({
        status: cleanString(body.status) || "PENDING",
        comment: nullableString(body.comment),
        resolved_at:
          cleanString(body.status) === "COMPLETED" ? new Date().toISOString() : null,
      })
      .eq("id", taskId)
      .select()
      .single();

    if (error) return jsonError(error.message, 400);
    return NextResponse.json({ task: data });
  }

  if (action === "saveMessageTemplate") {
    const templateId = cleanString(body.id);
    const payload = {
      name: cleanString(body.name),
      channel: cleanString(body.channel) || "WHATSAPP",
      body: cleanString(body.body),
      active: body.active !== false,
      updated_by: user.id,
    };

    if (!payload.name || !payload.body) {
      return jsonError("Falta nombre o cuerpo de la plantilla.", 400);
    }

    const query = templateId
      ? user.supabase
          .from("recruitment_message_templates")
          .update(payload)
          .eq("id", templateId)
      : user.supabase
          .from("recruitment_message_templates")
          .insert({ ...payload, created_by: user.id });

    const { data, error } = await query.select().single();
    if (error) return jsonError(error.message, 400);
    return NextResponse.json({ template: data });
  }

  return jsonError("Accion no valida.", 400);
}

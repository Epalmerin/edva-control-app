"use client";

/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { supabase } from "@/lib/supabase";

type RecruitmentView =
  | "dashboard"
  | "vacancies"
  | "candidates"
  | "applications"
  | "application"
  | "settings";

type RecruitmentModuleProps = {
  view: RecruitmentView;
  applicationId?: string;
};

const stages = [
  { value: "POSTULACION_RECIBIDA", label: "Postulacion recibida" },
  { value: "CONTACTO_INICIAL", label: "Contacto inicial" },
  { value: "PRE_FILTRO", label: "Pre filtro" },
  { value: "ENTREVISTA_EDVA", label: "Entrevista EDVA" },
  { value: "EVALUACION", label: "Evaluacion" },
  { value: "ENVIADO_CLIENTE", label: "Enviado a cliente" },
  { value: "ENTREVISTA_CLIENTE", label: "Entrevista cliente" },
  { value: "AUTORIZACION_CLIENTE", label: "Autorizacion cliente" },
  { value: "OFERTA", label: "Oferta" },
  { value: "DOCUMENTACION", label: "Documentacion" },
  { value: "CONTRATADO", label: "Contratado" },
  { value: "CERRADO", label: "Cerrado" },
];

const stageLabels = Object.fromEntries(stages.map((stage) => [stage.value, stage.label]));
const stageOrder = stages.map((stage) => stage.value);

const isStageAtLeast = (currentStage: string, targetStage: string) => {
  const currentIndex = stageOrder.indexOf(currentStage);
  const targetIndex = stageOrder.indexOf(targetStage);

  return currentIndex >= 0 && targetIndex >= 0 && currentIndex >= targetIndex;
};

const emptyVacancy = {
  title: "",
  accountId: "",
  accountName: "",
  brand: "",
  chainName: "",
  storeId: "",
  storeName: "",
  state: "",
  city: "",
  workLocation: "",
  positionsTotal: "1",
  salaryBase: "",
  salaryPeriod: "MONTHLY",
  salaryTaxType: "NET",
  commissionType: "NONE",
  commissionValue: "",
  commissionExplanation: "",
  bonuses: "",
  benefits: "",
  workSchedule: "",
  workDays: "",
  restDays: "",
  priority: "NORMAL",
  status: "OPEN",
  targetFillDate: "",
  clientContactName: "",
  clientContactEmail: "",
  clientContactPhone: "",
  requiresClientAuthorization: false,
  description: "",
  functions: "",
  requiredExperience: "",
  desirableExperience: "",
  internalNotes: "",
};

const emptyCandidate = {
  fullName: "",
  phone: "",
  email: "",
  state: "",
  city: "",
  municipality: "",
  experienceSummary: "",
  lastPosition: "",
  lastCompany: "",
  salesExperience: "",
  sectors: "",
  availabilityStart: "",
  expectedSalary: "",
  expectedSalaryPeriod: "MONTHLY",
  tags: "",
  initialComment: "",
  privacyNoticePresented: false,
  privacyNoticeVersion: "EDVA-2026-01",
  futureContactConsent: "NOT_ASKED",
};

const etsOperationalQuestions = [
  {
    id: "labor_status",
    label: "Actualmente estas laborando?",
    options: [
      ["No labora actualmente", 5],
      ["Si labora pero disponible", 4],
      ["Si labora con poca disponibilidad", 2],
      ["No definido", 0],
    ],
  },
  {
    id: "commute_time",
    label: "Tiempo de traslado a la tienda",
    options: [
      ["0 a 20 min", 5],
      ["21 a 40 min", 4],
      ["41 a 60 min", 3],
      ["Mas de 60 min", 1],
      ["No definido", 0],
    ],
  },
  {
    id: "transport_cost",
    label: "Costo diario de transporte",
    options: [
      ["$0 a $30 diario", 5],
      ["$31 a $50 diario", 4],
      ["$51 a $80 diario", 3],
      ["Mas de $80 diario", 1],
      ["No definido", 0],
    ],
  },
];

const etsQuestions = [
  {
    id: "last_job",
    section: "Experiencia laboral",
    question: "Ultimo empleo y que vendia",
    weight: 6,
    options: [
      ["Ventas retail / promotoria vigente", 5],
      ["Ventas no retail / campo / cambaceo", 4],
      ["Atencion a clientes / caja", 3],
      ["Operativo sin venta", 1],
      ["Sin experiencia clara", 0],
    ],
  },
  {
    id: "department_store",
    section: "Experiencia laboral",
    question: "Experiencia en tiendas departamentales",
    weight: 5,
    options: [
      ["Sears/Liverpool/Palacio u otra departamental", 5],
      ["Coppel/Elektra/Suburbia/autoservicio", 4],
      ["Retail pequeno/local", 3],
      ["No ha trabajado en tienda", 0],
    ],
  },
  {
    id: "goals_commissions",
    section: "Experiencia laboral",
    question: "Trabajo por metas o comisiones",
    weight: 6,
    options: [
      ["Si, metas + comisiones/bonos", 5],
      ["Si, solo metas", 4],
      ["Solo sueldo fijo con apoyo en ventas", 2],
      ["No", 0],
    ],
  },
  {
    id: "sales_strength",
    section: "Experiencia laboral",
    question: "Que se le facilita en ventas",
    weight: 7,
    options: [
      ["Abordar + explicar + cerrar + seguimiento", 5],
      ["Abordar + explicar + atencion", 4],
      ["Atencion al cliente principalmente", 3],
      ["Solo acomodo/frenteo/operativo", 1],
      ["No claro", 0],
    ],
  },
  {
    id: "just_looking",
    section: "Experiencia laboral",
    question: "Cliente dice: solo estoy viendo",
    weight: 5,
    options: [
      ["Da espacio y retoma con pregunta de necesidad", 5],
      ["Se pone a la orden y acompana sin presion", 4],
      ["Solo se pone a la orden", 3],
      ["Insiste sin estrategia", 2],
      ["No sabe responder", 0],
    ],
  },
  {
    id: "hard_sale",
    section: "Experiencia laboral",
    question: "Venta mas dificil",
    weight: 5,
    options: [
      ["Describe objecion, estrategia, seguimiento y cierre", 5],
      ["Describe objecion y cierre", 4],
      ["Describe atencion pero sin cierre claro", 3],
      ["Respuesta muy general", 1],
      ["No recuerda/no aplica", 0],
    ],
  },
  {
    id: "high_ticket",
    section: "Experiencia laboral",
    question: "Venta de productos de ticket alto",
    weight: 6,
    options: [
      ["Si: colchones/muebles/linea blanca/ticket alto", 5],
      ["Si: tecnologia/telefonia gama alta", 4],
      ["Si: moda/belleza/accesorios", 3],
      ["No", 0],
    ],
  },
  {
    id: "likes_sales",
    section: "Actitud y personalidad",
    question: "Que le gusta de trabajar en ventas",
    weight: 5,
    options: [
      ["Le gusta vender, cerrar y generar relaciones", 5],
      ["Le gusta ganar dinero y cumplir metas", 4],
      ["Le gusta atencion al cliente", 3],
      ["Busca solo empleo/sueldo", 1],
      ["No claro", 0],
    ],
  },
  {
    id: "low_month",
    section: "Actitud y personalidad",
    question: "Reaccion ante un mes bajo",
    weight: 5,
    options: [
      ["Da seguimiento, prospecta y ajusta estrategia", 5],
      ["Se esfuerza mas y mantiene actitud", 4],
      ["Se frustra pero continua", 3],
      ["Se desmotiva", 1],
      ["No sabe", 0],
    ],
  },
  {
    id: "pay_preference",
    section: "Actitud y personalidad",
    question: "Preferencia de pago",
    weight: 5,
    options: [
      ["Mixto porque busca ganar mas por resultados", 5],
      ["Comisiones porque confia en su venta", 4],
      ["Fijo con comisiones pequenas", 3],
      ["Solo sueldo fijo", 1],
      ["No claro", 0],
    ],
  },
  {
    id: "supervisors",
    section: "Actitud y personalidad",
    question: "Como lo describirian supervisores",
    weight: 4,
    options: [
      ["Responsable, puntual, lider y vendedor", 5],
      ["Servicial, dedicado y puntual", 4],
      ["Buen trabajador pero con areas de conflicto", 2],
      ["No sabe/no tiene referencias", 0],
    ],
  },
  {
    id: "important",
    section: "Actitud y personalidad",
    question: "Que considera mas importante",
    weight: 5,
    options: [
      ["Cierre + metas + atencion + imagen", 5],
      ["Atencion que lleva al cierre", 4],
      ["Solo atencion al cliente", 3],
      ["Solo imagen/operacion", 2],
      ["No claro", 0],
    ],
  },
  {
    id: "weekends",
    section: "Disponibilidad y compromiso",
    question: "Fines de semana y horarios retail",
    weight: 5,
    options: [
      ["Si, disponibilidad total", 5],
      ["Si, con restricciones menores", 3],
      ["No", 0],
    ],
  },
  {
    id: "pressure",
    section: "Disponibilidad y compromiso",
    question: "Presion u objetivos",
    weight: 5,
    options: [
      ["No tiene problema y ha trabajado por objetivos", 5],
      ["No tiene problema", 4],
      ["Tiene dudas", 2],
      ["No tolera presion", 0],
    ],
  },
  {
    id: "interest",
    section: "Disponibilidad y compromiso",
    question: "Interes en la vacante",
    weight: 5,
    options: [
      ["Le interesa la vacante y el crecimiento", 5],
      ["Le interesa sueldo + comisiones", 4],
      ["Le interesa por necesidad inmediata", 2],
      ["No claro", 0],
    ],
  },
  {
    id: "salary_expectation",
    section: "Disponibilidad y compromiso",
    question: "Expectativa economica",
    weight: 6,
    options: [
      ["Dentro del rango de la vacante", 5],
      ["Ligeramente arriba pero negociable", 3],
      ["Muy arriba del rango", 1],
      ["No definida", 0],
    ],
  },
  {
    id: "permanence",
    section: "Disponibilidad y compromiso",
    question: "Tiempo que le gustaria permanecer",
    weight: 5,
    options: [
      ["Indefinido / hacer carrera", 5],
      ["2 a 3 anos con crecimiento", 4],
      ["1 ano", 3],
      ["Corto plazo / temporal", 1],
      ["No claro", 0],
    ],
  },
];

const calculateEts = (answers: Record<string, string>) => {
  const operationalScores = etsOperationalQuestions.map((question) => {
    const option = question.options.find(([label]) => label === answers[question.id]);
    return Number(option?.[1] || 0);
  });

  const operationalAverage =
    operationalScores.reduce((sum, value) => sum + value, 0) /
    etsOperationalQuestions.length;
  const operationalPoints = (operationalAverage / 5) * 10;
  const questionnairePoints = etsQuestions.reduce((sum, question) => {
    const option = question.options.find(([label]) => label === answers[question.id]);
    return sum + (Number(option?.[1] || 0) / 5) * question.weight;
  }, 0);
  const total = Math.round((questionnairePoints + operationalPoints) * 10) / 10;
  const classification =
    total >= 90
      ? "Elite EDVA"
      : total >= 80
        ? "Comercial A"
        : total >= 70
          ? "Comercial B"
          : total >= 60
            ? "Comercial C"
            : "No recomendable";
  const recommendation =
    total >= 85
      ? "RECOMENDADO"
      : total >= 70
        ? "VIABLE CON SEGUIMIENTO"
        : total >= 60
          ? "SOLO SI NO HAY OPCIONES"
          : "NO RECOMENDADO";
  const rotationRisk =
    operationalAverage >= 4.2 ? "Bajo" : operationalAverage >= 3 ? "Medio" : "Alto";
  const viability =
    operationalAverage >= 4.2 ? "Alta" : operationalAverage >= 3 ? "Media" : "Baja";

  return {
    total,
    questionnairePoints: Math.round(questionnairePoints * 10) / 10,
    operationalPoints: Math.round(operationalPoints * 10) / 10,
    classification,
    recommendation,
    rotationRisk,
    viability,
  };
};

const inputClass = "w-full mt-1 px-4 py-3 border rounded-lg bg-white";
const smallButton =
  "bg-neutral-900 hover:bg-neutral-800 text-white font-semibold px-4 py-2 rounded-lg disabled:opacity-60";
const redButton =
  "bg-red-500 hover:bg-red-600 text-white font-semibold px-5 py-3 rounded-lg disabled:opacity-60";

const cleanString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const nullableString = (value: unknown) => cleanString(value) || null;

const nullableNumber = (value: unknown) => {
  if (value === undefined || value === null || value === "") return null;
  const numericValue =
    typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  return Number.isFinite(numericValue) ? numericValue : null;
};

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

const splitTags = (value: unknown) =>
  cleanString(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const pickSingle = (value: any) => (Array.isArray(value) ? value[0] : value);

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

export default function RecruitmentModule({
  view,
  applicationId,
}: RecruitmentModuleProps) {
  const [role, setRole] = useState<"ADMIN" | "RH">("RH");
  const [currentUserId, setCurrentUserId] = useState("");
  const [data, setData] = useState<any>({});
  const [catalogs, setCatalogs] = useState<any>({
    accounts: [],
    stores: [],
    accountStores: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [vacancyForm, setVacancyForm] = useState({ ...emptyVacancy });
  const [candidateForm, setCandidateForm] = useState({ ...emptyCandidate });
  const [applicationForm, setApplicationForm] = useState({
    candidateId: "",
    vacancyId: "",
    source: "OTHER",
    sourceDetail: "",
  });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [templateForm, setTemplateForm] = useState({
    id: "",
    name: "",
    channel: "WHATSAPP",
    body: "",
  });
  const [detailForms, setDetailForms] = useState({
    contact: {
      channel: "WHATSAPP",
      direction: "OUTBOUND",
      result: "ASKS_INFO",
      summary: "",
      nextAction: "",
      commitmentAt: "",
    },
    interview: {
      interviewType: "EDVA",
      interviewer: "",
      scheduledAt: "",
      modality: "CALL",
      placeOrLink: "",
      status: "SCHEDULED",
      internalComments: "",
      clientShareableSummary: "",
    },
    evaluation: {
      recommendation: "ADVANCE",
      professionalSummary: "",
      strengths: "",
      developmentAreas: "",
      justification: "",
    },
    client: {
      sentAt: "",
      recipientName: "",
      channel: "EMAIL",
      sharedSummary: "",
      commitmentAt: "",
      status: "PENDING",
      clientComments: "",
    },
    offer: {
      salary: "",
      salaryPeriod: "MONTHLY",
      salaryTaxType: "NET",
      commissions: "",
      bonuses: "",
      schedule: "",
      restDays: "",
      benefits: "",
      storeName: "",
      proposedStartDate: "",
      expectedResponseAt: "",
      status: "PENDING",
    },
    task: {
      title: "",
      dueAt: "",
      comment: "",
    },
  });

  const nav = [
    { href: "/rh/recruitment", label: "Panel" },
    { href: "/rh/recruitment/vacancies", label: "Vacantes" },
    { href: "/rh/recruitment/candidates", label: "Candidatos" },
    { href: "/rh/recruitment/applications", label: "Postulaciones" },
  ];

  const addEvent = useCallback(
    async (payload: Record<string, unknown>) => {
      await supabase.from("recruitment_events").insert({
        application_id: payload.applicationId || null,
        candidate_id: payload.candidateId || null,
        vacancy_id: payload.vacancyId || null,
        event_type: payload.eventType,
        actor_id: currentUserId || null,
        actor_role: role,
        previous_stage: payload.previousStage || null,
        new_stage: payload.newStage || null,
        previous_status: payload.previousStatus || null,
        new_status: payload.newStatus || null,
        comment: payload.comment || null,
        next_action_party: payload.nextActionParty || null,
        commitment_at: payload.commitmentAt || null,
        metadata: payload.metadata || {},
      });
    },
    [currentUserId, role]
  );

  const closeOpenIntervals = async (id: string) => {
    const now = new Date().toISOString();
    await supabase
      .from("recruitment_stage_intervals")
      .update({ ended_at: now })
      .eq("application_id", id)
      .is("ended_at", null);
    await supabase
      .from("recruitment_responsibility_intervals")
      .update({ ended_at: now })
      .eq("application_id", id)
      .is("ended_at", null);
  };

  const openIntervals = async (
    id: string,
    stage: string,
    responsibleParty: string
  ) => {
    const now = new Date().toISOString();
    await supabase
      .from("recruitment_stage_intervals")
      .insert({ application_id: id, stage, started_at: now });
    await supabase.from("recruitment_responsibility_intervals").insert({
      application_id: id,
      responsible_party: responsibleParty,
      started_at: now,
    });
  };

  const setAutomaticStage = async (
    applicationId: string,
    newStage: string,
    nextActionParty: string,
    userId: string,
    comment: string
  ) => {
    const { data: current, error: currentError } = await supabase
      .from("recruitment_applications")
      .select("*")
      .eq("id", applicationId)
      .single();

    if (
      currentError ||
      !current ||
      current.stage === newStage ||
      isStageAtLeast(current.stage, newStage)
    ) {
      return;
    }

    const newStatus =
      newStage === "CONTRATADO"
        ? "COMPLETADO"
        : newStage === "CERRADO"
          ? "CERRADO"
          : "ACTIVO";

    await closeOpenIntervals(applicationId);

    await supabase
      .from("recruitment_applications")
      .update({
        stage: newStage,
        process_status: newStatus,
        next_action_party: nextActionParty,
        next_action: null,
        commitment_at: null,
        lock_version: Number(current.lock_version || 1) + 1,
        updated_by: userId,
      })
      .eq("id", applicationId);

    await openIntervals(applicationId, newStage, nextActionParty);
    await addEvent({
      applicationId,
      candidateId: current.candidate_id,
      vacancyId: current.vacancy_id,
      eventType: "ETAPA_AUTOMATICA",
      previousStage: current.stage,
      newStage,
      previousStatus: current.process_status,
      newStatus,
      nextActionParty,
      comment,
    });
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;

    if (!userId) {
      setMessageType("error");
      setMessage("Tu sesion expiro. Inicia sesion nuevamente.");
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (profile?.role === "ADMIN") setRole("ADMIN");
    if (profile?.role === "RH") setRole("RH");
    setCurrentUserId(userId);

    const [accountsResult, storesResult, accountStoresResult] = await Promise.all([
      supabase.from("accounts").select("id, name").eq("active", true).order("name"),
      supabase
        .from("stores")
        .select("id, name, chain_name, brand_name, address")
        .eq("active", true)
        .order("name"),
      supabase
        .from("account_stores")
        .select("account_id, store_id, stores:store_id(id, name, chain_name, brand_name, address)"),
    ]);

    const catalogData = {
      accounts: accountsResult.data || [],
      stores: storesResult.data || [],
      accountStores: (accountStoresResult.data || []).map((row: any) => ({
        account_id: row.account_id,
        store_id: row.store_id,
        store: pickSingle(row.stores),
      })),
    };

    setCatalogs(catalogData);

    const result: any = {};
    const [
      vacanciesResult,
      candidatesResult,
      applicationsResult,
      tasksResult,
      templatesResult,
    ] = await Promise.all([
      supabase
        .from("recruitment_vacancies")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("recruitment_candidates")
        .select("*")
        .eq("archived", false)
        .order("created_at", { ascending: false }),
      supabase
        .from("recruitment_applications")
        .select("*, candidate:recruitment_candidates(*), vacancy:recruitment_vacancies(*)")
        .order("updated_at", { ascending: false }),
      supabase
        .from("recruitment_tasks")
        .select("*")
        .eq("status", "PENDING")
        .order("due_at", { ascending: true }),
      supabase
        .from("recruitment_message_templates")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);

    const loadError =
      vacanciesResult.error ||
      candidatesResult.error ||
      applicationsResult.error ||
      tasksResult.error ||
      templatesResult.error;

    if (loadError) {
      setMessageType("error");
      setMessage(loadError.message || "No fue posible cargar reclutamiento.");
      setLoading(false);
      return;
    }

    result.vacancies = vacanciesResult.data || [];
    result.candidates = candidatesResult.data || [];
    result.applications = applicationsResult.data || [];
    result.tasks = tasksResult.data || [];
    result.templates = templatesResult.data || [];
    result.stats = {
      openVacancies: result.vacancies.filter((vacancy: any) => vacancy.status === "OPEN").length,
      activeApplications: result.applications.filter(
        (application: any) => application.process_status === "ACTIVO"
      ).length,
      clientWaiting: result.applications.filter(
        (application: any) => application.next_action_party === "CLIENTE"
      ).length,
      hired: result.applications.filter(
        (application: any) => application.stage === "CONTRATADO"
      ).length,
    };

    if (view === "settings") {
      const versionsResult = await supabase
        .from("recruitment_questionnaire_versions")
        .select("*, template:recruitment_questionnaire_templates(*)")
        .order("created_at", { ascending: false });

      if (versionsResult.error) {
        setMessageType("error");
        setMessage(versionsResult.error.message);
        setLoading(false);
        return;
      }

      result.questionnaireVersions = versionsResult.data || [];
      result.messageTemplates = result.templates;
    }

    if (view === "application" && applicationId) {
      const [
        application,
        contacts,
        interviews,
        responses,
        evaluations,
        clientReviews,
        offers,
        detailTasks,
        documents,
        events,
        questionnaireVersion,
      ] = await Promise.all([
        supabase
          .from("recruitment_applications")
          .select("*, candidate:recruitment_candidates(*), vacancy:recruitment_vacancies(*)")
          .eq("id", applicationId)
          .single(),
        supabase
          .from("recruitment_contacts")
          .select("*")
          .eq("application_id", applicationId)
          .order("occurred_at", { ascending: false }),
        supabase
          .from("recruitment_interviews")
          .select("*")
          .eq("application_id", applicationId)
          .order("scheduled_at", { ascending: false }),
        supabase
          .from("recruitment_questionnaire_responses")
          .select("*, version:recruitment_questionnaire_versions(*)")
          .eq("application_id", applicationId)
          .order("created_at", { ascending: false }),
        supabase
          .from("recruitment_evaluations")
          .select("*")
          .eq("application_id", applicationId)
          .order("evaluated_at", { ascending: false }),
        supabase
          .from("recruitment_client_reviews")
          .select("*")
          .eq("application_id", applicationId)
          .order("created_at", { ascending: false }),
        supabase
          .from("recruitment_offers")
          .select("*")
          .eq("application_id", applicationId)
          .order("created_at", { ascending: false }),
        supabase
          .from("recruitment_tasks")
          .select("*")
          .eq("application_id", applicationId)
          .order("due_at", { ascending: true }),
        supabase
          .from("recruitment_document_checklist")
          .select("*")
          .eq("application_id", applicationId)
          .order("created_at", { ascending: true }),
        supabase
          .from("recruitment_events")
          .select("*")
          .eq("application_id", applicationId)
          .order("occurred_at", { ascending: false }),
        supabase
          .from("recruitment_questionnaire_versions")
          .select("*")
          .eq("status", "ACTIVE")
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (application.error) {
        setMessageType("error");
        setMessage(application.error.message);
        setLoading(false);
        return;
      }

      result.application = application.data;
      result.contacts = contacts.data || [];
      result.interviews = interviews.data || [];
      result.responses = responses.data || [];
      result.evaluations = evaluations.data || [];
      result.clientReviews = clientReviews.data || [];
      result.offers = offers.data || [];
      result.tasks = detailTasks.data || [];
      result.documents = documents.data || [];
      result.events = events.data || [];
      result.questionnaireVersion = questionnaireVersion.data || null;
    }

    setData(result);

    if (result.application) {
      const currentResponse = result.responses?.[0];
      if (currentResponse?.answers) setAnswers(currentResponse.answers);
    }

    if (result.messageTemplates?.[0]) {
      const template = result.messageTemplates[0];
      setTemplateForm({
        id: template.id || "",
        name: template.name || "",
        channel: template.channel || "WHATSAPP",
        body: template.body || "",
      });
    }

    setLoading(false);
    } catch (error) {
      console.error("Error de conexion en reclutamiento:", error);
      setMessageType("error");
      setMessage(
        "No se pudo conectar con Supabase. Revisa tu conexion a internet y vuelve a intentar."
      );
      setLoading(false);
    }
  }, [view, applicationId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const postAction = async (payload: Record<string, unknown>) => {
    setSaving(true);
    setMessage("");

    let userId = "";

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      userId = sessionData.session?.user.id || "";
    } catch (error) {
      console.error("Error de sesion en reclutamiento:", error);
      setMessageType("error");
      setMessage(
        "No se pudo conectar con Supabase. Revisa tu conexion a internet y vuelve a intentar."
      );
      setSaving(false);
      return false;
    }

    if (!userId) {
      setMessageType("error");
      setMessage("Tu sesion expiro. Inicia sesion nuevamente.");
      setSaving(false);
      return false;
    }

    const fail = (error: unknown) => {
      setMessageType("error");
      setMessage(
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "No fue posible guardar."
      );
      setSaving(false);
      return false;
    };

    try {
      const action = cleanString(payload.action);

      if (action === "createVacancy") {
        const title = cleanString(payload.title);
        const accountName = cleanString(payload.accountName);
        const state = cleanString(payload.state);
        const city = cleanString(payload.city);
        const positionsTotal = nullableNumber(payload.positionsTotal);

        if (!title || !accountName || !state || !city || !positionsTotal) {
          return fail("Faltan datos obligatorios de la vacante.");
        }

        const { data: vacancy, error } = await supabase
          .from("recruitment_vacancies")
          .insert({
            title,
            account_id: nullableString(payload.accountId),
            account_name: accountName,
            brand: nullableString(payload.brand),
            chain_name: nullableString(payload.chainName),
            store_id: nullableString(payload.storeId),
            store_name: nullableString(payload.storeName),
            state,
            city,
            city_normalized: normalizeText(city),
            work_location: nullableString(payload.workLocation),
            positions_total: positionsTotal,
            description: nullableString(payload.description),
            functions: nullableString(payload.functions),
            required_experience: nullableString(payload.requiredExperience),
            desirable_experience: nullableString(payload.desirableExperience),
            salary_base: nullableNumber(payload.salaryBase),
            salary_period: cleanString(payload.salaryPeriod) || "MONTHLY",
            salary_tax_type: cleanString(payload.salaryTaxType) || "NET",
            commission_type: cleanString(payload.commissionType) || "NONE",
            commission_value: nullableNumber(payload.commissionValue),
            commission_explanation: nullableString(payload.commissionExplanation),
            bonuses: nullableString(payload.bonuses),
            benefits: nullableString(payload.benefits),
            work_schedule: nullableString(payload.workSchedule),
            work_days: nullableString(payload.workDays),
            rest_days: nullableString(payload.restDays),
            target_fill_date: nullableString(payload.targetFillDate),
            priority: cleanString(payload.priority) || "NORMAL",
            client_contact_name: nullableString(payload.clientContactName),
            client_contact_email: nullableString(payload.clientContactEmail),
            client_contact_phone: nullableString(payload.clientContactPhone),
            requires_client_authorization: Boolean(
              payload.requiresClientAuthorization
            ),
            status: cleanString(payload.status) || "DRAFT",
            internal_notes: nullableString(payload.internalNotes),
            created_by: userId,
            updated_by: userId,
          })
          .select()
          .single();

        if (error) return fail(error.message);
        await addEvent({
          vacancyId: vacancy.id,
          eventType: "VACANTE_CREADA",
          newStatus: vacancy.status,
          comment: "Vacante creada.",
        });
      }

      if (action === "createCandidate") {
        const fullName = cleanString(payload.fullName);
        const phoneNormalized = normalizePhone(payload.phone);
        const city = cleanString(payload.city);
        const state = cleanString(payload.state);
        const email = nullableString(payload.email);

        if (!fullName || !phoneNormalized || !city || !state) {
          return fail("Faltan datos obligatorios del candidato.");
        }

        const duplicateQuery = supabase
          .from("recruitment_candidates")
          .select("id, full_name")
          .eq("archived", false)
          .or(
            `phone_normalized.eq.${phoneNormalized}${
              email ? `,email_normalized.eq.${email.toLowerCase()}` : ""
            }`
          )
          .limit(1)
          .maybeSingle();

        const { data: duplicate } = await duplicateQuery;

        if (duplicate) {
          return fail(`Ya existe un candidato con esos datos: ${duplicate.full_name}.`);
        }

        const { data: candidate, error } = await supabase
          .from("recruitment_candidates")
          .insert({
            full_name: fullName,
            phone: cleanString(payload.phone),
            phone_normalized: phoneNormalized,
            email,
            email_normalized: email?.toLowerCase() || null,
            state,
            city,
            city_normalized: normalizeText(city),
            municipality: nullableString(payload.municipality),
            experience_summary: nullableString(payload.experienceSummary),
            last_position: nullableString(payload.lastPosition),
            last_company: nullableString(payload.lastCompany),
            sales_experience: nullableString(payload.salesExperience),
            sectors: splitTags(payload.sectors),
            availability_start: nullableString(payload.availabilityStart),
            expected_salary: nullableNumber(payload.expectedSalary),
            expected_salary_period: nullableString(payload.expectedSalaryPeriod),
            tags: splitTags(payload.tags),
            initial_comment: nullableString(payload.initialComment),
            privacy_notice_presented: Boolean(payload.privacyNoticePresented),
            privacy_notice_version: nullableString(payload.privacyNoticeVersion),
            privacy_notice_presented_at: payload.privacyNoticePresented
              ? new Date().toISOString()
              : null,
            future_contact_consent:
              cleanString(payload.futureContactConsent) || "NOT_ASKED",
            created_by: userId,
            updated_by: userId,
          })
          .select()
          .single();

        if (error) return fail(error.message);
        await addEvent({
          candidateId: candidate.id,
          eventType: "CANDIDATO_CREADO",
          comment: "Candidato creado.",
        });
      }

      if (action === "createApplication") {
        const candidateId = cleanString(payload.candidateId);
        const vacancyId = cleanString(payload.vacancyId);

        if (!candidateId || !vacancyId) {
          return fail("Selecciona candidato y vacante.");
        }

        const { data: application, error } = await supabase
          .from("recruitment_applications")
          .insert({
            candidate_id: candidateId,
            vacancy_id: vacancyId,
            source: cleanString(payload.source) || "OTHER",
            source_detail: nullableString(payload.sourceDetail),
            owner_id: userId,
            created_by: userId,
            updated_by: userId,
          })
          .select()
          .single();

        if (error) return fail(error.message);
        await openIntervals(
          application.id,
          application.stage,
          application.next_action_party
        );
        await addEvent({
          applicationId: application.id,
          candidateId,
          vacancyId,
          eventType: "POSTULACION_CREADA",
          newStage: application.stage,
          newStatus: application.process_status,
          nextActionParty: application.next_action_party,
          comment: "Postulacion creada.",
        });
        await supabase.from("recruitment_document_checklist").insert(
          [
            "Identificacion oficial",
            "CURP",
            "RFC",
            "NSS",
            "Comprobante de domicilio",
            "Cuenta bancaria / CLABE",
          ].map((documentName) => ({
            application_id: application.id,
            document_name: documentName,
            created_by: userId,
          }))
        );
      }

      if (action === "changeStage") {
        const id = cleanString(payload.applicationId);
        const stage = cleanString(payload.stage);
        const nextActionParty = cleanString(payload.nextActionParty) || "EDVA";

        if (!id || !stage) return fail("Selecciona la etapa.");

        const { data: current, error: currentError } = await supabase
          .from("recruitment_applications")
          .select("*")
          .eq("id", id)
          .single();

        if (currentError || !current) return fail("No se encontro la postulacion.");

        const processStatus =
          stage === "CERRADO"
            ? "CERRADO"
            : stage === "CONTRATADO"
              ? "COMPLETADO"
              : current.process_status;

        if (processStatus === "CERRADO" && !cleanString(payload.closeReason)) {
          return fail("Indica el motivo de cierre.");
        }

        await closeOpenIntervals(id);

        const { error } = await supabase
          .from("recruitment_applications")
          .update({
            stage,
            process_status: processStatus,
            close_result: nullableString(payload.closeResult),
            close_reason: nullableString(payload.closeReason),
            next_action_party: nextActionParty,
            next_action: nullableString(payload.nextAction),
            commitment_at: nullableString(payload.commitmentAt),
            lock_version: Number(current.lock_version || 1) + 1,
            updated_by: userId,
          })
          .eq("id", id);

        if (error) return fail(error.message);
        await openIntervals(
          id,
          stage,
          processStatus === "CERRADO" ? "PAUSADO" : nextActionParty
        );
        await addEvent({
          applicationId: id,
          candidateId: current.candidate_id,
          vacancyId: current.vacancy_id,
          eventType: "CAMBIO_ETAPA",
          previousStage: current.stage,
          newStage: stage,
          previousStatus: current.process_status,
          newStatus: processStatus,
          nextActionParty,
          commitmentAt: nullableString(payload.commitmentAt),
          comment: nullableString(payload.comment),
        });
      }

      if (action === "addContact") {
        const applicationId = cleanString(payload.applicationId);
        const { error } = await supabase.from("recruitment_contacts").insert({
          application_id: applicationId,
          channel: cleanString(payload.channel) || "WHATSAPP",
          direction: cleanString(payload.direction) || "OUTBOUND",
          occurred_at: new Date().toISOString(),
          result: cleanString(payload.result) || "ASKS_INFO",
          summary: nullableString(payload.summary),
          next_action: nullableString(payload.nextAction),
          owner_id: userId,
          commitment_at: nullableString(payload.commitmentAt),
          created_by: userId,
        });
        if (error) return fail(error.message);
        await addEvent({
          applicationId,
          eventType: "CONTACTO_REGISTRADO",
          comment: nullableString(payload.summary),
        });
        await setAutomaticStage(
          applicationId,
          "CONTACTO_INICIAL",
          "EDVA",
          userId,
          "Contacto inicial capturado."
        );
      }

      if (action === "addInterview") {
        const applicationId = cleanString(payload.applicationId);
        const { error } = await supabase.from("recruitment_interviews").insert({
          application_id: applicationId,
          interview_type: cleanString(payload.interviewType) || "EDVA",
          interviewer: cleanString(payload.interviewer),
          scheduled_at: cleanString(payload.scheduledAt),
          modality: cleanString(payload.modality) || "CALL",
          place_or_link: nullableString(payload.placeOrLink),
          status: cleanString(payload.status) || "SCHEDULED",
          internal_comments: nullableString(payload.internalComments),
          client_shareable_summary: nullableString(payload.clientShareableSummary),
          created_by: userId,
          updated_by: userId,
        });
        if (error) return fail(error.message);
        await addEvent({ applicationId, eventType: "ENTREVISTA_REGISTRADA" });
      }

      if (action === "saveQuestionnaire") {
        const applicationId = cleanString(payload.applicationId);
        const versionId = cleanString(payload.versionId);
        const { error } = await supabase
          .from("recruitment_questionnaire_responses")
          .upsert(
            {
              application_id: applicationId,
              version_id: versionId,
              answers: payload.answers || {},
              status: cleanString(payload.status) || "DRAFT",
              finalized_at:
                cleanString(payload.status) === "FINALIZED"
                  ? new Date().toISOString()
                  : null,
              created_by: userId,
              updated_by: userId,
            },
            { onConflict: "application_id,version_id" }
          );
        if (error) return fail(error.message);
        await addEvent({ applicationId, eventType: "CUESTIONARIO_GUARDADO" });
        await setAutomaticStage(
          applicationId,
          "PRE_FILTRO",
          "EDVA",
          userId,
          "Cuestionario EDVA Talent Score finalizado."
        );
      }

      if (action === "addEvaluation") {
        const applicationId = cleanString(payload.applicationId);
        const { error } = await supabase.from("recruitment_evaluations").insert({
          application_id: applicationId,
          dimensions: {},
          strengths: nullableString(payload.strengths),
          development_areas: nullableString(payload.developmentAreas),
          recommendation: nullableString(payload.recommendation),
          justification: nullableString(payload.justification),
          professional_summary: nullableString(payload.professionalSummary),
          evaluator_id: userId,
        });
        if (error) return fail(error.message);
        await addEvent({ applicationId, eventType: "EVALUACION_REGISTRADA" });
        await setAutomaticStage(
          applicationId,
          "EVALUACION",
          "EDVA",
          userId,
          "Evaluacion EDVA registrada."
        );
      }

      if (action === "addClientReview") {
        const applicationId = cleanString(payload.applicationId);
        const { error } = await supabase.from("recruitment_client_reviews").insert({
          application_id: applicationId,
          sent_at: nullableString(payload.sentAt),
          recipient_name: nullableString(payload.recipientName),
          channel: nullableString(payload.channel),
          shared_summary: nullableString(payload.sharedSummary),
          commitment_at: nullableString(payload.commitmentAt),
          status: cleanString(payload.status) || "PENDING",
          client_comments: nullableString(payload.clientComments),
          created_by: userId,
        });
        if (error) return fail(error.message);
        await addEvent({ applicationId, eventType: "REVISION_CLIENTE_REGISTRADA" });
        await setAutomaticStage(
          applicationId,
          "ENVIADO_CLIENTE",
          "CLIENTE",
          userId,
          "Revision de cliente registrada."
        );
      }

      if (action === "addOffer") {
        const applicationId = cleanString(payload.applicationId);
        const { data: offer, error } = await supabase
          .from("recruitment_offers")
          .insert({
            application_id: applicationId,
            salary: nullableNumber(payload.salary),
            salary_period: nullableString(payload.salaryPeriod),
            salary_tax_type: nullableString(payload.salaryTaxType),
            commissions: nullableString(payload.commissions),
            bonuses: nullableString(payload.bonuses),
            schedule: nullableString(payload.schedule),
            rest_days: nullableString(payload.restDays),
            benefits: nullableString(payload.benefits),
            store_name: nullableString(payload.storeName),
            proposed_start_date: nullableString(payload.proposedStartDate),
            expected_response_at: nullableString(payload.expectedResponseAt),
            status: cleanString(payload.status) || "PENDING",
            created_by: userId,
          })
          .select()
          .single();
        if (error) return fail(error.message);
        await supabase
          .from("recruitment_applications")
          .update({
            offered_salary: offer.salary,
            offered_salary_period: offer.salary_period,
            offered_commission: offer.commissions,
            offered_bonuses: offer.bonuses,
            offered_schedule: offer.schedule,
            offered_rest_days: offer.rest_days,
            offer_snapshot_at: new Date().toISOString(),
            expected_start_date: offer.proposed_start_date,
            updated_by: userId,
          })
          .eq("id", applicationId);
        await addEvent({ applicationId, eventType: "OFERTA_REGISTRADA" });
        await setAutomaticStage(
          applicationId,
          "OFERTA",
          "CANDIDATO",
          userId,
          "Oferta registrada."
        );
      }

      if (action === "addTask") {
        const { error } = await supabase.from("recruitment_tasks").insert({
          application_id: nullableString(payload.applicationId),
          title: cleanString(payload.title),
          owner_id: userId,
          due_at: nullableString(payload.dueAt),
          comment: nullableString(payload.comment),
          created_by: userId,
        });
        if (error) return fail(error.message);
        await setAutomaticStage(
          cleanString(payload.applicationId),
          "DOCUMENTACION",
          "EDVA",
          userId,
          "Tarea registrada para documentacion o seguimiento."
        );
      }

      if (action === "resetProcess") {
        const applicationId = cleanString(payload.applicationId);
        if (!applicationId) return fail("Falta la postulacion.");

        const rpcResult = await supabase.rpc("recruitment_reset_application", {
          p_application_id: applicationId,
          p_reason:
            nullableString(payload.reason) ||
            "Proceso reiniciado desde EDVA Control App.",
        });

        if (!rpcResult.error) {
          setAnswers({});
          setMessageType("success");
          setMessage("Proceso reiniciado correctamente.");
          setSaving(false);
          await loadData();
          return true;
        }

        if (!rpcResult.error.message.includes("recruitment_reset_application")) {
          return fail(rpcResult.error.message);
        }

        const { error: currentError } = await supabase
          .from("recruitment_applications")
          .select("id")
          .eq("id", applicationId)
          .single();

        if (currentError) {
          return fail("No se encontro la postulacion.");
        }

        const tablesToClear = [
          "recruitment_contacts",
          "recruitment_interviews",
          "recruitment_questionnaire_responses",
          "recruitment_evaluations",
          "recruitment_client_reviews",
          "recruitment_offers",
          "recruitment_document_checklist",
          "recruitment_tasks",
          "recruitment_stage_intervals",
          "recruitment_responsibility_intervals",
          "recruitment_events",
        ];

        for (const tableName of tablesToClear) {
          const { error } = await supabase
            .from(tableName)
            .delete()
            .eq("application_id", applicationId);

          if (error) return fail(error.message);
        }

        const { error } = await supabase
          .from("recruitment_applications")
          .update({
            stage: "POSTULACION_RECIBIDA",
            process_status: "ACTIVO",
            close_result: null,
            close_reason: null,
            next_action_party: "EDVA",
            next_action: null,
            commitment_at: null,
            offered_salary: null,
            offered_salary_period: null,
            offered_commission: null,
            offered_bonuses: null,
            offered_schedule: null,
            offered_rest_days: null,
            offer_snapshot_at: null,
            expected_start_date: null,
            actual_start_date: null,
            linked_employee_id: null,
            lock_version: 1,
            updated_by: userId,
          })
          .eq("id", applicationId);

        if (error) return fail(error.message);

        await openIntervals(applicationId, "POSTULACION_RECIBIDA", "EDVA");
        await supabase.from("recruitment_document_checklist").insert(
          [
            "Identificacion oficial",
            "CURP",
            "RFC",
            "NSS",
            "Comprobante de domicilio",
            "Cuenta bancaria / CLABE",
          ].map((documentName) => ({
            application_id: applicationId,
            document_name: documentName,
            created_by: userId,
          }))
        );
        setAnswers({});
      }

      if (action === "saveMessageTemplate") {
        const templateId = cleanString(payload.id);
        const templatePayload = {
          name: cleanString(payload.name),
          channel: cleanString(payload.channel) || "WHATSAPP",
          body: cleanString(payload.body),
          active: true,
          updated_by: userId,
        };

        if (!templatePayload.name || !templatePayload.body) {
          return fail("Falta nombre o mensaje de la plantilla.");
        }

        const result = templateId
          ? await supabase
              .from("recruitment_message_templates")
              .update(templatePayload)
              .eq("id", templateId)
          : await supabase
              .from("recruitment_message_templates")
              .insert({ ...templatePayload, created_by: userId });

        if (result.error) return fail(result.error.message);
      }
    } catch (error) {
      return fail(error);
    }

    setMessageType("success");
    setMessage("Guardado correctamente.");
    setSaving(false);
    await loadData();
    return true;
  };

  const vacancies = useMemo(() => data.vacancies || [], [data.vacancies]);
  const candidates = useMemo(() => data.candidates || [], [data.candidates]);
  const applications = useMemo(
    () => data.applications || [],
    [data.applications]
  );
  const activeVacancies = useMemo(
    () => vacancies.filter((vacancy: any) => vacancy.status !== "CANCELLED"),
    [vacancies]
  );

  const content = () => {
    if (loading) return <Panel title="Cargando">Preparando reclutamiento...</Panel>;
    if (view === "vacancies") return renderVacancies();
    if (view === "candidates") return renderCandidates();
    if (view === "applications") return renderApplications();
    if (view === "application") return renderApplicationDetail();
    if (view === "settings") return renderSettings();
    return renderDashboard();
  };

  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Stat title="Vacantes abiertas" value={data.stats?.openVacancies || 0} />
        <Stat title="Postulaciones activas" value={data.stats?.activeApplications || 0} />
        <Stat title="Esperando cliente" value={data.stats?.clientWaiting || 0} />
        <Stat title="Contratados" value={data.stats?.hired || 0} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Panel title="Alta rapida de candidato">
          <CandidateForm
            form={candidateForm}
            setForm={setCandidateForm}
            onSubmit={async () => {
              const ok = await postAction({
                action: "createCandidate",
                ...candidateForm,
              });
              if (ok) setCandidateForm({ ...emptyCandidate });
            }}
            saving={saving}
          />
        </Panel>

        <Panel title="Crear postulacion">
          <div className="grid grid-cols-1 gap-4">
            <Select
              label="Candidato"
              value={applicationForm.candidateId}
              onChange={(value) =>
                setApplicationForm((current) => ({ ...current, candidateId: value }))
              }
              options={candidates.map((candidate: any) => ({
                value: candidate.id,
                label: `${candidate.full_name} - ${candidate.phone_normalized}`,
              }))}
            />
            <Select
              label="Vacante"
              value={applicationForm.vacancyId}
              onChange={(value) =>
                setApplicationForm((current) => ({ ...current, vacancyId: value }))
              }
              options={activeVacancies.map((vacancy: any) => ({
                value: vacancy.id,
                label: `${vacancy.title} - ${vacancy.account_name}`,
              }))}
            />
            <Select
              label="Fuente"
              value={applicationForm.source}
              onChange={(value) =>
                setApplicationForm((current) => ({ ...current, source: value }))
              }
              options={[
                { value: "INDEED", label: "Indeed" },
                { value: "FACEBOOK", label: "Facebook" },
                { value: "WHATSAPP", label: "WhatsApp" },
                { value: "REFERRED", label: "Referido" },
                { value: "INTERNAL_JOB_BOARD", label: "Bolsa interna" },
                { value: "OTHER", label: "Otro" },
              ]}
            />
            <Input
              label="Detalle de fuente"
              value={applicationForm.sourceDetail}
              onChange={(value) =>
                setApplicationForm((current) => ({ ...current, sourceDetail: value }))
              }
            />
            <button
              type="button"
              className={redButton}
              disabled={saving}
              onClick={async () => {
                const ok = await postAction({
                  action: "createApplication",
                  ...applicationForm,
                });
                if (ok) {
                  setApplicationForm({
                    candidateId: "",
                    vacancyId: "",
                    source: "OTHER",
                    sourceDetail: "",
                  });
                }
              }}
            >
              Crear postulacion
            </button>
          </div>
        </Panel>
      </div>

      <ApplicationsTable applications={applications} />
    </div>
  );

  const renderVacancies = () => (
    <div className="space-y-6">
      <Panel title="Nueva vacante">
        <VacancyForm
          form={vacancyForm}
          setForm={setVacancyForm}
          catalogs={catalogs}
          saving={saving}
          onSubmit={async () => {
            const ok = await postAction({ action: "createVacancy", ...vacancyForm });
            if (ok) setVacancyForm({ ...emptyVacancy });
          }}
        />
      </Panel>

      <Panel title="Vacantes">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-3">Vacante</th>
                <th>Cuenta</th>
                <th>Ciudad</th>
                <th>Estatus</th>
                <th>Prioridad</th>
                <th>Plazas</th>
              </tr>
            </thead>
            <tbody>
              {vacancies.map((vacancy: any) => (
                <tr key={vacancy.id} className="border-b">
                  <td className="py-3 font-semibold">{vacancy.title}</td>
                  <td>{vacancy.account_name}</td>
                  <td>{vacancy.city}</td>
                  <td>{vacancy.status}</td>
                  <td>{vacancy.priority}</td>
                  <td>{vacancy.positions_total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );

  const renderCandidates = () => (
    <div className="space-y-6">
      <Panel title="Nuevo candidato">
        <CandidateForm
          form={candidateForm}
          setForm={setCandidateForm}
          saving={saving}
          onSubmit={async () => {
            const ok = await postAction({ action: "createCandidate", ...candidateForm });
            if (ok) setCandidateForm({ ...emptyCandidate });
          }}
        />
      </Panel>

      <Panel title="Candidatos">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-3">Nombre</th>
                <th>Telefono</th>
                <th>Correo</th>
                <th>Ciudad</th>
                <th>Experiencia</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((candidate: any) => (
                <tr key={candidate.id} className="border-b">
                  <td className="py-3 font-semibold">{candidate.full_name}</td>
                  <td>{candidate.phone_normalized}</td>
                  <td>{candidate.email || "Sin correo"}</td>
                  <td>{candidate.city}</td>
                  <td>{candidate.last_position || candidate.sales_experience || "Pendiente"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );

  const renderApplications = () => (
    <div className="space-y-6">
      <ApplicationsTable applications={applications} />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {stages.slice(0, -1).map((stage) => (
          <Panel key={stage.value} title={stage.label}>
            <div className="space-y-3">
              {applications
                .filter((application: any) => application.stage === stage.value)
                .map((application: any) => (
                  <Link
                    key={application.id}
                    href={`/rh/recruitment/applications/${application.id}`}
                    className="block border rounded-lg p-3 hover:bg-neutral-50"
                  >
                    <p className="font-semibold text-neutral-900">
                      {application.candidate?.full_name || "Candidato"}
                    </p>
                    <p className="text-sm text-neutral-500">
                      {application.vacancy?.title || "Vacante"} ·{" "}
                      {application.next_action_party}
                    </p>
                  </Link>
                ))}
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );

  const generateEtsReport = (application: any, score: any) => {
    const rows = etsQuestions
      .map(
        (question) => `
          <tr>
            <td>${escapeHtml(question.section)}</td>
            <td>${escapeHtml(question.question)}</td>
            <td>${escapeHtml(answers[question.id] || "Pendiente")}</td>
            <td>${escapeHtml(answers[`${question.id}_comment`] || "")}</td>
            <td>${question.weight}</td>
          </tr>`
      )
      .join("");

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Reporte ETS</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 32px; color: #171717; }
            h1 { margin: 0 0 4px; }
            h2 { margin-top: 26px; border-bottom: 1px solid #ddd; padding-bottom: 8px; }
            .muted { color: #666; }
            .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 18px; }
            .box { border: 1px solid #ddd; border-radius: 8px; padding: 12px; }
            .label { color: #666; font-size: 12px; }
            .value { font-size: 18px; font-weight: 700; margin-top: 4px; }
            table { border-collapse: collapse; width: 100%; margin-top: 12px; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; vertical-align: top; }
            th { background: #f3f3f3; }
            @media print { button { display: none; } body { margin: 20px; } }
          </style>
        </head>
        <body>
          <button onclick="window.print()">Imprimir / guardar PDF</button>
          <h1>Ficha tecnica RH - EDVA Talent Score</h1>
          <p class="muted">Reporte generado desde EDVA Control App</p>

          <div class="grid">
            <div class="box"><div class="label">Candidato</div><div class="value">${escapeHtml(application.candidate?.full_name)}</div></div>
            <div class="box"><div class="label">Vacante</div><div class="value">${escapeHtml(application.vacancy?.title)}</div></div>
            <div class="box"><div class="label">Telefono</div><div class="value">${escapeHtml(application.candidate?.phone_normalized)}</div></div>
            <div class="box"><div class="label">Ciudad</div><div class="value">${escapeHtml(application.candidate?.city)}</div></div>
          </div>

          <h2>Resultado automatico</h2>
          <div class="grid">
            <div class="box"><div class="label">ETS Total</div><div class="value">${score.total}</div></div>
            <div class="box"><div class="label">Clasificacion</div><div class="value">${escapeHtml(score.classification)}</div></div>
            <div class="box"><div class="label">Recomendacion</div><div class="value">${escapeHtml(score.recommendation)}</div></div>
            <div class="box"><div class="label">Riesgo rotacion</div><div class="value">${escapeHtml(score.rotationRisk)}</div></div>
          </div>

          <h2>Viabilidad operativa</h2>
          <table>
            <thead><tr><th>Campo</th><th>Respuesta</th></tr></thead>
            <tbody>
              ${etsOperationalQuestions
                .map(
                  (question) =>
                    `<tr><td>${escapeHtml(question.label)}</td><td>${escapeHtml(
                      answers[question.id] || "Pendiente"
                    )}</td></tr>`
                )
                .join("")}
            </tbody>
          </table>

          <h2>Cuestionario comercial</h2>
          <table>
            <thead><tr><th>Seccion</th><th>Pregunta</th><th>Respuesta</th><th>Comentario RH</th><th>Peso</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>`;

    const reportWindow = window.open("", "_blank");
    if (!reportWindow) return;
    reportWindow.document.write(html);
    reportWindow.document.close();
  };

  const renderApplicationDetail = () => {
    const application = data.application;
    const questionnaire = data.questionnaireVersion;
    const etsScore = calculateEts(answers);
    const currentStage = application?.stage || "POSTULACION_RECIBIDA";
    const contactDone =
      (data.contacts || []).length > 0 ||
      isStageAtLeast(currentStage, "CONTACTO_INICIAL");
    const questionnaireDone = (data.responses || []).some(
      (response: any) => response.status === "FINALIZED"
    ) || isStageAtLeast(currentStage, "PRE_FILTRO");
    const evaluationDone =
      (data.evaluations || []).length > 0 ||
      isStageAtLeast(currentStage, "EVALUACION");
    const clientDone =
      (data.clientReviews || []).length > 0 ||
      isStageAtLeast(currentStage, "ENVIADO_CLIENTE");
    const offerDone =
      (data.offers || []).length > 0 ||
      isStageAtLeast(currentStage, "OFERTA");

    if (!application) {
      return <Panel title="Postulacion">No se encontro la postulacion.</Panel>;
    }

    return (
      <div className="space-y-6">
        <Panel title="Resumen">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Info label="Candidato" value={application.candidate?.full_name} />
            <Info label="Vacante" value={application.vacancy?.title} />
            <Info label="Etapa" value={stageLabels[application.stage] || application.stage} />
            <Info label="Responsable siguiente" value={application.next_action_party} />
            <Info label="Estatus" value={application.process_status} />
            <Info label="Telefono" value={application.candidate?.phone_normalized} />
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              className={smallButton}
              onClick={() => generateEtsReport(application, etsScore)}
            >
              Generar reporte ETS
            </button>
            <button
              type="button"
              className="bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
              disabled={saving}
              onClick={() => {
                const confirmed = window.confirm(
                  "Esto reiniciara el proceso y borrara contacto, cuestionario, evaluacion, revision cliente, oferta y tareas de esta postulacion. Deseas continuar?"
                );
                if (!confirmed) return;
                postAction({
                  action: "resetProcess",
                  applicationId: application.id,
                  reason: "Reinicio manual desde el modulo de reclutamiento.",
                });
              }}
            >
              Reiniciar todo el proceso
            </button>
          </div>
        </Panel>

        <Panel title="Etapa automatica">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Info
              label="Etapa actual"
              value={stageLabels[application.stage] || application.stage}
            />
            <Info
              label="Siguiente responsable"
              value={application.next_action_party}
            />
            <Info
              label="Como avanza"
              value="Se actualiza automaticamente al guardar cada paso."
            />
          </div>
        </Panel>

        <StepPanel
          number={1}
          title="Contacto inicial"
          done={contactDone}
          unlocked
        >
          <CompactForm
            fields={[
              ["Resumen del contacto", "summary"],
              ["Siguiente accion", "nextAction"],
              ["Compromiso", "commitmentAt", "datetime-local"],
            ]}
            values={detailForms.contact}
            setValues={(next) =>
              setDetailForms((current) => ({ ...current, contact: next }))
            }
            onSubmit={() =>
              postAction({
                action: "addContact",
                applicationId: application.id,
                ...detailForms.contact,
              })
            }
            saving={saving}
          />
          <MiniList rows={data.contacts || []} primary="summary" secondary="result" />
        </StepPanel>

        <StepPanel
          number={2}
          title="Cuestionario EDVA Talent Score"
          done={questionnaireDone}
          unlocked={contactDone}
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-5">
            <Stat title="ETS total" value={etsScore.total} />
            <Info label="Clasificacion" value={etsScore.classification} />
            <Info label="Recomendacion" value={etsScore.recommendation} />
            <Info label="Riesgo rotacion" value={etsScore.rotationRisk} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {etsOperationalQuestions.map((question) => (
              <Select
                key={question.id}
                label={question.label}
                value={answers[question.id] || ""}
                onChange={(value) =>
                  setAnswers((current) => ({ ...current, [question.id]: value }))
                }
                options={question.options.map(([label, score]) => ({
                  value: String(label),
                  label: `${label} (${score} pts)`,
                }))}
              />
            ))}
          </div>

          <div className="mt-6 space-y-4">
            {etsQuestions.map((question) => (
              <div key={question.id} className="border rounded-lg p-4 bg-neutral-50">
                <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.2fr] gap-4">
                  <div>
                    <p className="text-xs font-semibold text-red-600">
                      {question.section} · Peso {question.weight}
                    </p>
                    <p className="font-semibold text-neutral-900 mt-1">
                      {question.question}
                    </p>
                  </div>
                  <Select
                    label="Respuesta"
                    value={answers[question.id] || ""}
                    onChange={(value) =>
                      setAnswers((current) => ({ ...current, [question.id]: value }))
                    }
                    options={question.options.map(([label, score]) => ({
                      value: String(label),
                      label: `${label} (${score} pts)`,
                    }))}
                  />
                </div>
                <Input
                  label="Comentario RH"
                  value={answers[`${question.id}_comment`] || ""}
                  onChange={(value) =>
                    setAnswers((current) => ({
                      ...current,
                      [`${question.id}_comment`]: value,
                    }))
                  }
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            className={`${redButton} mt-5`}
            disabled={saving || !questionnaire}
            onClick={() =>
              postAction({
                action: "saveQuestionnaire",
                applicationId: application.id,
                versionId: questionnaire?.id,
                answers: { ...answers, _score: etsScore },
                status: "FINALIZED",
              })
            }
          >
            Guardar cuestionario y calificacion
          </button>
        </StepPanel>

        <StepPanel
          number={3}
          title="Evaluacion EDVA"
          done={evaluationDone}
          unlocked={questionnaireDone}
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-5">
            <Info label="ETS" value={`${etsScore.total} / 100`} />
            <Info label="Viabilidad" value={etsScore.viability} />
            <Info label="Clasificacion" value={etsScore.classification} />
            <Info label="Recomendacion" value={etsScore.recommendation} />
          </div>
          <CompactForm
            fields={[
              ["Resumen profesional", "professionalSummary"],
              ["Fortalezas", "strengths"],
              ["Riesgos detectados", "developmentAreas"],
              ["Comentario final", "justification"],
            ]}
            values={detailForms.evaluation}
            setValues={(next) =>
              setDetailForms((current) => ({ ...current, evaluation: next }))
            }
            onSubmit={() =>
              postAction({
                action: "addEvaluation",
                applicationId: application.id,
                ...detailForms.evaluation,
                recommendation:
                  etsScore.total >= 85
                    ? "ADVANCE"
                    : etsScore.total >= 70
                      ? "SECOND_INTERVIEW"
                      : etsScore.total >= 60
                        ? "CLARIFY_CONDITIONS"
                        : "DO_NOT_CONTINUE",
                professionalSummary:
                  detailForms.evaluation.professionalSummary ||
                  `${etsScore.classification}. ${etsScore.recommendation}. Viabilidad ${etsScore.viability}. Riesgo ${etsScore.rotationRisk}.`,
              })
            }
            saving={saving}
          />
          <MiniList rows={data.evaluations || []} primary="recommendation" secondary="professional_summary" />
        </StepPanel>

        <StepPanel
          number={4}
          title="Revision cliente"
          done={clientDone}
          unlocked={evaluationDone}
        >
          <CompactForm
            fields={[
              ["Enviado", "sentAt", "datetime-local"],
              ["Contacto cliente", "recipientName"],
              ["Resumen compartido", "sharedSummary"],
              ["Comentarios cliente", "clientComments"],
            ]}
            values={detailForms.client}
            setValues={(next) =>
              setDetailForms((current) => ({ ...current, client: next }))
            }
            onSubmit={() =>
              postAction({
                action: "addClientReview",
                applicationId: application.id,
                ...detailForms.client,
              })
            }
            saving={saving}
          />
          <MiniList rows={data.clientReviews || []} primary="status" secondary="client_comments" />
        </StepPanel>

        <StepPanel
          number={5}
          title="Oferta"
          done={offerDone}
          unlocked={clientDone}
        >
          <CompactForm
            fields={[
              ["Sueldo", "salary", "number"],
              ["Comisiones", "commissions"],
              ["Bonos", "bonuses"],
              ["Horario", "schedule"],
              ["Descansos", "restDays"],
              ["Inicio propuesto", "proposedStartDate", "date"],
            ]}
            values={detailForms.offer}
            setValues={(next) =>
              setDetailForms((current) => ({ ...current, offer: next }))
            }
            onSubmit={() =>
              postAction({
                action: "addOffer",
                applicationId: application.id,
                ...detailForms.offer,
              })
            }
            saving={saving}
          />
          <MiniList rows={data.offers || []} primary="status" secondary="salary" />
        </StepPanel>

        <StepPanel
          number={6}
          title="Tareas"
          done={(data.tasks || []).length > 0}
          unlocked={offerDone}
        >
          <CompactForm
            fields={[
              ["Tarea", "title"],
              ["Vence", "dueAt", "datetime-local"],
              ["Comentario", "comment"],
            ]}
            values={detailForms.task}
            setValues={(next) =>
              setDetailForms((current) => ({ ...current, task: next }))
            }
            onSubmit={() =>
              postAction({
                action: "addTask",
                applicationId: application.id,
                ...detailForms.task,
              })
            }
            saving={saving}
          />
          <MiniList rows={data.tasks || []} primary="title" secondary="status" />
        </StepPanel>

        <Panel title="Historial">
          <MiniList rows={data.events || []} primary="event_type" secondary="comment" />
        </Panel>
      </div>
    );
  };

  const renderSettings = () => (
    <div className="space-y-6">
      <Panel title="Plantilla de mensaje">
        <div className="grid grid-cols-1 gap-4">
          <Input
            label="Nombre"
            value={templateForm.name}
            onChange={(value) =>
              setTemplateForm((current) => ({ ...current, name: value }))
            }
          />
          <Textarea
            label="Mensaje"
            value={templateForm.body}
            onChange={(value) =>
              setTemplateForm((current) => ({ ...current, body: value }))
            }
          />
          <button
            type="button"
            className={redButton}
            disabled={saving}
            onClick={() => postAction({ action: "saveMessageTemplate", ...templateForm })}
          >
            Guardar plantilla
          </button>
        </div>
      </Panel>

      <Panel title="Cuestionarios activos">
        <MiniList
          rows={data.questionnaireVersions || []}
          primary="status"
          secondary="version"
        />
      </Panel>
    </div>
  );

  return (
    <main className="min-h-screen bg-neutral-100 flex">
      <Sidebar userName="Reclutamiento" role={role} />

      <section className="flex-1 p-8 overflow-x-hidden">
        <div className="max-w-7xl">
          <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-5 mb-6">
            <div>
              <h1 className="text-4xl font-bold text-neutral-800">
                Reclutamiento
              </h1>
              <p className="text-neutral-500 mt-2">
                Vacantes, candidatos, entrevistas, evaluaciones y seguimiento.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="bg-white hover:bg-neutral-50 border px-4 py-2 rounded-lg text-sm font-semibold text-neutral-800"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          {message && (
            <div
              className={`mb-5 rounded-lg p-4 text-sm font-medium ${
                messageType === "success"
                  ? "bg-green-50 text-green-800"
                  : "bg-red-50 text-red-800"
              }`}
            >
              {message}
            </div>
          )}

          {content()}
        </div>
      </section>
    </main>
  );
}

function VacancyForm({
  form,
  setForm,
  catalogs,
  onSubmit,
  saving,
}: {
  form: any;
  setForm: (value: any) => void;
  catalogs: any;
  onSubmit: () => void;
  saving: boolean;
}) {
  const update = (field: string, value: string | boolean) =>
    setForm((current: any) => ({ ...current, [field]: value }));

  const accountStores = form.accountId
    ? catalogs.accountStores.filter(
        (item: any) => item.account_id === form.accountId && item.store
      )
    : catalogs.stores.map((store: any) => ({ store_id: store.id, store }));

  const updateAccount = (accountId: string) => {
    const account = catalogs.accounts.find((item: any) => item.id === accountId);
    setForm((current: any) => ({
      ...current,
      accountId,
      accountName: account?.name || "",
      storeId: "",
      storeName: "",
      chainName: "",
      brand: "",
    }));
  };

  const updateStore = (storeId: string) => {
    const row = accountStores.find((item: any) => item.store_id === storeId);
    const store = row?.store;
    setForm((current: any) => ({
      ...current,
      storeId,
      storeName: store?.name || "",
      chainName: store?.chain_name || "",
      brand: store?.brand_name || "",
      workLocation: store?.address || current.workLocation,
    }));
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <Input label="Titulo" value={form.title} onChange={(value) => update("title", value)} required />
      <Select
        label="Cuenta existente"
        value={form.accountId}
        onChange={updateAccount}
        options={catalogs.accounts.map((account: any) => ({
          value: account.id,
          label: account.name,
        }))}
      />
      <Input
        label="Cuenta / cliente"
        value={form.accountName}
        onChange={(value) => update("accountName", value)}
        required
        placeholder="Puedes escribir una nueva si no existe"
      />
      <Select
        label="Tienda existente"
        value={form.storeId}
        onChange={updateStore}
        options={accountStores.map((item: any) => ({
          value: item.store.id,
          label: [
            item.store.name,
            item.store.chain_name,
            item.store.brand_name,
          ]
            .filter(Boolean)
            .join(" · "),
        }))}
      />
      <Input label="Cadena" value={form.chainName} onChange={(value) => update("chainName", value)} placeholder="Se llena con la tienda o captura una nueva" />
      <Input label="Marca" value={form.brand} onChange={(value) => update("brand", value)} placeholder="Se llena con la tienda o captura una nueva" />
      <Input label="Tienda" value={form.storeName} onChange={(value) => update("storeName", value)} placeholder="Puedes escribir una nueva si no existe" />
      <Input label="Estado" value={form.state} onChange={(value) => update("state", value)} required />
      <Input label="Ciudad" value={form.city} onChange={(value) => update("city", value)} required />
      <Input label="Zona o direccion" value={form.workLocation} onChange={(value) => update("workLocation", value)} />
      <Input label="Plazas" type="number" value={form.positionsTotal} onChange={(value) => update("positionsTotal", value)} required />
      <Input label="Sueldo base" type="number" value={form.salaryBase} onChange={(value) => update("salaryBase", value)} />
      <Select
        label="Periodo sueldo"
        value={form.salaryPeriod}
        onChange={(value) => update("salaryPeriod", value)}
        options={[
          { value: "MONTHLY", label: "Mensual" },
          { value: "BIWEEKLY", label: "Quincenal" },
          { value: "WEEKLY", label: "Semanal" },
          { value: "DAILY", label: "Diario" },
          { value: "OTHER", label: "Otro" },
        ]}
      />
      <Select
        label="Estatus"
        value={form.status}
        onChange={(value) => update("status", value)}
        options={[
          { value: "DRAFT", label: "Borrador" },
          { value: "OPEN", label: "Abierta" },
          { value: "PAUSED", label: "Pausada" },
          { value: "FILLED", label: "Cubierta" },
          { value: "CANCELLED", label: "Cancelada" },
        ]}
      />
      <Input label="Horario" value={form.workSchedule} onChange={(value) => update("workSchedule", value)} />
      <Input label="Dias" value={form.workDays} onChange={(value) => update("workDays", value)} />
      <Input label="Descanso" value={form.restDays} onChange={(value) => update("restDays", value)} />
      <Input label="Contacto cliente" value={form.clientContactName} onChange={(value) => update("clientContactName", value)} />
      <Input label="Correo cliente" value={form.clientContactEmail} onChange={(value) => update("clientContactEmail", value)} />
      <Input label="Telefono cliente" value={form.clientContactPhone} onChange={(value) => update("clientContactPhone", value)} />
      <Textarea label="Descripcion" value={form.description} onChange={(value) => update("description", value)} />
      <Textarea label="Funciones" value={form.functions} onChange={(value) => update("functions", value)} />
      <Textarea label="Experiencia requerida" value={form.requiredExperience} onChange={(value) => update("requiredExperience", value)} />
      <div className="md:col-span-2 xl:col-span-3 flex justify-end">
        <button type="button" onClick={onSubmit} disabled={saving} className={redButton}>
          Crear vacante
        </button>
      </div>
    </div>
  );
}

function CandidateForm({
  form,
  setForm,
  onSubmit,
  saving,
}: {
  form: any;
  setForm: (value: any) => void;
  onSubmit: () => void;
  saving: boolean;
}) {
  const update = (field: string, value: string | boolean) =>
    setForm((current: any) => ({ ...current, [field]: value }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Input label="Nombre completo" value={form.fullName} onChange={(value) => update("fullName", value)} required />
      <Input label="Telefono" value={form.phone} onChange={(value) => update("phone", value)} required />
      <Input label="Correo" type="email" value={form.email} onChange={(value) => update("email", value)} />
      <Input label="Estado" value={form.state} onChange={(value) => update("state", value)} required />
      <Input label="Ciudad" value={form.city} onChange={(value) => update("city", value)} required />
      <Input label="Municipio" value={form.municipality} onChange={(value) => update("municipality", value)} />
      <Input label="Ultimo puesto" value={form.lastPosition} onChange={(value) => update("lastPosition", value)} />
      <Input label="Ultima empresa" value={form.lastCompany} onChange={(value) => update("lastCompany", value)} />
      <Input label="Sectores vendidos" value={form.sectors} onChange={(value) => update("sectors", value)} placeholder="colchones, muebles, electronica" />
      <Input label="Disponible desde" type="date" value={form.availabilityStart} onChange={(value) => update("availabilityStart", value)} />
      <Input label="Sueldo esperado" type="number" value={form.expectedSalary} onChange={(value) => update("expectedSalary", value)} />
      <Input label="Etiquetas" value={form.tags} onChange={(value) => update("tags", value)} placeholder="urgente, sears" />
      <Textarea label="Experiencia" value={form.experienceSummary} onChange={(value) => update("experienceSummary", value)} />
      <Textarea label="Comentario inicial" value={form.initialComment} onChange={(value) => update("initialComment", value)} />
      <label className="flex items-center gap-3 text-sm font-semibold text-neutral-700">
        <input
          type="checkbox"
          checked={form.privacyNoticePresented}
          onChange={(event) => update("privacyNoticePresented", event.target.checked)}
        />
        Aviso de privacidad presentado
      </label>
      <div className="md:col-span-2 flex justify-end">
        <button type="button" onClick={onSubmit} disabled={saving} className={redButton}>
          Crear candidato
        </button>
      </div>
    </div>
  );
}

function ApplicationsTable({ applications }: { applications: any[] }) {
  return (
    <Panel title="Postulaciones">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-3">Candidato</th>
              <th>Vacante</th>
              <th>Etapa</th>
              <th>Responsable</th>
              <th>Estatus</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {applications.map((application) => (
              <tr key={application.id} className="border-b">
                <td className="py-3 font-semibold">
                  {application.candidate?.full_name || "Candidato"}
                </td>
                <td>{application.vacancy?.title || "Vacante"}</td>
                <td>{stageLabels[application.stage] || application.stage}</td>
                <td>{application.next_action_party}</td>
                <td>{application.process_status}</td>
                <td className="text-right">
                  <Link
                    href={`/rh/recruitment/applications/${application.id}`}
                    className="text-red-600 font-semibold"
                  >
                    Abrir
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function CompactForm({
  fields,
  values,
  setValues,
  onSubmit,
  saving,
}: {
  fields: [string, string, string?][];
  values: any;
  setValues: (value: any) => void;
  onSubmit: () => void;
  saving: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 mb-4">
      {fields.map(([label, field, type]) => (
        <Input
          key={field}
          label={label}
          type={type || "text"}
          value={values[field] || ""}
          onChange={(value) =>
            setValues({ ...values, [field]: value })
          }
        />
      ))}
      <button type="button" className={smallButton} onClick={onSubmit} disabled={saving}>
        Agregar
      </button>
    </div>
  );
}

function MiniList({
  rows,
  primary,
  secondary,
}: {
  rows: any[];
  primary: string;
  secondary: string;
}) {
  if (!rows.length) {
    return <p className="text-sm text-neutral-500">Sin registros todavia.</p>;
  }

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.id} className="border rounded-lg p-3 bg-neutral-50">
          <p className="font-semibold text-neutral-800">{String(row[primary] || "-")}</p>
          <p className="text-sm text-neutral-500">{String(row[secondary] || "")}</p>
        </div>
      ))}
    </div>
  );
}

function Stat({ title, value }: { title: string; value: number }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-5">
      <p className="text-sm text-neutral-500">{title}</p>
      <p className="text-4xl font-bold text-red-500 mt-2">{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-neutral-800 mb-5">{title}</h2>
      {children}
    </section>
  );
}

function StepPanel({
  number,
  title,
  done,
  unlocked,
  children,
}: {
  number: number;
  title: string;
  done: boolean;
  unlocked: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`bg-white rounded-lg shadow-md p-6 ${
        unlocked ? "" : "opacity-70"
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <span className="h-9 w-9 rounded-full bg-neutral-900 text-white flex items-center justify-center font-bold">
            {number}
          </span>
          <h2 className="text-xl font-semibold text-neutral-800">{title}</h2>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-bold ${
            done ? "bg-green-100 text-green-800" : "bg-neutral-100 text-neutral-600"
          }`}
        >
          {done ? "COMPLETO" : unlocked ? "PENDIENTE" : "BLOQUEADO"}
        </span>
      </div>

      {unlocked ? (
        children
      ) : (
        <p className="text-sm text-neutral-500">
          Completa el paso anterior para habilitar esta seccion.
        </p>
      )}
    </section>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-sm text-neutral-500">{label}</p>
      <p className="font-semibold text-neutral-800">{value || "Pendiente"}</p>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-neutral-700">{label}</label>
      <input
        className={inputClass}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        placeholder={placeholder}
      />
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="text-sm font-medium text-neutral-700">{label}</label>
      <select
        className={inputClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Selecciona</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Textarea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-neutral-700">{label}</label>
      <textarea
        className={`${inputClass} min-h-24`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

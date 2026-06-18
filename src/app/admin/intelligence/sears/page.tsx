"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { supabase } from "@/lib/supabase";

type Store = {
  id: string;
  name: string;
  chain_name: string | null;
  brand_name: string | null;
};

type IntelligenceRecord = {
  id?: string;
  store_id: string;

  restonic_floor: number;
  restonic_bedroom: number;
  restonic_promoters: number;

  america_floor: number;
  america_bedroom: number;
  america_promoters: number;

  sealy_floor: number;
  sealy_bedroom: number;
  sealy_promoters: number;

  springair_floor: number;
  springair_bedroom: number;
  springair_promoters: number;

  therapedic_floor: number;
  therapedic_bedroom: number;
  therapedic_promoters: number;

  vittorio_benzi_floor: number;
  vittorio_benzi_bedroom: number;
  vittorio_benzi_promoters: number;

  luna_floor: number;
  luna_bedroom: number;
  luna_promoters: number;

  serta_floor: number;
  serta_bedroom: number;
  serta_promoters: number;

  comments: string | null;
  updated_at?: string;
};

const emptyRecord = (storeId: string): IntelligenceRecord => ({
  store_id: storeId,

  restonic_floor: 0,
  restonic_bedroom: 0,
  restonic_promoters: 0,

  america_floor: 0,
  america_bedroom: 0,
  america_promoters: 0,

  sealy_floor: 0,
  sealy_bedroom: 0,
  sealy_promoters: 0,

  springair_floor: 0,
  springair_bedroom: 0,
  springair_promoters: 0,

  therapedic_floor: 0,
  therapedic_bedroom: 0,
  therapedic_promoters: 0,

  vittorio_benzi_floor: 0,
  vittorio_benzi_bedroom: 0,
  vittorio_benzi_promoters: 0,

  luna_floor: 0,
  luna_bedroom: 0,
  luna_promoters: 0,

  serta_floor: 0,
  serta_bedroom: 0,
  serta_promoters: 0,

  comments: "",
});

function num(value: any) {
  return Number(value || 0);
}

function percent(value: number) {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.round(value)}%`;
}

export default function SearsIntelligencePage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [records, setRecords] = useState<Record<string, IntelligenceRecord>>({});
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const loadData = async () => {
    setLoading(true);
    setMessage("");

    const [storesResult, intelligenceResult] = await Promise.all([
      supabase
        .from("stores")
        .select("id, name, chain_name, brand_name")
        .ilike("chain_name", "%SEARS%")
        .order("name", { ascending: true }),

      supabase.from("sears_store_intelligence").select("*"),
    ]);

    if (storesResult.error) {
      setMessage(`Error al cargar tiendas: ${storesResult.error.message}`);
      setLoading(false);
      return;
    }

    if (intelligenceResult.error) {
      setMessage(`Error al cargar inteligencia: ${intelligenceResult.error.message}`);
      setLoading(false);
      return;
    }

    const searsStores = storesResult.data || [];
    setStores(searsStores);

    const map: Record<string, IntelligenceRecord> = {};

    searsStores.forEach((store: Store) => {
      map[store.id] = emptyRecord(store.id);
    });

    (intelligenceResult.data || []).forEach((record: IntelligenceRecord) => {
      map[record.store_id] = {
        ...emptyRecord(record.store_id),
        ...record,
      };
    });

    setRecords(map);

    if (searsStores.length > 0 && !selectedStoreId) {
      setSelectedStoreId(searsStores[0].id);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedRecord = selectedStoreId
    ? records[selectedStoreId] || emptyRecord(selectedStoreId)
    : null;

  const updateField = (field: keyof IntelligenceRecord, value: string) => {
    if (!selectedStoreId || !selectedRecord) return;

    setRecords((prev) => ({
      ...prev,
      [selectedStoreId]: {
        ...selectedRecord,
        [field]: field === "comments" ? value : Number(value || 0),
      },
    }));
  };

  const calculateStoreMetrics = (record: IntelligenceRecord) => {
    const restonicTotal =
      num(record.restonic_floor) + num(record.restonic_bedroom);

    const competitorTotal =
      num(record.america_floor) +
      num(record.america_bedroom) +
      num(record.sealy_floor) +
      num(record.sealy_bedroom) +
      num(record.springair_floor) +
      num(record.springair_bedroom) +
      num(record.therapedic_floor) +
      num(record.therapedic_bedroom) +
      num(record.vittorio_benzi_floor) +
      num(record.vittorio_benzi_bedroom) +
      num(record.luna_floor) +
      num(record.luna_bedroom) +
      num(record.serta_floor) +
      num(record.serta_bedroom);

    const totalExhibition = restonicTotal + competitorTotal;

    const restonicVisibility =
      num(record.restonic_floor) * 3 + num(record.restonic_bedroom) * 1;

    const competitorVisibility =
      (num(record.america_floor) +
        num(record.sealy_floor) +
        num(record.springair_floor) +
        num(record.therapedic_floor) +
        num(record.vittorio_benzi_floor) +
        num(record.luna_floor) +
        num(record.serta_floor)) *
        3 +
      (num(record.america_bedroom) +
        num(record.sealy_bedroom) +
        num(record.springair_bedroom) +
        num(record.therapedic_bedroom) +
        num(record.vittorio_benzi_bedroom) +
        num(record.luna_bedroom) +
        num(record.serta_bedroom)) *
        1;

    const totalVisibility = restonicVisibility + competitorVisibility;

    const competitorPromoters =
      num(record.america_promoters) +
      num(record.sealy_promoters) +
      num(record.springair_promoters) +
      num(record.therapedic_promoters) +
      num(record.vittorio_benzi_promoters) +
      num(record.luna_promoters) +
      num(record.serta_promoters);

    const totalPromoters = num(record.restonic_promoters) + competitorPromoters;

    const shareExhibition =
      totalExhibition > 0 ? (restonicTotal / totalExhibition) * 100 : 0;

    const visibilityShare =
      totalVisibility > 0 ? (restonicVisibility / totalVisibility) * 100 : 0;

    const commercialPressure =
      totalPromoters > 0 ? (competitorPromoters / totalPromoters) * 100 : 0;

    const hiddenRestonic =
      restonicTotal > 0 ? (num(record.restonic_bedroom) / restonicTotal) * 100 : 0;

    let status = "🟢 Estable";
    let action = "Mantener seguimiento.";

    if (shareExhibition < 25 || visibilityShare < 25) {
      status = "🔴 Riesgo alto";
      action = "Solicitar incremento de exhibición en piso.";
    } else if (commercialPressure >= 60) {
      status = "🟡 Competencia fuerte";
      action = "Reforzar presencia comercial y seguimiento del promotor.";
    } else if (hiddenRestonic >= 50) {
      status = "🟡 Baja visibilidad";
      action = "Mover modelos Restonic de recámara a exhibición en piso.";
    }

    return {
      restonicTotal,
      competitorTotal,
      totalExhibition,
      shareExhibition,
      visibilityShare,
      commercialPressure,
      hiddenRestonic,
      status,
      action,
    };
  };

  const dashboard = useMemo(() => {
    const list = Object.values(records);
    const active = list.filter((record) => {
      const metrics = calculateStoreMetrics(record);
      return metrics.totalExhibition > 0;
    });

    if (active.length === 0) {
      return {
        avgShare: 0,
        avgVisibility: 0,
        avgPressure: 0,
        riskStores: 0,
        opportunities: 0,
      };
    }

    const metrics = active.map(calculateStoreMetrics);

    return {
      avgShare:
        metrics.reduce((sum, item) => sum + item.shareExhibition, 0) /
        active.length,
      avgVisibility:
        metrics.reduce((sum, item) => sum + item.visibilityShare, 0) /
        active.length,
      avgPressure:
        metrics.reduce((sum, item) => sum + item.commercialPressure, 0) /
        active.length,
      riskStores: metrics.filter(
        (item) => item.shareExhibition < 25 || item.visibilityShare < 25
      ).length,
      opportunities: metrics.filter(
        (item) =>
          item.shareExhibition < 35 ||
          item.visibilityShare < 35 ||
          item.commercialPressure >= 60
      ).length,
    };
  }, [records]);

  const handleSave = async () => {
    if (!selectedRecord || !selectedStoreId) return;

    setSaving(true);
    setMessage("");

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;

    const payload = {
      ...selectedRecord,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("sears_store_intelligence")
      .upsert(payload, { onConflict: "store_id" });

    if (error) {
      setMessage(`Error al guardar: ${error.message}`);
      setSaving(false);
      return;
    }

    setMessage("Inteligencia Sears actualizada correctamente.");
    setSaving(false);
    await loadData();
  };

  const selectedMetrics = selectedRecord
    ? calculateStoreMetrics(selectedRecord)
    : null;

  return (
    <main className="min-h-screen bg-neutral-100 flex">
      <Sidebar userName="Eduardo Palmerin" />

      <section className="flex-1 p-8">
        <div className="flex justify-between items-start gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-black text-neutral-800">
              Inteligencia Comercial Sears
            </h1>
            <p className="text-neutral-500 mt-2">
              Share de exhibición, visibilidad, presión comercial y acciones recomendadas.
            </p>
          </div>

          <button
            onClick={loadData}
            className="bg-neutral-900 hover:bg-neutral-800 text-white px-5 py-3 rounded-xl font-semibold"
          >
            Actualizar
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <Kpi title="Share Exhibición" value={percent(dashboard.avgShare)} />
          <Kpi title="Visibilidad Restonic" value={percent(dashboard.avgVisibility)} />
          <Kpi title="Presión Comercial" value={percent(dashboard.avgPressure)} />
          <Kpi title="Tiendas en Riesgo" value={loading ? "..." : dashboard.riskStores} />
          <Kpi title="Oportunidades" value={loading ? "..." : dashboard.opportunities} />
        </div>

        {message && (
          <div className="bg-white rounded-2xl shadow-md p-5 mb-6 text-sm text-neutral-700">
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2 bg-white rounded-2xl shadow-md p-6">
            <h2 className="text-2xl font-bold text-neutral-800 mb-5">
              Captura por tienda
            </h2>

            <select
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              className="w-full px-4 py-4 border rounded-2xl mb-6"
            >
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name} - {store.chain_name}
                </option>
              ))}
            </select>

            {selectedRecord && (
              <div className="space-y-6">
                <BrandFields
                  title="Restonic"
                  record={selectedRecord}
                  updateField={updateField}
                  floor="restonic_floor"
                  bedroom="restonic_bedroom"
                  promoters="restonic_promoters"
                />

                <BrandFields title="América" record={selectedRecord} updateField={updateField} floor="america_floor" bedroom="america_bedroom" promoters="america_promoters" />
                <BrandFields title="Sealy" record={selectedRecord} updateField={updateField} floor="sealy_floor" bedroom="sealy_bedroom" promoters="sealy_promoters" />
                <BrandFields title="Spring Air" record={selectedRecord} updateField={updateField} floor="springair_floor" bedroom="springair_bedroom" promoters="springair_promoters" />
                <BrandFields title="Therapedic" record={selectedRecord} updateField={updateField} floor="therapedic_floor" bedroom="therapedic_bedroom" promoters="therapedic_promoters" />
                <BrandFields title="Vittorio Benzi" record={selectedRecord} updateField={updateField} floor="vittorio_benzi_floor" bedroom="vittorio_benzi_bedroom" promoters="vittorio_benzi_promoters" />
                <BrandFields title="Luna" record={selectedRecord} updateField={updateField} floor="luna_floor" bedroom="luna_bedroom" promoters="luna_promoters" />
                <BrandFields title="Serta" record={selectedRecord} updateField={updateField} floor="serta_floor" bedroom="serta_bedroom" promoters="serta_promoters" />

                <textarea
                  value={selectedRecord.comments || ""}
                  onChange={(e) => updateField("comments", e.target.value)}
                  placeholder="Comentarios"
                  className="w-full px-4 py-4 border rounded-2xl min-h-28"
                />

                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-2xl disabled:opacity-60"
                >
                  {saving ? "Guardando..." : "Guardar inteligencia Sears"}
                </button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-md p-6">
            <h2 className="text-2xl font-bold text-neutral-800 mb-5">
              Diagnóstico
            </h2>

            {selectedMetrics && (
              <div className="space-y-4">
                <Diagnosis label="Share exhibición" value={percent(selectedMetrics.shareExhibition)} />
                <Diagnosis label="Visibilidad Restonic" value={percent(selectedMetrics.visibilityShare)} />
                <Diagnosis label="Presión comercial" value={percent(selectedMetrics.commercialPressure)} />
                <Diagnosis label="Restonic en recámara" value={percent(selectedMetrics.hiddenRestonic)} />

                <div className="bg-neutral-900 text-white rounded-2xl p-5">
                  <p className="text-sm text-neutral-300">Semáforo</p>
                  <p className="text-2xl font-black mt-2">{selectedMetrics.status}</p>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
                  <p className="text-sm text-red-600 font-bold">Acción recomendada</p>
                  <p className="text-neutral-800 font-semibold mt-2">
                    {selectedMetrics.action}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function Kpi({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-md">
      <p className="text-sm text-neutral-500">{title}</p>
      <p className="text-3xl font-black text-red-500 mt-2">{value}</p>
    </div>
  );
}

function Diagnosis({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-neutral-100 rounded-2xl p-4">
      <p className="text-sm text-neutral-500">{label}</p>
      <p className="text-2xl font-black text-neutral-900 mt-1">{value}</p>
    </div>
  );
}

function BrandFields({
  title,
  record,
  updateField,
  floor,
  bedroom,
  promoters,
}: {
  title: string;
  record: IntelligenceRecord;
  updateField: (field: keyof IntelligenceRecord, value: string) => void;
  floor: keyof IntelligenceRecord;
  bedroom: keyof IntelligenceRecord;
  promoters: keyof IntelligenceRecord;
}) {
  return (
    <div className="border rounded-2xl p-4">
      <h3 className="font-black text-neutral-800 mb-4">{title}</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <InputNumber
          label="Exhibición en piso"
          value={String(record[floor] || 0)}
          onChange={(value) => updateField(floor, value)}
        />

        <InputNumber
          label="Exhibición en recámara"
          value={String(record[bedroom] || 0)}
          onChange={(value) => updateField(bedroom, value)}
        />

        <InputNumber
          label="Promotores"
          value={String(record[promoters] || 0)}
          onChange={(value) => updateField(promoters, value)}
        />
      </div>
    </div>
  );
}

function InputNumber({
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
      <label className="text-xs font-semibold text-neutral-500">{label}</label>
      <input
        type="number"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full mt-1 px-4 py-3 border rounded-xl"
      />
    </div>
  );
}
"use client";

import { useEffect, useState } from "react";
import PromoterHome from "@/components/PromoterHome";
import { supabase } from "@/lib/supabase";

type AssignedStore = {
  chain_name: string | null;
};

const ROUTE_CHAINS = [
  "MUEBLERIAS VILLARREAL",
  "MUEBLERIAS VILLAREAL",
  "MUEBLERIAS VALDEZ BALUARTE",
];

function normalizeText(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

export default function PromoterPage() {
  const [showRouteModule, setShowRouteModule] = useState(false);

  const checkRouteModule = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;

    if (!userId) return;

    const { data, error } = await supabase
      .from("employee_store_assignments")
      .select(`
        stores:store_id (
          chain_name
        )
      `)
      .eq("employee_id", userId)
      .eq("active", true);

    if (error) {
      console.error(error);
      return;
    }

    const assignedStores = (data || [])
      .map((item: any) => item.stores)
      .filter(Boolean) as AssignedStore[];

    const hasRouteChain = assignedStores.some((store) =>
      ROUTE_CHAINS.includes(normalizeText(store.chain_name))
    );

    setShowRouteModule(hasRouteChain);
  };

  useEffect(() => {
    checkRouteModule();
  }, []);

  return <PromoterHome showRouteModule={showRouteModule} />;
}

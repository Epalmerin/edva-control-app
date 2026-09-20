"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Account = {
  id: string;
  name: string;
};

export default function AccountSelector() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAccounts = async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("id, name")
        .eq("active", true)
        .order("name");

      if (error) {
        console.error("Error al cargar cuentas:", error);
        setLoading(false);
        return;
      }

      setAccounts(data || []);

      const savedAccount = localStorage.getItem("edva_active_account");

      if (
        savedAccount &&
        data?.some((account) => account.id === savedAccount)
      ) {
        setSelectedAccount(savedAccount);
      } else {
        setSelectedAccount("all");
        localStorage.setItem("edva_active_account", "all");
      }

      setLoading(false);
    };

    loadAccounts();
  }, []);

  const handleChange = (accountId: string) => {
    setSelectedAccount(accountId);
    localStorage.setItem("edva_active_account", accountId);

    window.dispatchEvent(
      new CustomEvent("edva-account-change", {
        detail: accountId,
      })
    );
  };

  return (
    <div className="mb-8">
      <label className="block text-xs font-semibold tracking-wider text-neutral-400 mb-2">
        CUENTA ACTIVA
      </label>

      <select
        value={selectedAccount}
        onChange={(e) => handleChange(e.target.value)}
        disabled={loading}
        className="w-full bg-neutral-800 border border-neutral-700 text-white px-3 py-3 rounded-xl outline-none focus:border-red-500"
      >
        {loading ? (
          <option value="">Cargando cuentas...</option>
        ) : (
          <>
            <option value="all">Todas las cuentas</option>

            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </>
        )}
      </select>
    </div>
  );
}
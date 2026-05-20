"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";

export default function EmployeesPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [hireDate, setHireDate] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const response = await fetch("/api/admin/create-employee", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        email,
        phone,
        role,
        hireDate,
        password,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(`Error: ${result.error}`);
      setLoading(false);
      return;
    }

    setMessage("Empleado creado correctamente.");

    setName("");
    setEmail("");
    setPhone("");
    setRole("");
    setHireDate("");
    setPassword("");
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-neutral-100 flex">
      <Sidebar userName="Eduardo Palmerin" />

      <section className="flex-1 p-8">
        <h1 className="text-4xl font-bold text-neutral-800">
          Alta de empleados
        </h1>

        <p className="text-neutral-500 mt-2 mb-8">
          Registro y administración de usuarios de EDVA Control App
        </p>

        <div className="bg-white rounded-2xl shadow-md p-6 max-w-3xl">
          <h2 className="text-xl font-semibold text-neutral-800 mb-6">
            Nuevo empleado
          </h2>

          <form
            onSubmit={handleCreateEmployee}
            className="grid grid-cols-1 md:grid-cols-2 gap-5"
          >
            <div>
              <label className="text-sm font-medium text-neutral-700">
                Nombre completo
              </label>
              <input
                className="w-full mt-1 px-4 py-3 border rounded-xl"
                placeholder="Nombre del empleado"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700">
                Correo electrónico
              </label>
              <input
                type="email"
                className="w-full mt-1 px-4 py-3 border rounded-xl"
                placeholder="correo@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700">
                Teléfono
              </label>
              <input
                className="w-full mt-1 px-4 py-3 border rounded-xl"
                placeholder="55 0000 0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700">
                Rol
              </label>
              <select
                className="w-full mt-1 px-4 py-3 border rounded-xl"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                required
              >
                <option value="">Selecciona rol</option>
                <option value="PROMOTOR">Promotor</option>
                <option value="SUPERVISOR">Supervisor</option>
                <option value="RH">RH</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700">
                Fecha de ingreso
              </label>
              <input
                type="date"
                className="w-full mt-1 px-4 py-3 border rounded-xl"
                value={hireDate}
                onChange={(e) => setHireDate(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700">
                Contraseña temporal
              </label>
              <input
                type="password"
                className="w-full mt-1 px-4 py-3 border rounded-xl"
                placeholder="Contraseña inicial"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={loading}
                className="bg-red-500 hover:bg-red-600 text-white font-semibold px-6 py-3 rounded-xl disabled:opacity-60"
              >
                {loading ? "Creando empleado..." : "Crear empleado"}
              </button>
            </div>
          </form>

          {message && (
            <div className="mt-5 bg-neutral-100 rounded-xl p-4 text-sm font-medium text-neutral-700">
              {message}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
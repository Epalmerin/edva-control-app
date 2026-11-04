import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import PromoterBottomNav from "@/components/PromoterBottomNav";
import styles from "./PromoterHome.module.css";

type IconName = "clock" | "receipt" | "calendar" | "clipboard" | "route" | "user" | "arrow";

function HomeIcon({ name, className }: { name: IconName; className?: string }) {
  const paths: Record<IconName, ReactNode> = {
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    receipt: <><path d="M6 3l2 1 2-1 2 1 2-1 2 1 2-1v18l-2-1-2 1-2-1-2 1-2-1-2 1V3Z" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 11h18M7 15h2M15 15h2" /></>,
    clipboard: <><path d="M9 5H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3" /><rect x="9" y="2" width="6" height="5" rx="1" /><path d="m8 14 3 3 5-6" /></>,
    route: <><circle cx="6" cy="5" r="2" /><circle cx="18" cy="19" r="2" /><path d="M8 5h8a4 4 0 0 1 0 8H8a3 3 0 0 0 0 6h8" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
    arrow: <path d="m9 5 7 7-7 7" />,
  };

  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}

type HomeAccess = {
  title: string;
  description: string;
  action: string;
  href: string;
  icon: IconName;
  featured?: boolean;
};

export default function PromoterHome({ showRouteModule }: { showRouteModule: boolean }) {
  const accesses: HomeAccess[] = [
    { title: "Asistencia", description: "Registra tu entrada, comida y salida.", action: "Registrar asistencia", href: "/promoter/attendance", icon: "clock", featured: true },
    ...(showRouteModule ? [{ title: "Ruta diaria", description: "Llegada y salida por tienda visitada.", action: "Registrar visita de ruta", href: "/promoter/store-visits", icon: "route" as const }] : []),
    { title: "Ventas", description: "Captura tus tickets y ventas.", action: "Registrar venta", href: "/promoter/sales", icon: "receipt" },
    { title: "Incidencias", description: "Vacaciones, permisos e incapacidades.", action: "Ver incidencias", href: "/promoter/incidences", icon: "calendar" },
    { title: "Visitas", description: "Reportes de visitas de supervisión.", action: "Ver visitas", href: "/promoter/supervisor-visits", icon: "clipboard" },
  ];

  return (
    <div className={styles.home}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brand}>
            <Image src="/edva-logo.jpeg" alt="EDVA MKT & Publicidad" width={1483} height={1061} sizes="92px" loading="eager" className={styles.logo} />
            <span className={styles.productName}>Control App</span>
          </div>
          <div className={styles.account}>
            <span className={styles.accountIcon}><HomeIcon name="user" /></span>
            <div className={styles.accountCopy}>Promotor<span>EDVA Control App</span></div>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <p className={styles.overline}>MI ESPACIO DE TRABAJO</p>
        <h1 className={styles.title}>Todo para tu jornada.</h1>
        <p className={styles.subtitle}>Selecciona lo que necesitas registrar o consultar.</p>

        <nav className={styles.accesses} aria-label="Accesos del promotor">
          {accesses.map((access) => (
            <Link key={access.href} href={access.href} className={`${styles.access}${access.featured ? ` ${styles.featured}` : ""}`}>
              <span className={styles.icon}><HomeIcon name={access.icon} /></span>
              <div className={styles.copy}>
                <h2>{access.title}</h2>
                <span className={styles.description}>{access.description}</span>
              </div>
              <HomeIcon name="arrow" className={styles.arrow} />
              <span className={styles.action}>{access.action}<span aria-hidden="true"> →</span></span>
            </Link>
          ))}
        </nav>

        <p className={styles.footer}>EDVA · MKT & Publicidad</p>
      </main>

      <div className={styles.bottomNav}><PromoterBottomNav /></div>
    </div>
  );
}

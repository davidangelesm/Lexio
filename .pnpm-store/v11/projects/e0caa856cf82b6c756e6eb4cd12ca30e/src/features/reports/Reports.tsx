import ReportCaseTable from "../../features/reports/components/ReportCaseTable";
import type { Case, User } from "../../types/index";
import CollectionsReport from "./components/CollectionsReport";
import EconomicReport from "./components/EconomicReport";
import OperationalReport from "./components/OperationalReport";
import ReportFilters from "./components/ReportFilters";
import { useReports } from "./hooks/useReports";

export default function Reports({
  actor,
  users,
  openCase,
}: {
  actor: User;
  users: User[];
  openCase: (id: number) => void;
}) {
  const {
    filters,
    setFilters,
    clients,
    cases,
    services,
    userName,
    tab,
    setTab,
    busy,
    load,
    error,
    operational,
    setDetailFilter,
    detailFilter,
    economic,
    collections,
  } = useReports({ actor, users, openCase });

  const caseRows = (list: Case[]) => (
    <ReportCaseTable list={list} openCase={openCase} userName={userName} />
  );
  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Información acumulada</p>
          <h1>Consola de reportes</h1>
          <p>Consulta las fuentes y abre el caso desde cada fila.</p>
        </div>
      </div>
      <div className="tabs">
        {[
          ["operativo", "Operativos"],
          ...(actor.role === "admin"
            ? [
                ["economico", "Gerencial por área"],
                ["cuenta", "Estado de cuenta y cartera"],
                ["cobros", "Cobros por periodo"],
              ]
            : []),
        ].map(([k, l]) => (
          <button
            key={k}
            className={tab === k ? "active" : ""}
            onClick={() => setTab(k)}
          >
            {l}
          </button>
        ))}
      </div>
      <ReportFilters
        filters={filters}
        setFilters={setFilters}
        clients={clients}
        cases={cases}
        services={services}
        tab={tab}
        users={users}
        busy={busy}
        load={load}
        error={error}
      />
      {tab === "operativo" && operational && (
        <OperationalReport
          operational={operational}
          setDetailFilter={setDetailFilter}
          detailFilter={detailFilter}
          caseRows={caseRows}
          openCase={openCase}
          userName={userName}
        />
      )}
      {(tab === "economico" || tab === "cuenta") && economic && (
        <EconomicReport economic={economic} tab={tab} openCase={openCase} />
      )}
      {tab === "cobros" && collections && (
        <CollectionsReport collections={collections} openCase={openCase} />
      )}
    </>
  );
}

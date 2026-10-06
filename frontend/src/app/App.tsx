import AppShell from "../components/layout/AppShell";
import { Modal } from "../components/ui/index";
import AdministrationPage from "../features/admin/AdministrationPage";
import UserForm from "../features/admin/forms/UserForm";
import AlertsPage from "../features/alerts/AlertsPage";
import AlertTable from "../features/alerts/components/AlertTable";
import LoginPage from "../features/auth/LoginPage";
import CasesPage from "../features/cases/CasesPage";
import CaseWorkspace from "../features/cases/CaseWorkspace";
import CreateCaseForm from "../features/cases/forms/CreateCaseForm";
import ClientFiles from "../features/clients/ClientFiles";
import ClientsPage from "../features/clients/ClientsPage";
import ClientForm from "../features/clients/forms/ClientForm";
import DashboardPage from "../features/dashboard/DashboardPage";
import Reports from "../features/reports/Reports";
import { useLexio } from "../hooks/useLexio";
import type { Alert } from "../types/index";

export default function App() {
  const {
    isAdmin,
    openCase,
    userName,
    busy,
    setError,
    load,
    actor,
    setActor,
    page,
    setSelected,
    setPage,
    logout,
    selected,
    users,
    error,
    dashboard,
    setEditClient,
    setModal,
    docType,
    setDocType,
    search,
    setSearch,
    clients,
    setClientFilter,
    setFileClient,
    setNewCaseClient,
    area,
    setArea,
    status,
    setStatus,
    clientFilter,
    cases,
    alerts,
    setEditUser,
    noticeDays,
    audit,
    modal,
    fileClient,
    editClient,
    done,
    newCaseClient,
    editUser,
  } = useLexio();
  const alertTable = (data: Alert[]) => (
    <AlertTable
      data={data}
      isAdmin={isAdmin}
      busy={busy}
      openCase={openCase}
      userName={userName}
      setError={setError}
      load={load}
    />
  );

  if (!actor) return <LoginPage setActor={setActor} />;
  return (
    <AppShell
      actor={actor}
      page={page}
      caseCode={selected?.code}
      onNavigate={(nextPage) => {
        setSelected(undefined);
        setPage(nextPage);
      }}
      onLogout={logout}
    >
      {selected ? (
        <CaseWorkspace
          key={selected.id}
          selected={selected}
          actor={actor}
          users={users}
          back={() => {
            setSelected(undefined);
            void load();
          }}
        />
      ) : (
        <>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {page === "panel" && (
            <DashboardPage
              actor={actor}
              busy={busy}
              load={load}
              dashboard={dashboard}
              isAdmin={isAdmin}
              setPage={setPage}
              alertTable={alertTable}
              userName={userName}
              openCase={openCase}
            />
          )}
          {page === "clientes" && (
            <ClientsPage
              isAdmin={isAdmin}
              actor={actor}
              setEditClient={setEditClient}
              setModal={setModal}
              load={load}
              docType={docType}
              setDocType={setDocType}
              search={search}
              setSearch={setSearch}
              busy={busy}
              clients={clients}
              setClientFilter={setClientFilter}
              setPage={setPage}
              setFileClient={setFileClient}
              setNewCaseClient={setNewCaseClient}
            />
          )}
          {page === "casos" && (
            <CasesPage
              isAdmin={isAdmin}
              actor={actor}
              setPage={setPage}
              load={load}
              area={area}
              setArea={setArea}
              status={status}
              setStatus={setStatus}
              clientFilter={clientFilter}
              setClientFilter={setClientFilter}
              busy={busy}
              cases={cases}
              openCase={openCase}
              userName={userName}
            />
          )}
          {page === "alertas" && (
            <AlertsPage
              busy={busy}
              load={load}
              alertTable={alertTable}
              alerts={alerts}
            />
          )}
          {page === "reportes" && (
            <Reports
              actor={actor}
              users={users}
              openCase={(id) => void openCase(id)}
            />
          )}
          {page === "usuarios" && isAdmin && (
            <AdministrationPage
              setEditUser={setEditUser}
              setModal={setModal}
              users={users}
              load={load}
              noticeDays={noticeDays}
              audit={audit}
              userName={userName}
            />
          )}
        </>
      )}
      {modal && (
        <Modal
          title={
            modal === "cliente"
              ? "Ficha del cliente"
              : modal === "caso"
                ? "Crear caso"
                : modal === "documentos"
                  ? "Documentos del cliente"
                  : "Cuenta del equipo"
          }
          close={() => setModal("")}
        >
          {modal === "documentos" && fileClient && (
            <ClientFiles client={fileClient} isAdmin={!!isAdmin} />
          )}
          {modal === "cliente" && (
            <ClientForm
              editClient={editClient}
              isAdmin={isAdmin}
              actor={actor}
              setNewCaseClient={setNewCaseClient}
              setModal={setModal}
              done={done}
            />
          )}
          {modal === "caso" && newCaseClient && (
            <CreateCaseForm
              newCaseClient={newCaseClient}
              setModal={setModal}
              setSelected={setSelected}
              actor={actor}
              users={users}
              isAdmin={isAdmin}
            />
          )}
          {modal === "usuario" && <UserForm editUser={editUser} done={done} />}
        </Modal>
      )}
    </AppShell>
  );
}

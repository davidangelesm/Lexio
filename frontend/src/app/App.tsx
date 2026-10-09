import AppShell from "../components/layout/AppShell";
import { Modal } from "../components/ui";
import AdministrationPage from "../features/admin/AdministrationPage";
import UserForm from "../features/admin/forms/UserForm";
import LoginPage from "../features/auth/LoginPage";
import CasesPage from "../features/cases/CasesPage";
import CaseWorkspace from "../features/cases/CaseWorkspace";
import CaseForm from "../features/cases/forms/CaseForm";
import ClientsPage from "../features/clients/ClientsPage";
import ClientForm from "../features/clients/forms/ClientForm";
import DashboardPage from "../features/dashboard/DashboardPage";
import Reports from "../features/reports/Reports";
import { useLexio } from "../hooks/useLexio";
export default function App() {
  const state = useLexio();
  const { actor, selected, modal, page, users, clients, isAdmin, error, busy } =
    state;
  if (!actor) return <LoginPage setActor={state.setActor} />;
  return (
    <AppShell
      actor={actor}
      page={page}
      caseCode={selected?.client.code}
      onNavigate={(next) => {
        state.setSelected(undefined);
        state.setModal("");
        state.setPage(next);
        if (next === page) void state.load();
      }}
      onLogout={state.logout}
    >
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {selected ? (
        <CaseWorkspace
          key={selected.id}
          selected={selected}
          initialTab={state.selectedTab}
          actor={actor}
          users={users}
          clients={clients}
          areas={state.areas}
          back={() => {
            state.setSelected(undefined);
            void state.load();
          }}
        />
      ) : (
        <>
          {page === "inicio" && <DashboardPage {...state} actor={actor} />}
          {page === "clientes" && (
            <ClientsPage
              actor={actor}
              clients={clients.filter((client) =>
                `${client.code} ${client.name} ${client.document_number}`
                  .toLocaleLowerCase("es-PE")
                  .includes(
                    state.clientSearch.trim().toLocaleLowerCase("es-PE"),
                  ),
              )}
              busy={busy}
              search={state.clientSearch}
              setSearch={state.setClientSearch}
              load={state.load}
              create={state.createClient}
              edit={state.correctClient}
              viewCases={state.viewClientCases}
              newCase={state.newCase}
            />
          )}
          {page === "casos" && (
            <CasesPage
              {...state}
              actor={actor}
              create={() => state.newCase()}
            />
          )}
          {page === "reportes" && (
            <Reports
              report={state.report}
              isAdmin={isAdmin}
              busy={busy}
              load={state.load}
            />
          )}
          {page === "usuarios" && isAdmin && <AdministrationPage {...state} />}
        </>
      )}
      {modal && (
        <Modal
          title={
            modal === "caso"
              ? "Nuevo caso"
              : modal === "cliente"
                ? state.editClient
                  ? "Corregir datos del cliente"
                  : "Nuevo cliente"
                : "Cuenta del equipo"
          }
          close={() => state.setModal("")}
        >
          {modal === "caso" && (
            <CaseForm
              actor={actor}
              users={users}
              clients={clients}
              areas={state.areas}
              clientId={state.newCaseClientId}
              saved={(item) => {
                state.setModal("");
                state.setPage("casos");
                state.setSelected(item);
              }}
            />
          )}
          {modal === "cliente" && (
            <ClientForm item={state.editClient} saved={() => state.done()} />
          )}
          {modal === "usuario" && (
            <UserForm editUser={state.editUser} done={state.done} />
          )}
        </Modal>
      )}
    </AppShell>
  );
}

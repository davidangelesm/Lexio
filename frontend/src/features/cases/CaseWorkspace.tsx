import { ArrowLeft, Pencil } from "lucide-react";
import { Badge, Card, Modal } from "../../components/ui/index";
import ResponsibleSelect from "../../features/cases/components/ResponsibleSelect";
import type { Case, User } from "../../types/index";
import { dateLabel } from "../../utils/format";
import CaseAccess from "./components/CaseAccess";
import CaseEvents from "./components/CaseEvents";
import CaseFiles from "./components/CaseFiles";
import CaseServices from "./components/CaseServices";
import CaseTasks from "./components/CaseTasks";
import CaseTimeline from "./components/CaseTimeline";
import CaseAccessForm from "./forms/CaseAccessForm";
import CaseFileForm from "./forms/CaseFileForm";
import EditCaseForm from "./forms/EditCaseForm";
import EntryForm from "./forms/EntryForm";
import EventForm from "./forms/EventForm";
import LinkEventForm from "./forms/LinkEventForm";
import PaymentForm from "./forms/PaymentForm";
import RescheduleInstallmentForm from "./forms/RescheduleInstallmentForm";
import ReversePaymentForm from "./forms/ReversePaymentForm";
import ServiceForm from "./forms/ServiceForm";
import TaskForm from "./forms/TaskForm";
import { useCaseWorkspace } from "./hooks/useCaseWorkspace";

export default function CaseWorkspace({
  selected,
  actor,
  users,
  back,
}: {
  selected: Case;
  actor: User;
  users: User[];
  back: () => void;
}) {
  const {
    isAdmin,
    authorized,
    caseData,
    tasks,
    canEdit,
    setModal,
    error,
    loading,
    userName,
    tab,
    setTab,
    setEditEntry,
    entries,
    setEditTask,
    setEditEvent,
    events,
    action,
    caseId,
    files,
    openFile,
    setPlans,
    setPercent,
    services,
    beginPayment,
    setQuota,
    setService,
    setPaymentId,
    setAllocations,
    access,
    modal,
    done,
    editEntry,
    editTask,
    editEvent,
    plans,
    percent,
    updatePlan,
    service,
    allocations,
    paymentId,
    quota,
  } = useCaseWorkspace({ selected, actor, users, back });
  const responsibleSelect = (value: number = actor.id) => (
    <ResponsibleSelect
      value={value}
      actor={actor}
      isAdmin={isAdmin}
      authorized={authorized}
      users={users}
      caseData={caseData}
      tasks={tasks}
    />
  );
  return (
    <>
      <button
        className="link-button mb-5 flex items-center gap-2"
        onClick={back}
      >
        <ArrowLeft size={15} /> Volver a casos
      </button>
      <div className="page-head">
        <div>
          <h1>{caseData.client.name}</h1>
          <h2>{caseData.subject}</h2>
          <p className="eyebrow">
            {caseData.client.code} · {caseData.code}
          </p>
          <p>
            {caseData.area} · {caseData.current_stage}
          </p>
        </div>
        <div className="actions">
          <Badge>{caseData.status}</Badge>
          {canEdit && (
            <button className="secondary" onClick={() => setModal("caso")}>
              <Pencil size={14} />
              Editar ficha
            </button>
          )}
        </div>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {loading && <p className="muted">Actualizando ficha…</p>}
      <Card>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 text-sm">
          <div>
            <small>Responsable principal</small>
            <p className="mt-2 mb-0">{userName(caseData.responsible_id)}</p>
          </div>
          <div>
            <small>Fecha de inicio</small>
            <p className="mt-2 mb-0">{dateLabel(caseData.start_date)}</p>
          </div>
          <div>
            <small>Expediente o referencia</small>
            <p className="mt-2 mb-0">
              {caseData.reference || "Asunto sin expediente"}
            </p>
          </div>
          <div>
            <small>Tu autorización</small>
            <p className="mt-2 mb-0">
              {canEdit ? "Lectura y edición" : "Solo lectura"}
            </p>
          </div>
        </div>
        <p className="mt-5 mb-0 text-sm muted">{caseData.description}</p>
      </Card>
      <div className="tabs">
        {[
          ["bitacora", "Bitácora"],
          ["tareas", "Vencimientos"],
          ["eventos", "Eventos"],
          ["archivos", "Archivos"],
          ["servicios", isAdmin ? "Servicios y finanzas" : "Servicios"],
          ...(isAdmin ? [["permisos", "Autorizaciones"]] : []),
        ].map(([key, label]) => (
          <button
            key={key}
            className={tab === key ? "active" : ""}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "bitacora" && (
        <CaseTimeline
          canEdit={canEdit}
          setEditEntry={setEditEntry}
          setModal={setModal}
          entries={entries}
          userName={userName}
        />
      )}
      {tab === "tareas" && (
        <CaseTasks
          canEdit={canEdit}
          setEditTask={setEditTask}
          setModal={setModal}
          tasks={tasks}
          userName={userName}
        />
      )}
      {tab === "eventos" && (
        <CaseEvents
          canEdit={canEdit}
          setEditEvent={setEditEvent}
          setModal={setModal}
          events={events}
          isAdmin={isAdmin}
          action={action}
          caseId={caseId}
        />
      )}
      {tab === "archivos" && (
        <CaseFiles
          canEdit={canEdit}
          setModal={setModal}
          files={files}
          action={action}
          openFile={openFile}
        />
      )}
      {tab === "servicios" && (
        <CaseServices
          isAdmin={isAdmin}
          setPlans={setPlans}
          setPercent={setPercent}
          setModal={setModal}
          services={services}
          beginPayment={beginPayment}
          setQuota={setQuota}
          action={action}
          setService={setService}
          setPaymentId={setPaymentId}
          setAllocations={setAllocations}
        />
      )}
      {tab === "permisos" && isAdmin && (
        <CaseAccess
          setModal={setModal}
          access={access}
          userName={userName}
          action={action}
          caseId={caseId}
        />
      )}

      {modal && (
        <Modal
          title={
            {
              caso: "Editar ficha del caso",
              actuacion: "Registrar actuación",
              tarea: "Vencimiento procesal",
              evento: "Evento concreto",
              archivo: "Registrar enlace",
              servicio: "Contratar servicio y definir cuotas",
              abono: "Registrar abono y confirmar aplicación",
              credito: "Aplicar crédito disponible",
              reversar: "Reversar abono",
              permiso: "Autorizar usuario",
              reprogramar: "Reprogramar cuota por fecha",
              vincular: "Vincular acto concreto a cuota",
            }[modal] || ""
          }
          close={() => setModal("")}
        >
          {modal === "caso" && (
            <EditCaseForm
              caseId={caseId}
              done={done}
              caseData={caseData}
              responsibleSelect={responsibleSelect}
            />
          )}
          {modal === "actuacion" && (
            <EntryForm editEntry={editEntry} caseId={caseId} done={done} />
          )}
          {modal === "tarea" && (
            <TaskForm
              editTask={editTask}
              caseId={caseId}
              done={done}
              responsibleSelect={responsibleSelect}
              caseData={caseData}
              entries={entries}
            />
          )}
          {modal === "evento" && (
            <EventForm
              editEvent={editEvent}
              caseId={caseId}
              done={done}
              entries={entries}
            />
          )}
          {modal === "archivo" && (
            <CaseFileForm caseId={caseId} done={done} isAdmin={isAdmin} />
          )}
          {modal === "permiso" && (
            <CaseAccessForm caseId={caseId} done={done} users={users} />
          )}
          {modal === "servicio" && (
            <ServiceForm
              caseId={caseId}
              plans={plans}
              percent={percent}
              done={done}
              setPercent={setPercent}
              updatePlan={updatePlan}
              events={events}
              setPlans={setPlans}
            />
          )}
          {(modal === "abono" || modal === "credito") && service && (
            <PaymentForm
              allocations={allocations}
              modal={modal}
              paymentId={paymentId}
              service={service}
              done={done}
              setAllocations={setAllocations}
            />
          )}
          {modal === "vincular" && quota && (
            <LinkEventForm quota={quota} done={done} events={events} />
          )}
          {modal === "reprogramar" && quota && (
            <RescheduleInstallmentForm quota={quota} done={done} />
          )}
          {modal === "reversar" && (
            <ReversePaymentForm paymentId={paymentId} done={done} />
          )}
        </Modal>
      )}
    </>
  );
}

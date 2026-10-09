import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { api, setToken } from "../src/services/http.ts";
import { authService } from "../src/services/auth.ts";
import { alertsService } from "../src/services/alerts.ts";
import { casesService } from "../src/services/cases.ts";
import { financeService } from "../src/services/finance.ts";
import { reportsService } from "../src/services/reports.ts";
import { dashboardService } from "../src/services/dashboard.ts";
import App from "../src/app/App.tsx";
import AppShell from "../src/components/layout/AppShell.tsx";
import CaseWorkspace from "../src/features/cases/CaseWorkspace.tsx";
import CasesPage from "../src/features/cases/CasesPage.tsx";
import CaseForm from "../src/features/cases/forms/CaseForm.tsx";
import ClientsPage from "../src/features/clients/ClientsPage.tsx";
import ClientForm from "../src/features/clients/forms/ClientForm.tsx";
import DashboardPage from "../src/features/dashboard/DashboardPage.tsx";
import EntryForm from "../src/features/cases/forms/EntryForm.tsx";
import PaymentForm from "../src/features/cases/forms/PaymentForm.tsx";
import EntryTable from "../src/features/cases/components/EntryTable.tsx";
import AreaSelect from "../src/features/cases/components/AreaSelect.tsx";
import AlertTable from "../src/features/dashboard/components/AlertTable.tsx";
import Reports from "../src/features/reports/Reports.tsx";
import AdministrationPage from "../src/features/admin/AdministrationPage.tsx";
import UserForm from "../src/features/admin/forms/UserForm.tsx";
import { dateTimeLabels, dateLabel } from "../src/utils/format.ts";
import { automaticAllocations } from "../src/features/cases/models/paymentAllocation.ts";
import { useLexio } from "../src/hooks/useLexio.ts";
import {
  LEGAL_AREAS,
  legalArea,
} from "../src/features/cases/models/legalAreas.ts";

const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.window = originalWindow;
  setToken("");
});
const noop = () => {};
const admin = {
  id: 1,
  name: "David",
  username: "admin",
  role: "admin",
  active: true,
};
const staff = {
  ...admin,
  id: 2,
  name: "Abogado",
  role: "staff",
  can_create_cases: true,
};
const client = {
  id: 1,
  code: "CL-000001",
  name: "Ana Torres",
  document_type: "DNI",
  document_number: "12345678",
  phone: "999555222",
  email: "",
  address: "Lima",
};
const item = {
  id: 1,
  code: "CAS-000001",
  client_id: 1,
  client,
  area: "Civil",
  process_type: "Cobro de deuda",
  initial_stage: "Demanda",
  status: "activo",
  responsible_id: 2,
  responsible_name: "Abogado",
  created_at: "2026-10-08T15:00:00",
  access_level: "edit",
  fee: "1000.00",
  paid: "400.00",
  balance: "600.00",
  cancelled: false,
  installments: [
    {
      id: 1,
      number: 1,
      amount: "500.00",
      paid: "400.00",
      balance: "100.00",
      due_date: "2026-10-09",
      state: "pendiente",
    },
    {
      id: 2,
      number: 2,
      amount: "500.00",
      paid: "0.00",
      balance: "500.00",
      due_date: "2026-10-12",
      state: "pendiente",
    },
  ],
  payments: [
    {
      id: 1,
      payment_date: "2026-10-08",
      amount: "400.00",
      method: "Efectivo",
      registered_by: 1,
      created_at: "2026-10-08T15:00:00",
    },
  ],
};
function render(component, props = {}) {
  return renderToStaticMarkup(createElement(component, props));
}
function capture(response = {}) {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options });
    return Response.json(response);
  };
  return calls;
}
function textOf(node) {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  return node && typeof node === "object" ? textOf(node.props?.children) : "";
}
function findButtons(node, label) {
  if (Array.isArray(node))
    return node.flatMap((child) => findButtons(child, label));
  if (!node || typeof node !== "object") return [];
  if (node.type === "button" && textOf(node) === label) return [node];
  return findButtons(node.props?.children, label);
}
function formProps(component, props) {
  let form;
  function CaptureForm() {
    form = component(props);
    return null;
  }
  render(CaptureForm);
  return form.props;
}
function componentTree(component, props) {
  let tree;
  function CaptureTree() {
    tree = component(props);
    return null;
  }
  render(CaptureTree);
  return tree;
}

test("login y JWT mantienen credenciales por usuario y token en memoria", async () => {
  const calls = capture({ access_token: "token", user: admin });
  await authService.login({ username: "admin", password: "fixture" });
  assert.equal(calls[0].url, "https://lexio.test/auth/login");
  assert.deepEqual(JSON.parse(calls[0].body), {
    username: "admin",
    password: "fixture",
  });
  setToken("token");
  await api("/cases");
  assert.equal(calls[1].headers.Authorization, "Bearer token");
  assert.ok(calls[1].signal instanceof AbortSignal);
});
test("401 elimina el token y comunica expiración", async () => {
  const events = [];
  globalThis.window = { dispatchEvent: (e) => events.push(e.type) };
  setToken("expired");
  globalThis.fetch = async () =>
    Response.json({ detail: "Sesión vencida" }, { status: 401 });
  await assert.rejects(api("/cases"), /Sesión vencida/);
  assert.deepEqual(events, ["lexio-session-expired"]);
  const calls = capture();
  await api("/cases");
  assert.equal(calls[0].headers.Authorization, undefined);
});
test("una respuesta 401 de la sesión anterior conserva la sesión nueva", async () => {
  const events = [];
  let finish;
  globalThis.window = { dispatchEvent: (e) => events.push(e.type) };
  globalThis.fetch = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  setToken("old-session");
  const pending = assert.rejects(api("/cases"), /Sesión anterior vencida/);
  setToken("new-session");
  finish(Response.json({ detail: "Sesión anterior vencida" }, { status: 401 }));
  await pending;
  assert.deepEqual(events, []);
  const calls = capture();
  await api("/cases");
  assert.equal(calls[0].headers.Authorization, "Bearer new-session");
});
test("la aplicación inicia en login y conserva el punto de montaje", async () => {
  const html = render(App);
  assert.match(html, /Ingresa a tu estudio/);
  assert.match(html, /name="username"/);
  assert.doesNotMatch(html, /type="email"/);
  const entry = await readFile(
    new URL("../src/main.tsx", import.meta.url),
    "utf8",
  );
  const document = await readFile(
    new URL("../index.html", import.meta.url),
    "utf8",
  );
  assert.ok(
    document.includes(`id="${entry.match(/getElementById\("([^"]+)"\)/)[1]}"`),
  );
});
test("al iniciar una sesión la página inicial es el panel", () => {
  let initialPage;
  function InitialPage() {
    initialPage = useLexio().page;
    return null;
  }
  render(InitialPage);
  assert.equal(initialPage, "inicio");
});
test("Inicio reúne alertas y cobros con acceso a la pestaña financiera y respeta el rol", async () => {
  const dashboard = {
    counts: {
      total_cases: 4,
      active_cases: 3,
      concluded_cases: 1,
      pending_legal_alerts: 2,
    },
    finance: { fee: "12000.00", paid: "2000.00", balance: "10000.00" },
    upcoming_payments: [
      {
        id: 1,
        case_id: 7,
        case_code: "CAS-000007",
        client_code: client.code,
        client_name: client.name,
        process_type: item.process_type,
        number: 1,
        due_date: "2026-10-15",
        balance: "9876.54",
      },
    ],
  };
  const opened = [];
  const props = {
    actor: admin,
    dashboard,
    alerts: [],
    isAdmin: true,
    busy: false,
    load: noop,
    openCase: (id, tab) => opened.push([id, tab]),
  };
  const html = render(DashboardPage, props);
  for (const label of [
    "Panel del día",
    "Alertas procesales y otros",
    "Alerta de cobros",
    "Cliente y caso",
    "Saldo de la cuota",
    "CAS-000007",
  ])
    assert.ok(html.includes(label));
  assert.doesNotMatch(html, /class="eyebrow">[1-4]\s*·/);
  const tree = DashboardPage(props);
  findButtons(tree, "Ver caso")[0].props.onClick();
  assert.equal(findButtons(tree, "Ver todas las alertas").length, 0);
  assert.deepEqual(opened, [[7, "finanzas"]]);
  const team = render(DashboardPage, {
    ...props,
    actor: staff,
    isAdmin: false,
  });
  assert.match(team, /Alertas procesales y otros/);
  assert.doesNotMatch(team, /Alerta de cobros|Saldo de la cuota|9[,.]876/);
  const calls = capture(dashboard);
  assert.deepEqual(await dashboardService.get(), dashboard);
  assert.equal(calls[0].url, "https://lexio.test/dashboard");
});
test("navegación separa Inicio, Clientes y Casos sin bitácora independiente", () => {
  const props = {
    actor: admin,
    page: "inicio",
    onNavigate: noop,
    onLogout: noop,
    children: "",
  };
  const html = render(AppShell, props);
  for (const label of [
    "Inicio",
    "Clientes",
    "Casos",
    "Reportes",
    "Administración",
  ])
    assert.ok(html.includes(`title="${label}"`));
  assert.doesNotMatch(
    html,
    /title="Alertas y vencimientos"|title="Ficha integral"|title="Bitácora del caso"|1 ·|2 ·|3 ·|4 ·/,
  );
  assert.doesNotMatch(
    render(AppShell, { ...props, actor: staff }),
    /title="Administración"/,
  );
});
test("filtros envían nombres del contrato y omiten valores vacíos", async () => {
  const calls = capture([]);
  await casesService.list({ search: "Ana & José", area: "", status: "activo" });
  await casesService.list();
  const url = new URL(calls[0].url);
  assert.equal(url.searchParams.get("search"), "Ana & José");
  assert.equal(url.searchParams.has("area"), false);
  assert.equal(calls[1].url, "https://lexio.test/cases");
  await casesService.list({ client_id: String(client.id) });
  assert.deepEqual(
    [...new URL(calls[2].url).searchParams],
    [["client_id", "1"]],
  );
});
test("clientes ofrecen acciones separadas vinculadas al mismo cliente", () => {
  const selected = [];
  const props = {
    actor: admin,
    clients: [client],
    busy: false,
    search: "",
    setSearch: noop,
    load: noop,
    create: noop,
    edit: (value) => selected.push(["edit", value]),
    viewCases: (value) => selected.push(["view", value]),
    newCase: (value) => selected.push(["new", value]),
  };
  const html = render(ClientsPage, props);
  assert.doesNotMatch(
    html,
    /Honorarios|Control financiero|Bitácora|link-button/,
  );
  const tree = ClientsPage(props);
  for (const label of ["Ver casos", "Nuevo caso", "Corregir datos"])
    assert.match(
      findButtons(tree, label)[0].props.className,
      /^(primary|secondary)\b/,
    );
  findButtons(tree, "Ver casos")[0].props.onClick();
  findButtons(tree, "Nuevo caso")[0].props.onClick();
  findButtons(tree, "Corregir datos")[0].props.onClick();
  assert.deepEqual(selected, [
    ["view", client],
    ["new", client],
    ["edit", client],
  ]);
  const team = render(ClientsPage, { ...props, actor: staff });
  assert.match(team, />Ver casos</);
  assert.match(team, />Nuevo caso</);
  assert.doesNotMatch(team, /Corregir datos|>Nuevo cliente</);
  assert.doesNotMatch(
    render(ClientsPage, {
      ...props,
      actor: { ...staff, can_create_cases: false },
    }),
    />Nuevo caso</,
  );
});
test("datos personales se crean y corrigen exclusivamente en el formulario de clientes", async () => {
  const html = render(ClientForm, { saved: noop });
  for (const name of [
    "name",
    "document_type",
    "document_number",
    "phone",
    "email",
    "address",
  ])
    assert.ok(html.includes(`name="${name}"`));
  assert.doesNotMatch(
    html,
    /name="code"|name="process_type"|name="initial_stage"|Honorarios|Agregar cuota/,
  );
  const calls = capture(client);
  const form = new FormData();
  for (const [name, value] of Object.entries({
    name: client.name,
    document_type: client.document_type,
    document_number: client.document_number,
    phone: client.phone,
    email: client.email,
    address: client.address,
  }))
    form.set(name, value);
  form.set("code", "NO-EDITABLE");
  form.set("tenant_id", "99");
  await ClientForm({ saved: noop }).props.submit(form);
  await ClientForm({ item: client, saved: noop }).props.submit(form);
  assert.deepEqual(
    calls.map((call) => [new URL(call.url).pathname, call.method]),
    [
      ["/clients", "POST"],
      ["/clients/1", "PUT"],
    ],
  );
  assert.deepEqual(JSON.parse(calls[0].body), {
    name: client.name,
    document_type: client.document_type,
    document_number: client.document_number,
    phone: client.phone,
    email: client.email,
    address: client.address,
  });
  assert.equal("code" in JSON.parse(calls[1].body), false);
  assert.equal("tenant_id" in JSON.parse(calls[1].body), false);
  assert.match(render(ClientForm, { item: client, saved: noop }), /CL-000001/);
});
test("lista de casos ofrece botones claros y un solo estado de proceso", () => {
  let created = false;
  const props = {
    actor: admin,
    isAdmin: true,
    cases: [item],
    clients: [client],
    busy: false,
    search: "",
    area: "",
    status: "",
    clientFilter: "",
    setSearch: noop,
    setArea: noop,
    setStatus: noop,
    setClientFilter: noop,
    load: noop,
    clearFilters: noop,
    openCase: noop,
    create: () => {
      created = true;
    },
  };
  const html = render(CasesPage, props);
  assert.match(html, />Ver caso</);
  assert.match(html, />Limpiar filtros</);
  assert.match(html, />Nuevo caso</);
  assert.doesNotMatch(html, /suspendido|link-button/);
  findButtons(CasesPage(props), "Nuevo caso")[0].props.onClick();
  assert.equal(created, true);
});
test("dos casos del mismo cliente conservan botones de acceso independientes", () => {
  const opened = [];
  const props = {
    actor: admin,
    isAdmin: true,
    cases: [item, { ...item, id: 2, process_type: "Desalojo" }],
    clients: [client],
    busy: false,
    search: "",
    area: "",
    status: "",
    clientFilter: "",
    setSearch: noop,
    setArea: noop,
    setStatus: noop,
    setClientFilter: noop,
    load: noop,
    clearFilters: noop,
    openCase: (id) => opened.push(id),
    create: noop,
  };
  const html = render(CasesPage, props);
  assert.match(html, /Cobro de deuda/);
  assert.match(html, /Desalojo/);
  const buttons = findButtons(CasesPage(props), "Ver caso");
  assert.equal(buttons.length, 2);
  buttons.forEach((button) => button.props.onClick());
  assert.deepEqual(opened, [1, 2]);
});
test("crear caso selecciona un cliente existente y reúne proceso y honorarios", () => {
  const html = render(CaseForm, {
    actor: admin,
    users: [admin, staff],
    clients: [client],
    saved: noop,
  });
  for (const text of [
    "Tipo de proceso",
    "Control financiero",
    "Honorarios totales",
    "Agregar cuota",
  ])
    assert.ok(html.includes(text));
  assert.match(html, /name="client_id"/);
  assert.match(html, /CL-000001/);
  assert.match(html, /name="initial_stage"/);
  assert.doesNotMatch(
    html,
    /name="name"|name="document_number"|name="phone"|name="email"|name="address"|current_stage|subject|Contratar servicio|Evento/,
  );
});
test("nuevo caso desde un cliente conserva la selección y orienta si falta registrarlo", () => {
  const second = { ...client, id: 2, code: "CL-000002", name: "Luis Pérez" };
  const props = {
    actor: admin,
    users: [admin],
    clients: [client, second],
    clientId: 2,
    saved: noop,
  };
  assert.match(
    render(CaseForm, props),
    /<option value="2" selected="">CL-000002 · Luis Pérez<\/option>/,
  );
  assert.match(
    render(CaseForm, { ...props, clients: [], clientId: undefined }),
    /Primero registra al cliente en la página Clientes/,
  );
});
test("editar proceso como staff conserva datos de cliente y oculta finanzas", () => {
  const html = render(CaseForm, {
    actor: staff,
    users: [staff],
    clients: [client],
    item,
    saved: noop,
  });
  assert.match(html, /Ana Torres/);
  assert.match(html, /name="process_type"/);
  assert.doesNotMatch(
    html,
    /name="name"|name="document_number"|Honorarios|Control financiero/,
  );
});
test("honorarios y montos se conservan al editar caso con abonos", () => {
  const html = render(CaseForm, {
    actor: admin,
    users: [admin, staff],
    clients: [client],
    item,
    saved: noop,
  });
  assert.match(html, /los honorarios y montos se conservan/);
  assert.equal((html.match(/readOnly=""/g) || []).length, 3);
  assert.match(html, /name="due_date_0"/);
  assert.match(html, /name="due_date_1"/);
  assert.doesNotMatch(html, /Agregar cuota|Quitar cuota/);
  assert.doesNotMatch(
    html,
    /name="name"|name="document_number"|name="phone"|name="email"|name="address"/,
  );
});
test("editar un caso conserva el cliente y las cuotas sin reenviar datos personales", async () => {
  const calls = capture(item);
  const form = new FormData();
  for (const [name, value] of Object.entries({
    area: item.area,
    process_type: item.process_type,
    initial_stage: item.initial_stage,
    status: "concluido",
    responsible_id: String(staff.id),
    fee: item.fee,
    amount_0: "500.00",
    due_date_0: "2026-10-16",
    amount_1: "500.00",
    due_date_1: "2026-10-20",
  }))
    form.set(name, value);
  form.set("name", "No debe modificar al cliente");
  await formProps(CaseForm, {
    actor: admin,
    users: [admin, staff],
    clients: [client],
    item,
    saved: noop,
  }).submit(form);
  assert.equal(calls[0].url, "https://lexio.test/cases/1");
  assert.equal(calls[0].method, "PUT");
  const data = JSON.parse(calls[0].body);
  assert.equal(data.status, "concluido");
  assert.deepEqual(data.installments, [
    { id: 1, amount: "500.00", due_date: "2026-10-16" },
    { id: 2, amount: "500.00", due_date: "2026-10-20" },
  ]);
  for (const name of ["client", "client_id", "name", "fee", "tenant_id"])
    assert.equal(name in data, false);
});
test("detalle destaca primero el cliente y oculta importes al equipo", () => {
  const props = {
    selected: item,
    actor: admin,
    users: [admin, staff],
    clients: [client],
    back: noop,
  };
  const html = render(CaseWorkspace, props);
  assert.ok(
    html.indexOf('class="client-title">Ana Torres') <
      html.indexOf("<h2>Cobro de deuda"),
  );
  assert.match(html, /Bitácora del caso/);
  assert.match(html, /role="tab"[^>]*aria-selected="true"[^>]*>Bitácora/);
  assert.match(html, /id="case-finanzas-panel"[^>]*hidden=""/);
  const financial = render(CaseWorkspace, { ...props, initialTab: "finanzas" });
  assert.match(financial, /Registrar abono/);
  assert.match(financial, /Total abonado/);
  assert.match(financial, /Cuota 1/);
  assert.match(financial, /Datos del cliente y proceso/);
  assert.match(financial, /id="case-bitacora-panel"[^>]*hidden=""/);
  const team = render(CaseWorkspace, { ...props, actor: staff });
  assert.doesNotMatch(
    team,
    /Control financiero|Registrar abono|Eliminar abono/,
  );
  assert.doesNotMatch(
    render(CaseWorkspace, { ...props, actor: staff, initialTab: "finanzas" }),
    /Control financiero|Registrar abono|Total abonado/,
  );
  assert.doesNotMatch(
    team,
    /Contratar servicio|Aplicar crédito|Vincular evento|Archivos/,
  );
});
test("selector conserva exactamente las once ramas", () => {
  const html = render(AreaSelect, {
    name: "area",
    required: true,
    defaultValue: "Antigua",
  });
  assert.equal((html.match(/<option /g) || []).length, 12);
  for (const area of LEGAL_AREAS) assert.ok(html.includes(`value="${area}"`));
  assert.equal(legalArea("Fiscalía"), "Fiscalía");
  assert.throws(() => legalArea("Otra"), /Selecciona una rama/);
});
test("un cliente puede tener varios casos con honorarios propios", async () => {
  const calls = capture(item);
  const data = {
    client_id: client.id,
    area: "Civil",
    process_type: "Cobro",
    initial_stage: "Demanda",
    status: "activo",
    responsible_id: admin.id,
    fee: "1000.00",
    installments: [{ amount: "1000.00", due_date: "2026-10-15" }],
  };
  const form = new FormData();
  for (const [name, value] of Object.entries({
    client_id: String(client.id),
    area: data.area,
    process_type: data.process_type,
    initial_stage: data.initial_stage,
    status: data.status,
    responsible_id: String(admin.id),
    fee: data.fee,
    amount_0: "1000.00",
    due_date_0: "2026-10-15",
  }))
    form.set(name, value);
  form.set("name", "Estos datos se editan en Clientes");
  const props = {
    actor: admin,
    users: [admin],
    clients: [client],
    saved: noop,
  };
  await formProps(CaseForm, props).submit(form);
  assert.equal(calls[0].url, "https://lexio.test/cases");
  assert.deepEqual(JSON.parse(calls[0].body), data);
  assert.equal("tenant_id" in data, false);
  assert.equal("client" in JSON.parse(calls[0].body), false);
  form.set("process_type", "Desalojo");
  form.set("fee", "2000.00");
  form.set("amount_0", "2000.00");
  form.set("due_date_0", "2026-10-20");
  await formProps(CaseForm, props).submit(form);
  const second = JSON.parse(calls[1].body);
  assert.equal(second.client_id, data.client_id);
  assert.equal(second.process_type, "Desalojo");
  assert.equal(second.fee, "2000.00");
  assert.equal("client" in second, false);
});
test("bitácora envía asunto, tipo y descripción detallada con responsable autenticado", async () => {
  const calls = capture({});
  const form = new FormData();
  form.set("action_date", "2026-10-08");
  form.set("subject", "Presentar escrito");
  form.set("subject_type", "legal");
  form.set("description", "Presentar escrito");
  form.set("alert_date", "2026-10-15");
  await EntryForm({
    caseId: 1,
    actor: staff,
    done: async () => {},
  }).props.submit(form);
  assert.equal(calls[0].url, "https://lexio.test/cases/1/entries");
  assert.equal(calls[0].method, "POST");
  assert.deepEqual(JSON.parse(calls[0].body), {
    action_date: "2026-10-08",
    subject: "Presentar escrito",
    subject_type: "legal",
    description: "Presentar escrito",
    alert_date: "2026-10-15",
  });
  const html = render(EntryForm, { caseId: 1, actor: staff, done: noop });
  assert.match(html, /Responsable: Abogado/);
  assert.match(html, /se guardan automáticamente/);
  assert.match(
    html,
    /<input(?=[^>]*name="subject")(?=[^>]*maxLength="150")[^>]*>/,
  );
  assert.match(html, /name="subject_type"/);
  assert.match(html, /value="otro">Otro/);
  assert.doesNotMatch(html, /is_payment_event|responsible_id/);
});
test("editar actuación precarga sus fechas y texto y conserva el registro original", () => {
  const entry = {
    id: 7,
    case_id: 1,
    action_date: "2026-10-07",
    subject: "Escrito original",
    subject_type: "otro",
    description: "Presentar escrito original",
    alert_date: "2026-10-15",
    attended: true,
    registered_by: staff.id,
    responsible_name: staff.name,
    created_at: "2026-10-09T02:30:00",
  };
  const html = render(EntryForm, {
    caseId: 1,
    actor: admin,
    item: entry,
    done: noop,
  });
  assert.match(html, /name="action_date"[^>]*value="2026-10-07"/);
  assert.match(html, /name="alert_date"[^>]*value="2026-10-15"/);
  assert.match(html, /name="subject"[^>]*value="Escrito original"/);
  assert.match(html, /value="otro" selected="">Otro/);
  assert.match(
    html,
    /<textarea[^>]*name="description"[^>]*>Presentar escrito original<\/textarea>/,
  );
  assert.match(html, /Guardar cambios/);
  assert.match(html, /Responsable: Abogado/);
  assert.match(html, /8 de octubre de 2026/);
  assert.match(html, /9:30/);
  assert.match(html, /ya está atendido/);
  assert.doesNotMatch(
    html,
    /Responsable: David|name="registered_by"|name="created_at"|name="attended"|type="checkbox"/,
  );
});
test("corregir actuación envía asunto y tipo sin alterar autor, hora o Atendido", async () => {
  const entry = {
    id: 7,
    case_id: 1,
    action_date: "2026-10-07",
    subject: "Escrito original",
    subject_type: "legal",
    description: "Escrito original",
    alert_date: "2026-10-15",
    attended: true,
    registered_by: staff.id,
    responsible_name: staff.name,
    created_at: "2026-10-09T02:30:00",
  };
  const calls = capture(entry);
  let completed = 0;
  const form = new FormData();
  form.set("action_date", "2026-10-06");
  form.set("subject", "Asunto corregido");
  form.set("subject_type", "otro");
  form.set("description", "Descripción corregida");
  form.set("alert_date", "2026-10-20");
  form.set("registered_by", String(admin.id));
  form.set("created_at", "2026-10-10T00:00:00");
  form.set("attended", "false");
  const props = {
    caseId: 1,
    actor: admin,
    item: entry,
    done: async () => {
      completed += 1;
    },
  };
  await EntryForm(props).props.submit(form);
  assert.equal(calls[0].url, "https://lexio.test/entries/7");
  assert.equal(calls[0].method, "PUT");
  assert.deepEqual(JSON.parse(calls[0].body), {
    action_date: "2026-10-06",
    subject: "Asunto corregido",
    subject_type: "otro",
    description: "Descripción corregida",
    alert_date: "2026-10-20",
  });
  form.set("alert_date", "");
  await EntryForm(props).props.submit(form);
  assert.deepEqual(JSON.parse(calls[1].body), {
    action_date: "2026-10-06",
    subject: "Asunto corregido",
    subject_type: "otro",
    description: "Descripción corregida",
    alert_date: null,
  });
  assert.equal(completed, 2);
});
test("editar actuaciones requiere permiso incluso si ya están atendidas", () => {
  const pending = {
    id: 7,
    case_id: 1,
    action_date: "2026-10-07",
    subject: "Escrito breve",
    subject_type: "legal",
    description: "Escrito",
    alert_date: "2026-10-15",
    attended: false,
    responsible_name: staff.name,
    created_at: "2026-10-09T02:30:00",
    can_attend: true,
  };
  const attended = { ...pending, id: 8, attended: true };
  const withoutAlert = { ...pending, id: 9, alert_date: null };
  const edited = [];
  const props = {
    entries: [pending, attended, withoutAlert],
    canEdit: true,
    canAttend: true,
    edit: (value) => edited.push(value),
    load: noop,
  };
  const html = render(EntryTable, props);
  assert.equal((html.match(/>Editar</g) || []).length, 3);
  assert.equal((html.match(/>Marcar atendido</g) || []).length, 1);
  const tree = formProps(EntryTable, props);
  findButtons({ props: tree }, "Editar").forEach((button) => {
    assert.equal(button.props.className, "secondary");
    button.props.onClick();
  });
  assert.deepEqual(edited, [pending, attended, withoutAlert]);
  assert.match(
    render(EntryTable, { ...props, busy: true }),
    /<button class="secondary" disabled="">Editar<\/button>/,
  );
  assert.doesNotMatch(
    render(EntryTable, { ...props, canEdit: false, canAttend: false }),
    />Editar<|Marcar atendido/,
  );
  assert.doesNotMatch(
    render(EntryTable, { ...props, edit: undefined }),
    />Editar</,
  );
});
test("bitácora permite atender únicamente obligaciones pendientes con permiso", () => {
  const entry = {
    id: 1,
    case_id: 1,
    action_date: "2026-10-08",
    subject: "Presentar escrito",
    subject_type: "legal",
    description: "Presentar escrito",
    alert_date: "2026-10-15",
    attended: false,
    responsible_name: "Abogado",
    created_at: "2026-10-08T15:00:00",
    client_code: client.code,
    client_name: client.name,
    process_type: item.process_type,
    can_attend: true,
  };
  const props = {
    entries: [entry],
    showClient: true,
    load: noop,
    openCase: noop,
  };
  assert.match(render(EntryTable, props), /Marcar atendido/);
  assert.match(
    render(EntryTable, {
      ...props,
      entries: [{ ...entry, subject_type: "otro" }],
    }),
    /Marcar atendido/,
  );
  assert.doesNotMatch(
    render(EntryTable, { ...props, entries: [{ ...entry, attended: true }] }),
    /Marcar atendido/,
  );
  assert.doesNotMatch(
    render(EntryTable, {
      ...props,
      entries: [{ ...entry, can_attend: false }],
    }),
    /Marcar atendido/,
  );
});
test("abonos van a primera cuota y distribuyen excedente con centavos exactos", () => {
  const quotas = [
    { id: 2, number: 2, balance: "500.00" },
    { id: 1, number: 1, balance: "500.00" },
  ];
  assert.deepEqual(automaticAllocations("400", quotas), { 1: "400.00" });
  assert.deepEqual(automaticAllocations("650", quotas), {
    1: "500.00",
    2: "150.00",
  });
  assert.deepEqual(automaticAllocations("500.01", quotas), {
    1: "500.00",
    2: "0.01",
  });
  assert.deepEqual(
    automaticAllocations("100", [{ ...quotas[1], balance: "0.00" }, quotas[0]]),
    { 2: "100.00" },
  );
});
test("abono es simple, automático por defecto y permite elegir primera cuota", async () => {
  const html = render(PaymentForm, { item, done: noop });
  assert.match(html, /Automático · primera cuota pendiente/);
  assert.match(html, /Aplicar primero a/);
  assert.doesNotMatch(html, /Comprobante|crédito|name="application/);
  const calls = capture({});
  await financeService.recordPayment(1, {
    payment_date: "2026-10-08",
    amount: "400.00",
    method: "Efectivo",
  });
  await financeService.recordPayment(1, {
    payment_date: "2026-10-08",
    amount: "200.00",
    method: "",
    installment_id: 2,
  });
  assert.equal(calls[0].url, "https://lexio.test/cases/1/payments");
  assert.equal(JSON.parse(calls[0].body).amount, "400.00");
  assert.equal("installment_id" in JSON.parse(calls[0].body), false);
  assert.equal(JSON.parse(calls[1].body).installment_id, 2);
});
test("alertas muestran solo el asunto y permiten atender Legal y Otro con permiso", () => {
  const entry = {
    id: 1,
    case_id: 1,
    client_code: client.code,
    client_name: client.name,
    case_code: item.code,
    process_type: item.process_type,
    kind: "legal",
    subject: "Presentar escrito",
    description: "Detalles extensos reservados a la bitácora",
    target_date: "2026-10-15",
    notice_date: "2026-10-08",
    anticipation: 5,
    urgent: false,
    responsible_name: "Abogado",
    entry_id: 1,
    can_attend: true,
  };
  const props = {
    data: [entry],
    busy: false,
    load: noop,
    openCase: noop,
  };
  assert.match(render(AlertTable, props), /Marcar leído/);
  assert.match(render(AlertTable, props), /Marcar atendido/);
  assert.match(render(AlertTable, props), /Presentar escrito/);
  assert.match(render(AlertTable, props), /CAS-000001 · Cobro de deuda/);
  assert.doesNotMatch(
    render(AlertTable, props),
    /Detalles extensos|Saldo de honorarios/,
  );
  const opened = [];
  findButtons(
    componentTree(AlertTable, {
      ...props,
      openCase: (id, tab) => opened.push([id, tab]),
    }),
    "Ver caso",
  )[0].props.onClick();
  assert.deepEqual(opened, [[1, "bitacora"]]);
  const other = render(AlertTable, {
    ...props,
    data: [{ ...entry, kind: "otro" }],
  });
  assert.match(other, />Otro</);
  assert.match(other, /Marcar atendido/);
  assert.doesNotMatch(
    render(AlertTable, { ...props, data: [{ ...entry, can_attend: false }] }),
    /Marcar atendido/,
  );
  assert.doesNotMatch(
    render(AlertTable, { ...props, data: [{ ...entry, urgent: true }] }),
    /Marcar leído/,
  );
  assert.doesNotMatch(
    render(AlertTable, {
      ...props,
      data: [{ ...entry, kind: "pago", balance: "999.00" }],
    }),
    /Marcar atendido|999|<th>Saldo/,
  );
});
test("Inicio muestra todas las alertas procesales y excluye cobros de la primera tabla", () => {
  const alerts = Array.from({ length: 7 }, (_, index) => ({
    id: index + 1,
    case_id: item.id,
    case_code: item.code,
    process_type: item.process_type,
    client_code: client.code,
    client_name: client.name,
    kind: index % 2 ? "otro" : "legal",
    subject: `Asunto ${index + 1}`,
    description: "Detalle reservado",
    target_date: "2026-10-15",
    notice_date: "2026-10-08",
    anticipation: 5,
    urgent: false,
    responsible_name: staff.name,
    entry_id: index + 1,
    can_attend: true,
  }));
  alerts.push({
    ...alerts[0],
    id: 8,
    kind: "pago",
    subject: "No mezclar cobros",
  });
  const html = render(DashboardPage, {
    actor: staff,
    dashboard: { counts: {} },
    alerts,
    isAdmin: false,
    busy: false,
    load: noop,
    openCase: noop,
  });
  for (let index = 1; index <= 7; index++)
    assert.match(html, new RegExp(`Asunto ${index}`));
  assert.doesNotMatch(
    html,
    /No mezclar cobros|Detalle reservado|Alerta de cobros/,
  );
  const headers = [...html.matchAll(/<th>([^<]+)<\/th>/g)].map(
    (match) => match[1],
  );
  assert.deepEqual(headers, [
    "Cliente y caso",
    "Alerta",
    "Vencimiento",
    "Abogado responsable",
    "Descripción corta",
    "Acciones",
  ]);
});
test("leer y atender usan endpoints independientes", async () => {
  const calls = capture({});
  await alertsService.read(5);
  await casesService.attendEntry(2);
  assert.deepEqual(
    calls.map((call) => [new URL(call.url).pathname, call.method]),
    [
      ["/alerts/5/read", "POST"],
      ["/entries/2/attend", "POST"],
    ],
  );
});
test("reporte único agrupa casos y financieras por rama respetando roles", async () => {
  const report = {
    rows: [
      {
        area: "Civil",
        total_cases: 1,
        active_cases: 1,
        concluded_cases: 0,
        fee: "1000",
        paid: "400",
        balance: "600",
      },
    ],
    totals: {
      total_cases: 1,
      active_cases: 1,
      concluded_cases: 0,
      fee: "1000",
      paid: "400",
      balance: "600",
    },
  };
  const props = { report, isAdmin: true, busy: false, load: noop };
  const html = render(Reports, props);
  assert.match(html, /Total facturado/);
  assert.match(html, /Efectivo cobrado/);
  assert.match(html, /Saldo pendiente/);
  assert.doesNotMatch(html, /Corte|Servicio|cutoff/);
  assert.doesNotMatch(
    render(Reports, { ...props, isAdmin: false }),
    /Total facturado|Efectivo cobrado|Saldo pendiente/,
  );
  const calls = capture(report);
  await reportsService.list();
  assert.equal(calls[0].url, "https://lexio.test/reports");
});
test("administración muestra fecha y hora legibles sin recursos ni JSON", () => {
  const audit = [
    {
      id: 1,
      created_at: "2026-10-09T02:30:00",
      user_id: 1,
      user_name: "David",
      action: "Registró un abono",
      resource: "lexio_payments",
      changes: '{"amount":"400"}',
    },
  ];
  const html = render(AdministrationPage, {
    users: [admin],
    audit,
    setEditUser: noop,
    setModal: noop,
  });
  assert.match(html, /8 de octubre de 2026/);
  assert.match(html, /9:30/);
  assert.doesNotMatch(
    html,
    /lexio_payments|amount|Recurso|Registro UTC|Anticipación de avisos/,
  );
});
test("fecha y hora se muestran en Perú con cambios de día y formatos UTC", () => {
  const local = dateTimeLabels("2026-10-09T02:30:00");
  assert.equal(local.date, "8 de octubre de 2026");
  assert.match(local.time, /9:30/);
  assert.deepEqual(dateTimeLabels("2026-10-09T02:30:00Z"), local);
  assert.deepEqual(dateTimeLabels("2026-10-08T21:30:00-05:00"), local);
  assert.equal(
    dateLabel("2026-10-08T21:30:00-05:00"),
    dateLabel("2026-10-09T02:30:00Z"),
  );
});
test("usuarios conservan contraseña mínima de seis y permisos sin correo de acceso", async () => {
  assert.match(render(UserForm, { done: noop }), /minLength="6"/i);
  const calls = capture({});
  const form = new FormData();
  form.set("name", "Juan");
  form.set("username", "juan");
  form.set("password", "fixture");
  await UserForm({ done: async () => {} }).props.submit(form);
  assert.equal(JSON.parse(calls[0].body).username, "juan");
  assert.equal("email" in JSON.parse(calls[0].body), false);
});
